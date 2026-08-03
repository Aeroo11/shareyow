-- share.yow — skema awal
--
-- Prinsip yang membentuk seluruh berkas ini: LOG OPERASI ADALAH SUMBER KEBENARAN.
-- Tidak ada tabel `expenses`, `members`, atau `settlements` di sini. Server tidak
-- perlu tahu berapa saldo siapa; ia hanya perlu menyimpan operasi, memberi nomor
-- urut, dan menjaga siapa boleh membaca apa. Seluruh perhitungan terjadi di HP.
--
-- Konsekuensinya menyenangkan: server tidak bisa salah hitung, karena ia memang
-- tidak menghitung apa pun.

-- ---------------------------------------------------------------------------
-- Tabel
-- ---------------------------------------------------------------------------

create table public.profiles (
  id           uuid primary key references auth.users on delete cascade,
  display_name text not null,
  created_at   timestamptz not null default now()
);

create table public.groups (
  id         uuid primary key,
  name       text not null,
  currency   text not null default 'IDR',
  created_by uuid not null references auth.users,
  -- Penghitung nomor urut khusus grup ini. Lihat assign_op_seq() di bawah —
  -- kolom inilah yang membuat urutan operasi bebas celah.
  op_seq     bigint not null default 0,
  created_at timestamptz not null default now()
);

-- Tabel ini BUKAN daftar anggota grup.
--
-- Daftar anggota yang sebenarnya ada di dalam log operasi, dan boleh berisi
-- "anggota bayangan" — orang yang dicatat namanya tanpa pernah punya akun. Itu
-- yang membuat aplikasi ini berguna sejak hari pertama tanpa menunggu siapa pun
-- mendaftar.
--
-- Tabel ini hanya menjawab satu pertanyaan yang tidak bisa dijawab log: akun mana
-- yang boleh membaca dan menulis grup ini. `member_id` menghubungkan akun tersebut
-- dengan identitas anggota di dalam log — inilah yang terjadi saat seseorang
-- "mengklaim" anggota bayangan miliknya.
create table public.group_access (
  group_id  uuid not null references public.groups on delete cascade,
  user_id   uuid not null references auth.users on delete cascade,
  member_id uuid not null,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table public.group_invites (
  code       text primary key,
  group_id   uuid not null references public.groups on delete cascade,
  created_by uuid not null references auth.users,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create table public.ops (
  id         uuid primary key,
  group_id   uuid not null references public.groups on delete cascade,
  seq        bigint not null,
  type       text not null,
  -- Id ANGGOTA di dalam log, bukan id akun. Anggota bayangan tidak punya akun,
  -- tapi tetap bisa menjadi pelaku sebuah operasi.
  author_id  uuid not null,
  client_ts  bigint not null,
  payload    jsonb not null,
  created_at timestamptz not null default now(),
  unique (group_id, seq)
);

create index ops_by_group_seq on public.ops (group_id, seq);

-- ---------------------------------------------------------------------------
-- Penomoran urut: kenapa bukan bigserial
-- ---------------------------------------------------------------------------
--
-- Klien menarik operasi dengan `seq > kursor`, jadi seluruh sinkronisasi
-- bergantung pada satu janji: tidak ada operasi yang muncul dengan nomor LEBIH
-- KECIL daripada nomor yang sudah pernah dilihat klien.
--
-- `bigserial` melanggar janji itu. Nomor diambil di luar transaksi, jadi dua
-- penyisipan bersamaan bisa mendapat 10 dan 11, lalu yang bernomor 11 selesai
-- lebih dulu. Klien yang menarik tepat di antaranya akan melihat 11, menyetel
-- kursornya ke 11, dan **kehilangan operasi 10 selamanya** — tanpa satu pun
-- pesan kesalahan. Pengeluaran yang hilang diam-diam adalah kegagalan terburuk
-- yang bisa dialami aplikasi ini.
--
-- Karena itu nomor diambil dengan menaikkan penghitung di baris grup. `update`
-- mengunci baris tersebut, sehingga penyisipan lain ke grup yang sama menunggu
-- sampai transaksi ini selesai. Nomor jadi berurutan rapat dan tidak pernah
-- terlihat terbalik. Ongkosnya: penulisan ke satu grup menjadi berurutan — dan
-- untuk grup berisi lima anak kos, itu bukan ongkos sama sekali.

create function public.assign_op_seq() returns trigger
language plpgsql
-- security definer supaya trigger boleh menaikkan penghitung di tabel groups
-- tanpa perlu membuka policy UPDATE untuk pengguna biasa.
security definer
set search_path = public
as $$
begin
  update public.groups
     set op_seq = op_seq + 1
   where id = new.group_id
  returning op_seq into new.seq;

  if new.seq is null then
    raise exception 'grup % tidak ditemukan', new.group_id;
  end if;

  return new;
end;
$$;

-- Berjalan sebelum penyisipan dan selalu menimpa nilai dari klien: nomor urut
-- adalah wewenang server, dan klien tidak boleh bisa memilihnya sendiri.
create trigger ops_assign_seq
  before insert on public.ops
  for each row execute function public.assign_op_seq();

-- ---------------------------------------------------------------------------
-- Keanggotaan
-- ---------------------------------------------------------------------------

-- security definer supaya pemeriksaan ini tidak memanggil kembali policy pada
-- group_access — yang akan menjadi rekursi tak berujung.
create function public.is_member(gid uuid) returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.group_access
     where group_id = gid and user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.profiles      enable row level security;
alter table public.groups        enable row level security;
alter table public.group_access  enable row level security;
alter table public.group_invites enable row level security;
alter table public.ops           enable row level security;

create policy "profil sendiri" on public.profiles
  for select using (id = auth.uid());
create policy "buat profil sendiri" on public.profiles
  for insert with check (id = auth.uid());
create policy "ubah profil sendiri" on public.profiles
  for update using (id = auth.uid());

create policy "grup yang diikuti" on public.groups
  for select using (public.is_member(id));
create policy "buat grup sendiri" on public.groups
  for insert with check (created_by = auth.uid());

create policy "keanggotaan grup yang diikuti" on public.group_access
  for select using (public.is_member(group_id));

-- Telur dan ayam: saat membuat grup, pembuatnya belum menjadi anggota, sehingga
-- is_member() masih false dan ia tidak akan pernah bisa memasukkan dirinya
-- sendiri. Policy ini yang memutusnya — hanya untuk pembuat grup, hanya untuk
-- dirinya sendiri. Orang lain masuk lewat join_group().
create policy "pembuat grup masuk sendiri" on public.group_access
  for insert with check (
    user_id = auth.uid()
    and exists (select 1 from public.groups g where g.id = group_id and g.created_by = auth.uid())
  );

-- Tidak ada policy SELECT untuk undangan. Kode undangan hanya diperiksa di dalam
-- join_group(), sehingga tidak ada cara menebak atau menelusuri kode orang lain.
create policy "buat undangan untuk grup sendiri" on public.group_invites
  for insert with check (public.is_member(group_id) and created_by = auth.uid());

create policy "baca operasi grup yang diikuti" on public.ops
  for select using (public.is_member(group_id));
create policy "tulis operasi ke grup yang diikuti" on public.ops
  for insert with check (public.is_member(group_id));

-- PERHATIKAN YANG TIDAK ADA DI SINI: tidak ada policy UPDATE maupun DELETE untuk
-- tabel ops. Dengan RLS menyala dan tanpa policy, kedua perintah itu selalu
-- ditolak — siapa pun pemanggilnya, apa pun bug di aplikasinya. Sifat
-- append-only ditegakkan basis data, bukan sekadar oleh sopan santun klien.

-- ---------------------------------------------------------------------------
-- Bergabung lewat kode undangan
-- ---------------------------------------------------------------------------
--
-- security definer karena pemanggilnya justru belum menjadi anggota — ia belum
-- boleh membaca apa pun tentang grup ini sampai fungsi ini selesai.

create function public.join_group(invite_code text, claim_member_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  gid uuid;
begin
  select group_id into gid
    from public.group_invites
   where code = invite_code
     and expires_at > now();

  if gid is null then
    raise exception 'Kode undangan tidak berlaku atau sudah kedaluwarsa';
  end if;

  -- Memasukkan kode yang sama dua kali tidak boleh membuat kekacauan; ia hanya
  -- memperbarui anggota mana yang diklaim.
  insert into public.group_access (group_id, user_id, member_id)
  values (gid, auth.uid(), claim_member_id)
  on conflict (group_id, user_id) do update set member_id = excluded.member_id;

  return gid;
end;
$$;

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------
--
-- Realtime hanya dipakai sebagai PEMICU untuk menarik, bukan sebagai jalur data.
-- Kalau ia mati atau ada pesan yang terlewat, tarikan biasa saat aplikasi dibuka
-- tetap menutup semuanya. Sinkronisasi tidak boleh bergantung pada sesuatu yang
-- tidak menjamin pengiriman.

alter publication supabase_realtime add table public.ops;

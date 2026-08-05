-- Memeriksa apakah skema sudah terpasang lengkap.
--
-- Jalankan di SQL Editor. Kolom `status` harus berbunyi "ok" di SEMUA baris.
--
-- Versi pertama pemeriksaan ini hanya menghitung jumlah policy, dan itu
-- pemeriksaan yang lemah: sebelas policy yang salah akan lolos sama seperti
-- sebelas policy yang benar. Sekarang setiap objek yang diharapkan disebutkan
-- namanya satu per satu, sehingga hasilnya langsung memberi tahu apa yang perlu
-- diperbaiki alih-alih sekadar mengatakan ada yang kurang.

with harapan(jenis, nama, keterangan) as (
  values
    ('tabel', 'profiles',      'profil pengguna'),
    ('tabel', 'groups',        'grup + penghitung nomor urut'),
    ('tabel', 'group_access',  'siapa boleh membaca grup mana'),
    ('tabel', 'group_invites', 'kode undangan'),
    ('tabel', 'ops',           'log operasi'),

    ('fungsi', 'is_member',     'dipakai seluruh policy'),
    ('fungsi', 'join_group',    'bergabung lewat kode undangan'),
    ('fungsi', 'assign_op_seq', 'memberi nomor urut per grup'),

    ('trigger', 'ops_assign_seq', 'memanggil assign_op_seq sebelum insert'),

    ('policy', 'profil sendiri',                  'profiles: baca'),
    ('policy', 'buat profil sendiri',             'profiles: tulis'),
    ('policy', 'ubah profil sendiri',             'profiles: ubah'),
    ('policy', 'grup yang diikuti',               'groups: baca'),
    ('policy', 'buat grup sendiri',               'groups: tulis'),
    ('policy', 'keanggotaan grup yang diikuti',   'group_access: baca'),
    ('policy', 'perbarui keanggotaan sendiri',    'group_access: ubah  <- ditambahkan belakangan'),
    ('policy', 'pembuat grup masuk sendiri',      'group_access: tulis'),
    ('policy', 'buat undangan untuk grup sendiri','group_invites: tulis'),
    ('policy', 'baca operasi grup yang diikuti',  'ops: baca'),
    ('policy', 'tulis operasi ke grup yang diikuti','ops: tulis')
),
kenyataan(jenis, nama) as (
      select 'tabel', table_name::text
        from information_schema.tables
       where table_schema = 'public'
  union all
      select 'fungsi', routine_name::text
        from information_schema.routines
       where routine_schema = 'public'
  union all
      select 'trigger', trigger_name::text
        from information_schema.triggers
       where trigger_schema = 'public'
  union all
      select 'policy', policyname::text
        from pg_policies
       where schemaname = 'public'
)
select
  h.jenis,
  h.nama,
  h.keterangan,
  case when k.nama is null then 'HILANG - jalankan ulang 0001_init.sql' else 'ok' end as status
from harapan h
left join (select distinct jenis, nama from kenyataan) k
       on k.jenis = h.jenis and k.nama = h.nama

union all

-- Diperiksa TERBALIK: tabel ops tidak boleh punya policy UPDATE atau DELETE.
-- Justru ketiadaannya yang menegakkan sifat append-only, jadi yang perlu
-- dibuktikan adalah bahwa tidak ada seorang pun menambahkannya nanti.
select
  'jaminan',
  'ops append-only',
  'ops tidak boleh punya policy UPDATE/DELETE',
  case when (
    select count(*) from pg_policies
     where schemaname = 'public' and tablename = 'ops' and cmd in ('UPDATE','DELETE')
  ) = 0 then 'ok' else 'BAHAYA - ops bisa diubah' end

union all

select
  'jaminan',
  'realtime ops',
  'ops ikut dipublikasikan untuk realtime',
  case when (
    select count(*) from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'ops'
  ) = 1 then 'ok' else 'HILANG - jalankan ulang 0001_init.sql' end

order by 4 desc, 1, 2;

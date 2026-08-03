# 0005 — Nomor urut diberikan per grup lewat penghitung terkunci, bukan `bigserial`

**Status:** Berlaku · **Tanggal:** 2026-08-03

## Konteks

Klien menyinkronkan dengan menarik operasi yang `seq`-nya lebih besar dari kursor
yang ia simpan. Seluruh protokol bertumpu pada satu janji:

> Tidak akan pernah muncul operasi dengan nomor lebih kecil daripada nomor yang
> sudah pernah dilihat klien.

`bigserial` — pilihan yang paling wajar dan paling sering dipakai — **melanggar
janji itu.** Nomor diambil di luar transaksi, jadi dua penyisipan bersamaan bisa
mendapat 10 dan 11, lalu transaksi bernomor 11 selesai lebih dulu. Klien yang
kebetulan menarik tepat di antara keduanya akan melihat 11, menyetel kursornya ke
11, dan **tidak akan pernah melihat operasi 10.**

Yang membuat ini berbahaya bukan kemungkinannya, melainkan bentuk kegagalannya:
tidak ada pesan kesalahan, tidak ada kegagalan sinkronisasi, tidak ada yang
janggal di layar. Hanya satu pengeluaran yang diam-diam tidak pernah ada di salah
satu HP — dan saldo yang berbeda di antara dua orang tanpa siapa pun tahu kenapa.

## Keputusan

Nomor urut diambil dengan menaikkan penghitung `op_seq` di baris grup yang
bersangkutan, di dalam trigger `BEFORE INSERT`:

```sql
update public.groups set op_seq = op_seq + 1
 where id = new.group_id
returning op_seq into new.seq;
```

`UPDATE` mengunci baris grup itu, sehingga penyisipan lain ke grup yang sama
menunggu sampai transaksi ini selesai. Nomor jadi berurutan rapat, tanpa celah,
dan tidak pernah terlihat terbalik oleh klien mana pun.

Trigger juga selalu menimpa nilai `seq` yang dikirim klien: penomoran adalah
wewenang server, dan klien tidak boleh bisa memilih tempatnya sendiri dalam
urutan.

## Konsekuensi

**Yang didapat**

- Kursor sederhana berupa satu bilangan bulat menjadi benar-benar aman. Tidak
  perlu jendela tumpang tindih, penarikan ulang berkala, atau pelacakan celah.
- Nomor rapat tanpa celah juga membuat masalah mudah dilihat: melompatnya nomor
  berarti ada yang salah, bukan hal biasa.

**Yang dibayar**

- Penulisan ke satu grup menjadi berurutan. Untuk grup berisi lima anak kos, ini
  bukan ongkos sama sekali. Untuk grup berisi ribuan penulis serentak, ia akan
  menjadi leher botol — dan pada saat itu jawabannya bukan kembali ke
  `bigserial`, melainkan penomoran hibrida (mis. per-grup Lamport + urutan
  server) yang jauh lebih rumit.
- Baris grup menjadi titik panas untuk penulisan. Diterima dengan sadar.

**Yang ditolak**

*`bigserial` biasa* — alasannya di atas.
*Mengurutkan dengan `created_at`* — jam yang sama bisa dipakai dua baris, dan
klien tetap harus menangani seri; selain itu waktu commit tidak sama dengan waktu
`now()` dievaluasi, jadi masalah yang sama muncul dalam bentuk lain.

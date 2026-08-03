# 0001 — Menyinkronkan log operasi, bukan baris tabel

**Status:** Berlaku · **Tanggal:** 2026-08-03

## Konteks

Aplikasi ini harus bisa dipakai tanpa sinyal, lalu menyatu kembali ketika beberapa
HP kembali daring. Dua orang bisa mengubah pengeluaran yang sama saat sama-sama
offline.

Pendekatan yang lazim adalah menyinkronkan baris tabel: setiap baris punya
`updated_at`, dan yang paling baru menang. Masalahnya, "paling baru" ditentukan
oleh jam perangkat yang bisa salah setel, dan menimpa seluruh baris berarti
membuang perubahan orang lain pada field yang sebenarnya tidak bertabrakan.

## Keputusan

Yang disimpan dan disinkronkan adalah **operasi yang tak pernah berubah**, bukan
keadaan. Basis data lokal hanya punya satu tabel isi, `ops`. Seluruh daftar
anggota, pengeluaran, dan saldo dihitung dengan melipat (*fold*) log itu.

Urutan total ditentukan `seq` — bilangan bulat menaik yang dibuat Postgres, satu
deret per grup. Operasi yang masih tertahan di HP (`seq IS NULL`) selalu
ditempatkan paling akhir, dan otomatis pindah ke posisi benar begitu server
memberinya nomor.

## Konsekuensi

**Yang didapat**

- Mode pesawat bukan kasus khusus. Tidak ada satu pun cabang `if (online)` di
  jalur penulisan; menulis saat offline dan daring adalah kode yang sama persis.
- Pengiriman ulang aman tanpa usaha tambahan: id operasi dibuat di HP dan menjadi
  kunci idempotensi.
- Tidak mungkin ada tabel turunan yang melenceng dari log, karena tidak ada tabel
  turunan yang disimpan.
- Riwayat aktivitas ("Rian menambah Wifi · 2 jam lalu") didapat gratis.

**Yang dibayar**

- Setiap pembacaan melipat ulang seluruh log. Satu grup kos berisi ratusan operasi
  dan melipatnya di bawah satu milidetik, tapi ini **tidak akan menskala** ke
  puluhan ribu operasi tanpa materialisasi sebagai cache.
- Basis data hanya tumbuh, tidak pernah menyusut. Menghapus pengeluaran justru
  menambah baris. Suatu saat perlu pemadatan (*compaction*).
- Lebih sulit dipahami pengembang baru daripada tabel biasa. Sebagian besar ongkos
  keputusan ini adalah ongkos penjelasan, dan itulah sebagian alasan ADR ini ada.

**Yang ditolak**

*Last-write-wins per baris* — lebih sederhana, tapi membuang perubahan yang tidak
bertabrakan dan bergantung pada jam perangkat.
*CRDT penuh* — menyelesaikan lebih banyak masalah daripada yang kita punya, dengan
ongkos pemahaman yang jauh lebih besar.

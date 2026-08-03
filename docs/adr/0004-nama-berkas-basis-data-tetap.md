# 0004 — Nama berkas basis data tidak ikut berganti nama

**Status:** Berlaku · **Tanggal:** 2026-08-03

## Konteks

Produk berganti nama dari *Patungan* menjadi **share.yow**. Semua yang terlihat
pengguna ikut berubah: nama aplikasi, slug, skema tautan, nama paket. Godaannya
adalah menyeragamkan sampai ke nama berkas penyimpanan — `patungan.db` menjadi
`shareyow.db`.

## Keputusan

Nama berkasnya tetap **`patungan.db`**.

`SQLiteProvider` membuka basis data berdasarkan nama berkas. Mengganti namanya
berarti aplikasi membuka berkas baru yang kosong, sementara berkas lama tetap ada
di perangkat tanpa pernah dibaca lagi. Bagi pengguna, itu terlihat persis seperti
kehilangan seluruh data — dan pada perangkat pengembang, data itu adalah
pengeluaran kos yang sungguhan.

Menyeragamkan nama berkas yang tidak pernah dilihat siapa pun adalah keuntungan
kosmetik. Menukarnya dengan risiko kehilangan data adalah pertukaran yang buruk.

## Konsekuensi

**Yang dibayar**

- Ada ketidakcocokan nama antara produk dan penyimpanannya. Seseorang yang membaca
  kode akan bertanya-tanya — dan ADR ini adalah jawabannya.

**Kapan ini ditinjau ulang**

Kalau suatu saat memang perlu diganti, caranya bukan mengganti nama begitu saja,
melainkan: buka berkas lama, salin isinya ke berkas baru di dalam satu transaksi,
verifikasi jumlah barisnya cocok, baru tandai yang lama boleh dihapus. Sampai
pekerjaan itu benar-benar dibutuhkan, nama lama dipertahankan.

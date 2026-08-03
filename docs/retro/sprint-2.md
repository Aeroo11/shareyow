# Sprint 2 — kedalaman fitur

**Must:** mode pembagian lengkap. ✅ Tercapai, plus ubah pengeluaran, kategori,
tanggal, dan riwayat aktivitas.

1. **Yang lebih cepat dari perkiraan:** mode pembagian. Diperkirakan bagian
   terberat sprint ini, ternyata selesai tanpa menyentuh satu baris pun di
   `core/split.ts` — logikanya sudah lengkap dan sudah diuji sejak Sprint 0.

2. **Kenapa:** karena aturan perhitungan ditulis lebih dulu, terpisah dari layar,
   dan diuji sendiri. Yang tersisa di sprint ini hanya menerjemahkan apa yang
   diketik menjadi bentuk yang sudah dimengerti `computeShares`. Hal yang sama
   terjadi pada riwayat aktivitas: ia tidak menambah tabel, kolom, atau penulisan
   apa pun — hanya membaca log operasi yang memang sudah harus ada.

3. **Yang diubah sprint depan:** teruskan urutan itu untuk sinkronisasi — tulis
   dan uji mesin sinkronisasinya sebagai fungsi murni terhadap data palsu dulu,
   baru sambungkan ke Supabase. Sprint 3 adalah yang paling mungkin meleber, dan
   inilah cara mengecilkan bagian yang hanya bisa diuji lewat jaringan.

# Sprint 1 — rombak tampilan

**Must:** semua layar memakai bahasa visual baru. ✅ Tercapai.

1. **Yang lebih lambat dari perkiraan:** memasang Reanimated. Versi 4 menuntut
   `react-native-worklets` sebagai peer dan satu babel plugin lagi, dan tidak
   satu pun terpasang otomatis lewat `expo install`.

2. **Kenapa:** pustaka dipilih dari rencana, bukan dari kebutuhan. Gerak yang
   benar-benar diperlukan hanya tiga — skala tekan, baris masuk berurutan, denyut
   saat angka berubah — dan ketiganya murni transform serta opacity, yang sudah
   dijalankan `Animated` bawaan di thread native lewat `useNativeDriver`.
   Reanimated dicopot lagi; hasilnya di mata pengguna sama persis, dengan satu
   dependensi dan satu babel plugin lebih sedikit.

3. **Yang diubah sprint depan:** sebelum memasang pustaka apa pun, tulis dulu satu
   kalimat tentang apa yang tidak bisa dikerjakan tanpanya. Kalau kalimat itu
   sulit ditulis, pustakanya belum dibutuhkan.

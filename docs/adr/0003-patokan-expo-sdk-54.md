# 0003 — Dipatok ke Expo SDK 54, bukan yang terbaru

**Status:** Berlaku · **Tanggal:** 2026-08-03

## Konteks

Proyek dibuat dengan SDK 57 (terbaru saat itu). Aplikasinya menolak dibuka di
iPhone pengembang: *"Project is incompatible with this version of Expo Go"* —
Expo Go di perangkat itu hanya mendukung sampai SDK 54.

## Keputusan

Menurunkan seluruh proyek ke SDK 54.

Yang mengalah adalah proyeknya, bukan perangkatnya. Tolok ukur keberhasilan
proyek ini adalah **dipakai sehari-hari**, dan aplikasi yang tidak bisa dijalankan
di HP sendiri tidak akan pernah dipakai. SDK yang lebih baru tidak memberi apa pun
yang sepadan dengan itu.

Kebetulan yang menguntungkan: nol baris kode aplikasi perlu diubah. Semua API yang
dipakai — `SQLiteProvider`, `withExclusiveTransactionAsync`, `Crypto.randomUUID`,
`Stack` dari expo-router — sudah ada jauh sebelum SDK 54.

## Konsekuensi

**Yang dibayar**

- Tertinggal dari fitur dan perbaikan SDK terbaru.
- Pustaka pihak ketiga yang hanya mendukung SDK terbaru tidak bisa dipakai.

**Kapan ini ditinjau ulang**

Ketika proyek pindah dari Expo Go ke *development build* (rencana Sprint 6).
Development build memuat SDK-nya sendiri dan tidak lagi dibatasi versi Expo Go di
App Store, sehingga patokan ini menjadi tidak perlu.

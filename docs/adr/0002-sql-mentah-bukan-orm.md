# 0002 — SQL mentah, bukan ORM

**Status:** Berlaku · **Tanggal:** 2026-08-03

## Konteks

Rencana awal memakai Drizzle ORM di atas `expo-sqlite`, dengan alasan tipe yang
aman dan migrasi yang tertata.

## Keputusan

Memakai SQL mentah lewat API `expo-sqlite`, dengan migrasi manual berbasis
`PRAGMA user_version`.

Alasannya berubah setelah [ADR 0001](0001-log-operasi-bukan-tabel.md) diambil:
karena seluruh keadaan dimaterialisasi dari log operasi, skemanya hanya berisi
satu tabel isi dan dua tabel penunjang. Tidak ada relasi rumit, tidak ada kueri
gabungan bercabang — tidak ada satu pun hal yang biasanya membuat ORM sepadan.

Sementara ongkosnya nyata: satu babel plugin lagi, satu alat baris perintah lagi
(`drizzle-kit`), dan satu lagi hal yang bisa patah di dalam Expo Go.

## Konsekuensi

**Yang didapat**

- Lebih sedikit bagian yang bisa rusak, dan `SQLiteProvider` + `onInit` adalah
  jalur yang paling banyak didokumentasikan Expo.
- Setiap kueri terlihat apa adanya di kode, tanpa lapisan penerjemah.

**Yang dibayar**

- Baris hasil kueri diketik dengan tangan (`interface OpRow`). Kalau skema berubah
  dan tipenya lupa diubah, TypeScript tidak akan protes. Ini risiko nyata, dan
  yang menahannya adalah test integrasi di `src/db/__tests__/` yang berjalan
  terhadap SQLite sungguhan lewat `node:sqlite`.
- Migrasi ditulis manual dan wajib diuji berulang.

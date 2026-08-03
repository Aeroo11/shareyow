# Architecture Decision Records

Catatan keputusan arsitektur. Satu berkas per keputusan, bernomor urut, tidak
pernah dihapus — kalau sebuah keputusan dibatalkan, ADR lamanya ditandai
*Digantikan* dan ADR baru menjelaskan kenapa.

Formatnya sengaja pendek: **Konteks → Keputusan → Konsekuensi.** Bagian
konsekuensi wajib memuat yang merugikan. ADR yang hanya menyebut keuntungan
adalah iklan, bukan catatan keputusan, dan tidak berguna bagi siapa pun yang
membacanya enam bulan kemudian — termasuk penulisnya sendiri.

| No | Keputusan | Status |
|---|---|---|
| [0001](0001-log-operasi-bukan-tabel.md) | Menyinkronkan log operasi, bukan baris tabel | Berlaku |
| [0002](0002-sql-mentah-bukan-orm.md) | SQL mentah, bukan ORM | Berlaku |
| [0003](0003-patokan-expo-sdk-54.md) | Dipatok ke Expo SDK 54 | Berlaku |
| [0004](0004-nama-berkas-basis-data-tetap.md) | Nama berkas basis data tidak ikut berganti nama | Berlaku |

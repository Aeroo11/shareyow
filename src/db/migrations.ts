/**
 * Migrasi skema SQLite.
 *
 * Perhatikan yang TIDAK ada di sini: tabel `expenses`, `members`, `settlements`.
 * Satu-satunya yang disimpan aplikasi ini adalah log operasi. Seluruh daftar
 * pengeluaran, anggota, dan saldo dihitung ulang dengan melipat log itu
 * (lihat src/core/ops.ts).
 *
 * Kelihatannya boros, tapi konsekuensinya besar: tidak mungkin ada keadaan di
 * mana tabel turunan tidak cocok dengan log, karena tidak ada tabel turunan
 * yang disimpan. Satu grup kos berisi ratusan operasi — melipatnya makan waktu
 * di bawah satu milidetik. Kalau suatu hari jumlahnya jadi puluhan ribu,
 * materialisasi bisa ditambahkan sebagai cache, bukan sebagai sumber kebenaran.
 */

import type { SQLiteDatabase } from 'expo-sqlite';

/** Naikkan angka ini setiap menambah migrasi baru di bawah. */
const LATEST_VERSION = 1;

export async function migrate(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;

  if (version >= LATEST_VERSION) return;

  if (version === 0) {
    await db.execAsync(`
      PRAGMA journal_mode = WAL;

      CREATE TABLE ops (
        id         TEXT PRIMARY KEY,
        group_id   TEXT    NOT NULL,
        -- Nomor urut dari server. NULL berarti operasi ini masih hanya ada di HP
        -- ini; kolom yang sama sekaligus menjadi antrean kirim (outbox).
        seq        INTEGER,
        type       TEXT    NOT NULL,
        author_id  TEXT    NOT NULL,
        client_ts  INTEGER NOT NULL,
        payload    TEXT    NOT NULL
      );

      CREATE INDEX ops_by_group ON ops (group_id, seq);
      CREATE INDEX ops_pending  ON ops (client_ts) WHERE seq IS NULL;

      -- Sampai nomor urut berapa grup ini sudah ditarik dari server.
      CREATE TABLE sync_cursor (
        group_id TEXT PRIMARY KEY,
        last_seq INTEGER NOT NULL DEFAULT 0
      );

      -- Anggota mana yang "aku" di grup ini. Dipisah dari log karena ini urusan
      -- perangkat ini saja, tidak perlu diketahui anggota lain.
      CREATE TABLE group_identity (
        group_id  TEXT PRIMARY KEY,
        member_id TEXT NOT NULL
      );
    `);
    version = 1;
  }

  await db.execAsync(`PRAGMA user_version = ${LATEST_VERSION}`);
}

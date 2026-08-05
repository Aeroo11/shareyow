/**
 * Satu-satunya lapisan yang menyentuh SQLite.
 *
 * Menulis selalu lewat appendOps(): operasi masuk ke log, dan itu saja. Tidak
 * ada UPDATE, tidak ada DELETE — menghapus pengeluaran pun berarti menambahkan
 * operasi "expense.delete". Membaca selalu lewat loadGroup(): seluruh operasi
 * grup dilipat menjadi state.
 */

import type { SQLiteDatabase } from 'expo-sqlite';

import { fold, type GroupState, type Op } from '../core/ops';

/** Sebagian kecil SQLiteDatabase yang benar-benar dipakai di dalam transaksi. */
type TransactionRunner = Pick<SQLiteDatabase, 'runAsync'>;

/**
 * `withExclusiveTransactionAsync` melempar error seketika di web. Sekali gagal,
 * ia tidak akan pernah berhasil pada sesi ini — jadi jawabannya diingat alih-alih
 * dicoba ulang di setiap penulisan.
 */
let exclusiveSupported = true;

/**
 * Menjalankan beberapa penulisan sebagai satu transaksi.
 *
 * Versi eksklusif memakai koneksi terpisah dan menyerialkan seluruh penulisan,
 * jadi ia yang dipakai kalau tersedia. Di browser ia tidak ada, dan yang tersisa
 * adalah `withTransactionAsync` — tetap memberi BEGIN/COMMIT, tapi bisa disela
 * kueri lain pada koneksi yang sama.
 *
 * Dukungan itu dideteksi dari perilakunya, bukan dari `Platform.OS`. Alasannya
 * bukan gaya: berkas ini diuji terhadap SQLite sungguhan lewat `node:sqlite`,
 * dan mengimpor react-native ke sini akan mematikan seluruh test itu. Batas
 * "lapisan penyimpanan tidak tahu ia sedang berjalan di mana" yang membuatnya
 * bisa diuji tanpa perangkat sama sekali.
 *
 * Aman dicoba lalu ditarik mundur karena error-nya dilempar di baris pertama,
 * sebelum satu pun SQL dijalankan — tidak ada pekerjaan separuh jadi yang
 * ditinggalkan.
 *
 * Konsekuensi kehilangan eksklusivitas di web sudah ditimbang: yang bisa terjadi
 * hanyalah sebuah pembacaan melihat satu batch yang baru separuh masuk, dan itu
 * memperbaiki dirinya sendiri pada penyegaran berikutnya. Yang tidak mungkin
 * terjadi adalah operasi ganda — kunci utama pada `ops.id` ditambah
 * `INSERT OR IGNORE` yang menjaganya, bukan tingkat isolasi transaksinya.
 */
async function inTransaction(
  db: SQLiteDatabase,
  task: (tx: TransactionRunner) => Promise<void>,
): Promise<void> {
  if (exclusiveSupported) {
    try {
      await db.withExclusiveTransactionAsync(async (txn) => {
        await task(txn);
      });
      return;
    } catch (error) {
      if (!isUnsupported(error)) throw error;
      exclusiveSupported = false;
    }
  }

  await db.withTransactionAsync(async () => {
    await task(db);
  });
}

function isUnsupported(error: unknown): boolean {
  return error instanceof Error && error.message.includes('not supported on web');
}

interface OpRow {
  id: string;
  group_id: string;
  seq: number | null;
  type: string;
  author_id: string;
  client_ts: number;
  payload: string;
}

function rowToOp(row: OpRow): Op {
  return {
    id: row.id,
    groupId: row.group_id,
    seq: row.seq,
    type: row.type,
    authorId: row.author_id,
    clientTs: row.client_ts,
    payload: JSON.parse(row.payload),
  } as Op;
}

/**
 * Menyimpan operasi ke log. Satu transaksi untuk seluruh kumpulan, sehingga
 * aplikasi yang mati di tengah proses tidak meninggalkan setengah perubahan.
 *
 * `INSERT OR IGNORE` bukan sekadar kehati-hatian: id operasi dibuat di HP dan
 * dipakai sebagai kunci idempotensi. Operasi yang sama boleh datang berkali-kali
 * — dari pengiriman ulang, dari tarikan yang tumpang tindih — dan tetap hanya
 * tersimpan sekali.
 */
export async function appendOps(db: SQLiteDatabase, ops: Op[]): Promise<void> {
  if (ops.length === 0) return;

  await inTransaction(db, async (txn) => {
    for (const op of ops) {
      await txn.runAsync(
        `INSERT OR IGNORE INTO ops (id, group_id, seq, type, author_id, client_ts, payload)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        op.id,
        op.groupId,
        op.seq,
        op.type,
        op.authorId,
        op.clientTs,
        JSON.stringify(op.payload),
      );
    }
  });
}

/** Menandai operasi sudah diterima server, sekaligus mencatat nomor urutnya. */
export async function markSynced(
  db: SQLiteDatabase,
  acks: Array<{ id: string; seq: number }>,
): Promise<void> {
  if (acks.length === 0) return;

  await inTransaction(db, async (txn) => {
    for (const ack of acks) {
      await txn.runAsync('UPDATE ops SET seq = ? WHERE id = ? AND seq IS NULL', ack.seq, ack.id);
    }
  });
}

/** Operasi yang belum pernah sampai ke server — inilah antrean kirimnya. */
export async function pendingOps(db: SQLiteDatabase): Promise<Op[]> {
  const rows = await db.getAllAsync<OpRow>(
    'SELECT * FROM ops WHERE seq IS NULL ORDER BY client_ts, id',
  );
  return rows.map(rowToOp);
}

export async function countPendingOps(db: SQLiteDatabase): Promise<number> {
  const row = await db.getFirstAsync<{ n: number }>(
    'SELECT COUNT(*) AS n FROM ops WHERE seq IS NULL',
  );
  return row?.n ?? 0;
}

/**
 * Seluruh operasi sebuah grup, mentah dan belum dilipat. Dipakai layar riwayat
 * aktivitas — yang memang tidak butuh keadaan akhir, melainkan perjalanannya.
 */
export async function loadOps(db: SQLiteDatabase, groupId: string): Promise<Op[]> {
  const rows = await db.getAllAsync<OpRow>('SELECT * FROM ops WHERE group_id = ?', groupId);
  return rows.map(rowToOp);
}

export async function loadGroup(db: SQLiteDatabase, groupId: string): Promise<GroupState | null> {
  const rows = await db.getAllAsync<OpRow>('SELECT * FROM ops WHERE group_id = ?', groupId);
  if (rows.length === 0) return null;
  return fold(groupId, rows.map(rowToOp));
}

export async function loadAllGroups(db: SQLiteDatabase): Promise<GroupState[]> {
  const rows = await db.getAllAsync<OpRow>('SELECT * FROM ops');

  const byGroup = new Map<string, Op[]>();
  for (const row of rows) {
    const op = rowToOp(row);
    const bucket = byGroup.get(op.groupId);
    if (bucket) bucket.push(op);
    else byGroup.set(op.groupId, [op]);
  }

  return [...byGroup.entries()]
    .map(([groupId, ops]) => fold(groupId, ops))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

/** Sampai nomor urut berapa grup ini sudah ditarik dari server. */
export async function getCursor(db: SQLiteDatabase, groupId: string): Promise<number> {
  const row = await db.getFirstAsync<{ last_seq: number }>(
    'SELECT last_seq FROM sync_cursor WHERE group_id = ?',
    groupId,
  );
  return row?.last_seq ?? 0;
}

export async function setCursor(
  db: SQLiteDatabase,
  groupId: string,
  lastSeq: number,
): Promise<void> {
  // `MAX` menjaga kursor tidak pernah mundur. Dua penyinkronan yang berjalan
  // bersamaan bisa selesai tidak berurutan, dan kursor yang mundur berarti
  // menarik ulang operasi lama — tidak merusak, tapi membuang kuota dan waktu.
  await db.runAsync(
    `INSERT INTO sync_cursor (group_id, last_seq) VALUES (?, ?)
     ON CONFLICT (group_id) DO UPDATE SET last_seq = MAX(last_seq, excluded.last_seq)`,
    groupId,
    lastSeq,
  );
}

export async function getIdentity(db: SQLiteDatabase, groupId: string): Promise<string | null> {
  const row = await db.getFirstAsync<{ member_id: string }>(
    'SELECT member_id FROM group_identity WHERE group_id = ?',
    groupId,
  );
  return row?.member_id ?? null;
}

export async function setIdentity(
  db: SQLiteDatabase,
  groupId: string,
  memberId: string,
): Promise<void> {
  await db.runAsync(
    'INSERT OR REPLACE INTO group_identity (group_id, member_id) VALUES (?, ?)',
    groupId,
    memberId,
  );
}

/** Semua id anggota "aku", satu per grup — dipakai layar utama untuk ringkasan. */
export async function getAllIdentities(db: SQLiteDatabase): Promise<Map<string, string>> {
  const rows = await db.getAllAsync<{ group_id: string; member_id: string }>(
    'SELECT group_id, member_id FROM group_identity',
  );
  return new Map(rows.map((r) => [r.group_id, r.member_id]));
}

/**
 * Mesin sinkronisasi — bagian yang berpikir, tanpa satu pun panggilan jaringan.
 *
 * Seluruh keputusan "apa yang harus dikirim" dan "apa yang harus disimpan"
 * dihitung di sini sebagai fungsi murni. Yang tersisa untuk lapisan jaringan
 * hanyalah mengantar dan mengambil. Pemisahan ini disengaja: bagian yang hanya
 * bisa diuji dengan koneksi sungguhan dibuat sekecil mungkin, sementara bagian
 * yang menentukan benar-salahnya bisa diuji ribuan kali dalam hitungan milidetik.
 *
 * Protokolnya sesederhana mungkin, dan itu memang buah dari ADR 0001:
 *
 *   dorong  — kirim semua operasi yang `seq`-nya masih null
 *   tarik   — ambil operasi grup ini yang `seq`-nya lebih besar dari kursor
 *
 * Tidak ada resolusi konflik, tidak ada perbandingan versi, tidak ada penggabungan
 * tiga arah. Operasi tidak pernah berubah setelah ditulis, jadi tidak ada yang
 * bisa bertabrakan — yang perlu disepakati cuma urutannya, dan itu ditentukan
 * server lewat `seq`.
 */

import type { Op } from './ops';

export interface Ack {
  id: string;
  seq: number;
}

/**
 * Operasi yang belum pernah sampai ke server, dalam urutan yang seharusnya
 * dikirim. Urutan ini penting: `expense.add` harus tiba sebelum `expense.edit`
 * yang mengubahnya, dan urutan pembuatan di perangkat inilah yang menjaminnya.
 */
export function opsToPush(localOps: Op[]): Op[] {
  return localOps
    .filter((op) => op.seq === null)
    .sort((a, b) => a.clientTs - b.clientTs || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export interface MergePlan {
  /** Operasi yang belum pernah dilihat perangkat ini. */
  insert: Op[];
  /** Operasi milik sendiri yang kembali dari server, kini sudah bernomor. */
  ack: Ack[];
  /** Sampai nomor berapa grup ini sudah tertarik. */
  nextCursor: number;
}

/**
 * Menghitung apa yang harus dilakukan terhadap operasi yang baru ditarik.
 *
 * Tiga kemungkinan untuk tiap operasi yang datang, dan ketiganya harus dibedakan:
 *
 *   - belum pernah dilihat            → simpan
 *   - sudah ada tapi masih tanpa nomor → operasi kita sendiri yang kembali;
 *                                        cukup catat nomornya, jangan digandakan
 *   - sudah ada dan sudah bernomor    → tarikan yang tumpang tindih; abaikan
 *
 * Yang kedua itu yang paling gampang terlewat, dan akibatnya paling parah:
 * memperlakukannya sebagai operasi baru akan menggandakan setiap pengeluaran
 * yang pernah dikirim perangkat ini.
 */
export function planMerge(localOps: Op[], pulled: Op[], cursor: number): MergePlan {
  const byId = new Map(localOps.map((op) => [op.id, op]));

  const insert: Op[] = [];
  const ack: Ack[] = [];
  let nextCursor = cursor;

  for (const incoming of pulled) {
    if (incoming.seq === null) {
      // Server selalu memberi nomor sebelum menyimpan. Kalau ini pernah terjadi,
      // ada yang salah di sisi server dan lebih baik ketahuan seketika daripada
      // diam-diam merusak urutan.
      throw new Error(`operasi ${incoming.id} datang dari server tanpa nomor urut`);
    }

    nextCursor = Math.max(nextCursor, incoming.seq);

    const existing = byId.get(incoming.id);
    if (!existing) {
      insert.push(incoming);
    } else if (existing.seq === null) {
      ack.push({ id: incoming.id, seq: incoming.seq });
    }
  }

  return { insert, ack, nextCursor };
}

/**
 * Menerapkan hasil dorongan ke salinan operasi di memori. Dipakai test dan
 * lapisan penyimpanan memakai jalur SQL-nya sendiri, tapi aturannya sama:
 * nomor yang sudah ada tidak boleh ditimpa.
 */
export function applyAcks(localOps: Op[], acks: Ack[]): Op[] {
  const seqById = new Map(acks.map((a) => [a.id, a.seq]));
  return localOps.map((op) =>
    op.seq === null && seqById.has(op.id) ? { ...op, seq: seqById.get(op.id)! } : op,
  );
}

/** Ringkasan untuk penanda status di layar. */
export interface SyncStatus {
  pendingCount: number;
  cursor: number;
}

export function statusOf(localOps: Op[], cursor: number): SyncStatus {
  return { pendingCount: opsToPush(localOps).length, cursor };
}

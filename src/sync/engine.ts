/**
 * Menyambungkan mesin sinkronisasi yang murni dengan penyimpanan lokal dan
 * jaringan. Berkas ini nyaris tidak mengambil keputusan sendiri — ia menjalankan
 * urutan langkah, dan setiap langkahnya memanggil sesuatu yang sudah diuji.
 */

import type { SQLiteDatabase } from 'expo-sqlite';

import { fold } from '../core/ops';
import { applyAcks, opsToPush, planMerge } from '../core/sync';
import { bumpRevision } from '../db/live';
import {
  appendOps,
  getCursor,
  getIdentity,
  loadOps,
  markSynced,
  setCursor,
} from '../db/repository';
import { SupabaseTransport } from './transport';

export interface SyncOutcome {
  groupId: string;
  pushed: number;
  pulled: number;
  cursor: number;
}

export async function syncGroup(
  db: SQLiteDatabase,
  transport: SupabaseTransport,
  groupId: string,
): Promise<SyncOutcome> {
  let localOps = await loadOps(db, groupId);
  if (localOps.length === 0) return { groupId, pushed: 0, pulled: 0, cursor: 0 };

  const state = fold(groupId, localOps);
  const myMemberId = await getIdentity(db, groupId);

  // Grup dibuat di HP jauh sebelum ada akun — itu memang inti produknya. Barisnya
  // di server baru dibuat sekarang, saat sinkronisasi pertama kali berjalan.
  await transport.ensureGroup({
    groupId,
    name: state.name,
    myMemberId: myMemberId ?? groupId,
  });

  const pending = opsToPush(localOps);
  if (pending.length > 0) {
    const acks = await transport.push(pending);
    await markSynced(db, acks);
    localOps = applyAcks(localOps, acks);
  }

  const cursor = await getCursor(db, groupId);
  const pulled = await transport.pull(groupId, cursor);
  const plan = planMerge(localOps, pulled, cursor);

  if (plan.insert.length > 0) await appendOps(db, plan.insert);
  if (plan.ack.length > 0) await markSynced(db, plan.ack);
  if (plan.nextCursor !== cursor) await setCursor(db, groupId, plan.nextCursor);

  // Satu kali saja di akhir, bukan per langkah: layar tidak perlu berkedip tiga
  // kali untuk satu penyinkronan.
  if (plan.insert.length > 0 || plan.ack.length > 0 || pending.length > 0) bumpRevision();

  return { groupId, pushed: pending.length, pulled: plan.insert.length, cursor: plan.nextCursor };
}

export async function syncAllGroups(
  db: SQLiteDatabase,
  transport: SupabaseTransport,
): Promise<SyncOutcome[]> {
  const rows = await db.getAllAsync<{ group_id: string }>(
    'SELECT DISTINCT group_id FROM ops',
  );

  const outcomes: SyncOutcome[] = [];
  for (const row of rows) {
    // Berurutan, bukan bersamaan. Satu grup yang gagal tidak boleh menghentikan
    // yang lain, dan menyinkron lima grup sekaligus tidak mempercepat apa pun
    // pada koneksi seluler.
    outcomes.push(await syncGroup(db, transport, row.group_id));
  }
  return outcomes;
}

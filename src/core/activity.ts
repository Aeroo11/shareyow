/**
 * Riwayat aktivitas — "Rian menambah Wifi bulanan · 2 jam lalu".
 *
 * Fitur ini tidak menambah satu pun tabel, kolom, atau penulisan baru. Ia hanya
 * membaca log operasi yang memang sudah harus ada untuk sinkronisasi, lalu
 * menerjemahkan tiap operasi menjadi satu kalimat.
 *
 * Ini konsekuensi menyenangkan dari keputusan di ADR 0001. Kalau yang disimpan
 * adalah keadaan (baris tabel), riwayat harus dicatat terpisah — dan catatan
 * terpisah itu akan melenceng dari kenyataan cepat atau lambat. Karena yang
 * disimpan adalah operasi, riwayatnya *adalah* datanya.
 */

import type { Rupiah } from './money';
import { compareOps, type GroupState, type Op } from './ops';

export interface ActivityEntry {
  id: string;
  at: number;
  actor: string;
  /** Kalimatnya, tanpa nama pelaku di depan. */
  text: string;
  amount?: Rupiah;
  icon: string;
  /** Belum pernah sampai ke server — ditandai supaya jelas ia masih di HP ini. */
  pending: boolean;
}

export function describeOps(state: GroupState, ops: Op[]): ActivityEntry[] {
  return [...ops]
    .sort((a, b) => compareOps(b, a)) // terbaru di atas
    .map((op) => describeOp(state, op))
    .filter((entry): entry is ActivityEntry => entry !== null);
}

function describeOp(state: GroupState, op: Op): ActivityEntry | null {
  const base = {
    id: op.id,
    at: op.clientTs,
    actor: state.members.get(op.authorId)?.displayName ?? 'Seseorang',
    pending: op.seq === null,
  };

  const nameOf = (id: string) => state.members.get(id)?.displayName ?? 'seseorang';
  const expenseName = (id: string) => state.expenses.get(id)?.description ?? 'sebuah pengeluaran';

  switch (op.type) {
    case 'group.create':
      return { ...base, icon: 'sparkles-outline', text: `membuat grup ${op.payload.name}` };

    case 'member.add':
      return { ...base, icon: 'person-add-outline', text: `menambahkan ${op.payload.displayName}` };

    case 'member.rename':
      return {
        ...base,
        icon: 'create-outline',
        text: `mengganti sebuah nama menjadi ${op.payload.displayName}`,
      };

    case 'member.remove':
      return {
        ...base,
        icon: 'person-remove-outline',
        text: `mengeluarkan ${nameOf(op.payload.memberId)}`,
      };

    case 'expense.add':
      return {
        ...base,
        icon: 'add-circle-outline',
        text: `mencatat ${op.payload.description}`,
        amount: op.payload.total,
      };

    case 'expense.edit':
      return {
        ...base,
        icon: 'create-outline',
        text: `mengubah ${expenseName(op.payload.expenseId)}`,
        // Nominal hanya disebut kalau memang nominalnya yang diubah — menyebut
        // angka pada perubahan keterangan justru menyesatkan.
        amount: op.payload.total,
      };

    case 'expense.delete':
      return {
        ...base,
        icon: 'trash-outline',
        text: `menghapus ${expenseName(op.payload.expenseId)}`,
      };

    case 'settlement.add':
      return {
        ...base,
        icon: 'checkmark-circle-outline',
        text: `menandai ${nameOf(op.payload.fromId)} → ${nameOf(op.payload.toId)} sudah dibayar`,
        amount: op.payload.amount,
      };

    case 'settlement.delete':
      return { ...base, icon: 'close-circle-outline', text: 'membatalkan sebuah pelunasan' };

    default:
      // Operasi dari versi aplikasi yang lebih baru: lebih baik disembunyikan
      // daripada ditampilkan sebagai baris kosong yang membingungkan.
      return null;
  }
}

/** "baru saja", "2 jam lalu", "3 hari lalu". */
export function timeAgo(at: number, now: number): string {
  const seconds = Math.max(0, Math.floor((now - at) / 1000));
  if (seconds < 60) return 'baru saja';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} menit lalu`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} hari lalu`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months} bulan lalu`;

  return `${Math.floor(months / 12)} tahun lalu`;
}

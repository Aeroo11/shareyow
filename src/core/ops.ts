/**
 * Log operasi — inti dari sifat offline-first aplikasi ini.
 *
 * Aplikasi ini tidak pernah menyinkronkan baris tabel. Yang disinkronkan adalah
 * operasi yang sekali ditulis tidak pernah berubah: "tambah pengeluaran",
 * "ubah pengeluaran", "hapus pengeluaran". Tabel yang dipakai layar hanyalah
 * hasil lipatan (fold) seluruh operasi.
 *
 * Kenapa repot-repot begitu?
 *
 * Kalau yang disinkronkan adalah baris, dua HP yang mengubah pengeluaran yang
 * sama saat offline akan bertabrakan, dan kita harus memilih pemenang tanpa tahu
 * apa yang sebenarnya terjadi. Kalau yang disinkronkan adalah operasi, tidak ada
 * yang bertabrakan — keduanya benar, keduanya tersimpan, dan urutannya ditentukan
 * oleh nomor urut dari server. Menulis saat offline dan saat online jadi
 * benar-benar kode yang sama; bedanya cuma kapan antrean kirim terkuras.
 *
 * Dua sifat yang diuji di __tests__/ops.test.ts:
 *   - deterministik: kumpulan operasi yang sama selalu menghasilkan state yang sama
 *   - idempoten: operasi yang sama masuk dua kali tidak mengubah apa pun
 */

import type { Rupiah } from './money';
import type { MemberId, SplitMode } from './split';

export interface ExpenseFields {
  description: string;
  total: Rupiah;
  payerId: MemberId;
  participants: MemberId[];
  mode: SplitMode;
  /** Kapan pengeluarannya terjadi (epoch ms) — bisa berbeda dari kapan dicatat. */
  occurredAt: number;
}

type Payloads = {
  'group.create': { name: string; currency: string };
  'member.add': { memberId: MemberId; displayName: string };
  'member.rename': { memberId: MemberId; displayName: string };
  'member.remove': { memberId: MemberId };
  'expense.add': { expenseId: string } & ExpenseFields;
  /** Hanya field yang diisi yang berubah — inilah yang membuat "last-op-wins" berlaku per field. */
  'expense.edit': { expenseId: string } & Partial<ExpenseFields>;
  'expense.delete': { expenseId: string };
  'settlement.add': {
    settlementId: string;
    fromId: MemberId;
    toId: MemberId;
    amount: Rupiah;
    occurredAt: number;
    note?: string;
  };
  'settlement.delete': { settlementId: string };
};

export type OpType = keyof Payloads;

export type Op = {
  [T in OpType]: {
    /** UUID. Sekaligus kunci idempotensi: operasi dengan id sama hanya berlaku sekali. */
    id: string;
    groupId: string;
    type: T;
    /** Siapa yang melakukan — id anggota, bukan id akun. */
    authorId: MemberId;
    /** Jam perangkat saat operasi dibuat. Tidak dipercaya untuk urutan lintas perangkat. */
    clientTs: number;
    /**
     * Nomor urut dari server, satu deret per grup. `null` berarti operasi ini
     * masih ada di HP dan belum pernah sampai ke server.
     */
    seq: number | null;
    payload: Payloads[T];
  };
}[OpType];

export interface Member {
  id: MemberId;
  displayName: string;
  removed: boolean;
}

export interface Expense extends ExpenseFields {
  id: string;
  deleted: boolean;
  createdAt: number;
}

export interface Settlement {
  id: string;
  fromId: MemberId;
  toId: MemberId;
  amount: Rupiah;
  occurredAt: number;
  note?: string;
  deleted: boolean;
}

export interface GroupState {
  id: string;
  name: string;
  currency: string;
  members: Map<MemberId, Member>;
  expenses: Map<string, Expense>;
  settlements: Map<string, Settlement>;
}

/**
 * Urutan total dan deterministik.
 *
 * Operasi yang sudah dikenal server diurutkan berdasarkan `seq` — satu deret
 * bilangan bulat menaik yang dibuat Postgres, jadi tidak ada seri dan tidak ada
 * ketergantungan pada jam perangkat yang bisa saja salah setel.
 *
 * Operasi yang masih tertahan di HP (`seq === null`) selalu ditempatkan paling
 * akhir: dari sudut pandang HP ini, itu memang perubahan paling baru. Begitu
 * server memberinya nomor, ia otomatis pindah ke posisi yang benar.
 */
export function compareOps(a: Op, b: Op): number {
  if (a.seq !== null && b.seq !== null) return a.seq - b.seq;
  if (a.seq !== null) return -1;
  if (b.seq !== null) return 1;
  return a.clientTs - b.clientTs || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
}

export function emptyState(groupId: string): GroupState {
  return {
    id: groupId,
    name: '',
    currency: 'IDR',
    members: new Map(),
    expenses: new Map(),
    settlements: new Map(),
  };
}

/** Melipat seluruh operasi menjadi state yang bisa ditampilkan. */
export function fold(groupId: string, ops: Op[]): GroupState {
  const state = emptyState(groupId);
  const seen = new Set<string>();

  for (const op of [...ops].sort(compareOps)) {
    if (op.groupId !== groupId) continue;
    if (seen.has(op.id)) continue;
    seen.add(op.id);
    applyOp(state, op);
  }

  return state;
}

/** Menerapkan satu operasi ke state yang sudah ada. Memutasi `state` di tempat. */
export function applyOp(state: GroupState, op: Op): void {
  switch (op.type) {
    case 'group.create': {
      state.name = op.payload.name;
      state.currency = op.payload.currency;
      return;
    }

    case 'member.add': {
      const { memberId, displayName } = op.payload;
      const existing = state.members.get(memberId);
      // Menambahkan anggota yang sudah ada tidak menimpa namanya — dua HP bisa
      // saja menambahkan orang yang sama saat offline.
      if (existing) return;
      state.members.set(memberId, { id: memberId, displayName, removed: false });
      return;
    }

    case 'member.rename': {
      const member = state.members.get(op.payload.memberId);
      if (member) member.displayName = op.payload.displayName;
      return;
    }

    case 'member.remove': {
      const member = state.members.get(op.payload.memberId);
      // Ditandai, bukan dihapus: namanya masih dibutuhkan untuk pengeluaran lama.
      if (member) member.removed = true;
      return;
    }

    case 'expense.add': {
      const { expenseId, ...fields } = op.payload;
      if (state.expenses.has(expenseId)) return;
      state.expenses.set(expenseId, { id: expenseId, ...fields, deleted: false, createdAt: op.clientTs });
      return;
    }

    case 'expense.edit': {
      const { expenseId, ...patch } = op.payload;
      const expense = state.expenses.get(expenseId);
      // Operasi ubah untuk pengeluaran yang belum dikenal diabaikan, bukan
      // membuat aplikasi gagal. Urutan `seq` menjamin operasi tambah selalu
      // datang lebih dulu, jadi ini hanya jaring pengaman.
      if (!expense) return;
      for (const [key, value] of Object.entries(patch)) {
        if (value !== undefined) (expense as unknown as Record<string, unknown>)[key] = value;
      }
      return;
    }

    case 'expense.delete': {
      const expense = state.expenses.get(op.payload.expenseId);
      if (expense) expense.deleted = true;
      return;
    }

    case 'settlement.add': {
      const { settlementId, ...fields } = op.payload;
      if (state.settlements.has(settlementId)) return;
      state.settlements.set(settlementId, { id: settlementId, ...fields, deleted: false });
      return;
    }

    case 'settlement.delete': {
      const settlement = state.settlements.get(op.payload.settlementId);
      if (settlement) settlement.deleted = true;
      return;
    }

    default: {
      // Operasi dari versi aplikasi yang lebih baru diabaikan dengan tenang,
      // supaya HP yang belum diperbarui tetap bisa dipakai.
      return;
    }
  }
}

export function activeMembers(state: GroupState): Member[] {
  return [...state.members.values()].filter((m) => !m.removed);
}

export function activeExpenses(state: GroupState): Expense[] {
  return [...state.expenses.values()]
    .filter((e) => !e.deleted)
    .sort((a, b) => b.occurredAt - a.occurredAt || (a.id < b.id ? 1 : -1));
}

export function activeSettlements(state: GroupState): Settlement[] {
  return [...state.settlements.values()]
    .filter((s) => !s.deleted)
    .sort((a, b) => b.occurredAt - a.occurredAt || (a.id < b.id ? 1 : -1));
}

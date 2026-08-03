/**
 * Saldo tiap anggota = (total yang ia talangi) − (total yang jadi porsinya).
 *
 *   saldo > 0  → ia menalangi lebih dari porsinya, berhak MENERIMA
 *   saldo < 0  → porsinya lebih besar dari yang ia bayar, harus MEMBAYAR
 *
 * Karena setiap pengeluaran menambah jumlah yang sama di sisi "menalangi" dan
 * sisi "porsi", jumlah seluruh saldo selalu nol. Itu bukan kebetulan melainkan
 * invarian yang diuji — kalau ia pernah tidak nol, ada rupiah yang bocor di
 * pembulatan dan seluruh perhitungan penyelesaian jadi tidak bisa dipercaya.
 */

import type { Rupiah } from './money';
import { computeShares, type MemberId, type SplitMode } from './split';

export interface ExpenseForBalance {
  /** Dipakai sebagai seed pemutar sisa pembulatan — lihat computeShares. */
  id: string;
  payerId: MemberId;
  total: Rupiah;
  participants: MemberId[];
  mode: SplitMode;
}

export interface SettlementForBalance {
  fromId: MemberId;
  toId: MemberId;
  amount: Rupiah;
}

export type Balances = Map<MemberId, Rupiah>;

export function computeBalances(
  memberIds: MemberId[],
  expenses: ExpenseForBalance[],
  settlements: SettlementForBalance[],
): Balances {
  const balances: Balances = new Map();

  // Anggota yang belum dikenal tetap dihitung, bukan diabaikan. Saat dua HP
  // menulis secara terpisah, sebuah pengeluaran bisa tiba lebih dulu daripada
  // operasi yang menambahkan anggotanya. Menganggapnya nol akan membuat total
  // saldo tidak nol — persis kesalahan yang paling ingin kita hindari.
  const bump = (id: MemberId, delta: Rupiah) => {
    balances.set(id, (balances.get(id) ?? 0) + delta);
  };

  for (const id of memberIds) bump(id, 0);

  for (const expense of expenses) {
    bump(expense.payerId, expense.total);
    for (const share of computeShares(
      expense.total,
      expense.participants,
      expense.mode,
      expense.id,
    )) {
      bump(share.memberId, -share.amount);
    }
  }

  // Pelunasan: yang mentransfer mengurangi utangnya, yang menerima berkurang haknya.
  for (const settlement of settlements) {
    bump(settlement.fromId, settlement.amount);
    bump(settlement.toId, -settlement.amount);
  }

  return balances;
}

/** Ringkasan untuk satu orang — persis dua angka yang ingin dilihat di layar utama. */
export function perspectiveOf(
  balances: Balances,
  memberId: MemberId,
): { owes: Rupiah; isOwed: Rupiah; net: Rupiah } {
  const net = balances.get(memberId) ?? 0;
  return {
    owes: net < 0 ? -net : 0,
    isOwed: net > 0 ? net : 0,
    net,
  };
}

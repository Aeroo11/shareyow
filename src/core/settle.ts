/**
 * Dari daftar saldo menjadi daftar transfer: siapa mengirim berapa kepada siapa.
 *
 * Tanpa penyederhanaan, lima orang yang saling berutang bisa menghasilkan sampai
 * 10 transfer — n(n−1)/2. Padahal utang itu boleh dialihkan: kalau A berutang
 * pada B dan B berutang pada C dengan jumlah sama, cukup A langsung mengirim ke
 * C. Yang perlu dipertahankan hanyalah saldo akhir setiap orang, bukan jalur
 * transaksinya.
 *
 * Algoritmanya greedy: pasangkan penerima terbesar dengan pembayar terbesar,
 * lunasi sebanyak mungkin, ulangi. Setiap langkah menuntaskan minimal satu orang,
 * jadi hasilnya paling banyak n−1 transfer.
 *
 * CATATAN JUJUR: ini tidak dijamin menghasilkan jumlah transfer paling sedikit.
 * Mencari yang benar-benar minimum berarti mencari sebanyak mungkin himpunan
 * bagian yang berjumlah nol — varian subset-sum, yang NP-hard. Greedy selalu
 * menghasilkan penyelesaian yang benar, hampir selalu optimal pada ukuran nyata
 * (3–10 orang), dan berjalan seketika. Pendekatan yang sama dipakai Splitwise.
 */

import type { Rupiah } from './money';
import type { Balances } from './balance';
import type { MemberId } from './split';

export interface Transfer {
  fromId: MemberId;
  toId: MemberId;
  amount: Rupiah;
}

export function settleUp(balances: Balances): Transfer[] {
  const total = [...balances.values()].reduce((a, b) => a + b, 0);
  if (total !== 0) {
    // Ini bukan kesalahan pengguna melainkan bug — kemungkinan besar rupiah
    // hilang di pembulatan. Gagal keras di sini jauh lebih baik daripada
    // menampilkan daftar transfer yang diam-diam salah.
    throw new Error(`saldo tidak berjumlah nol (selisih ${total}); ada rupiah yang bocor`);
  }

  // Urutan menurun berdasarkan nominal; id dipakai sebagai pemutus seri supaya
  // semua perangkat menghasilkan daftar transfer yang identik.
  const byMagnitudeThenId = (a: [MemberId, Rupiah], b: [MemberId, Rupiah]) =>
    b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);

  const creditors = [...balances.entries()].filter(([, v]) => v > 0).sort(byMagnitudeThenId);
  const debtors = [...balances.entries()]
    .filter(([, v]) => v < 0)
    .sort((a, b) => a[1] - b[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));

  const transfers: Transfer[] = [];
  let ci = 0;
  let di = 0;
  let creditLeft = creditors[0]?.[1] ?? 0;
  let debtLeft = debtors.length > 0 ? -debtors[0]![1] : 0;

  while (ci < creditors.length && di < debtors.length) {
    const amount = Math.min(creditLeft, debtLeft);
    if (amount > 0) {
      transfers.push({ fromId: debtors[di]![0], toId: creditors[ci]![0], amount });
    }

    creditLeft -= amount;
    debtLeft -= amount;

    if (creditLeft === 0) {
      ci += 1;
      creditLeft = creditors[ci]?.[1] ?? 0;
    }
    if (debtLeft === 0) {
      di += 1;
      debtLeft = di < debtors.length ? -debtors[di]![1] : 0;
    }
  }

  return transfers;
}

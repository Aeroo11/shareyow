/**
 * Jembatan antara "apa yang sedang diketik" dan "pembagian yang sah".
 *
 * `computeShares` gagal keras pada input yang tidak sah, dan memang seharusnya
 * begitu — ia menjaga invarian yang menopang seluruh perhitungan saldo. Tapi
 * "belum selesai mengetik" bukan kesalahan; ia keadaan yang wajar di tengah
 * pengisian form. Berkas ini yang membedakan keduanya, dan menerjemahkan yang
 * kedua menjadi kalimat yang memberi tahu pengguna harus mengetik apa.
 *
 * Murni, tanpa React — sama seperti seluruh isi src/core/.
 */

import { formatRupiah, parseRupiah, type Rupiah } from './money';
import type { MemberId, SplitMode } from './split';

export type SplitKind = SplitMode['kind'];

export const SPLIT_KINDS: Array<{ kind: SplitKind; label: string; hint: string }> = [
  { kind: 'equal', label: 'rata', hint: 'Semua peserta menanggung sama besar.' },
  { kind: 'exact', label: 'nominal', hint: 'Tentukan sendiri berapa rupiah per orang.' },
  { kind: 'percent', label: 'persen', hint: 'Bagi berdasarkan persentase. Totalnya harus 100.' },
  {
    kind: 'shares',
    label: 'porsi',
    hint: 'Beri bobot — yang makan 2 porsi menanggung dua kali lipat.',
  },
];

export interface SplitDraft {
  kind: SplitKind;
  /** Anggota yang dikeluarkan dari pembagian. */
  excluded: Set<MemberId>;
  /** Teks mentah yang diketik, bukan angka: "45rb" dan "12.500" harus tetap terbaca apa adanya. */
  exact: Record<MemberId, string>;
  percent: Record<MemberId, string>;
  shares: Record<MemberId, number>;
}

export function emptyDraft(): SplitDraft {
  return { kind: 'equal', excluded: new Set(), exact: {}, percent: {}, shares: {} };
}

/** Membangun draf dari pengeluaran yang sudah ada — dipakai layar ubah. */
export function draftFrom(
  allMemberIds: MemberId[],
  participants: MemberId[],
  mode: SplitMode,
): SplitDraft {
  const draft = emptyDraft();
  draft.kind = mode.kind;
  draft.excluded = new Set(allMemberIds.filter((id) => !participants.includes(id)));

  if (mode.kind === 'exact') {
    for (const [id, amount] of Object.entries(mode.amounts)) draft.exact[id] = String(amount);
  } else if (mode.kind === 'percent') {
    for (const [id, p] of Object.entries(mode.percents)) draft.percent[id] = String(p);
  } else if (mode.kind === 'shares') {
    draft.shares = { ...mode.shares };
  }

  return draft;
}

export type BuildResult = { mode: SplitMode } | { problem: string };

/**
 * Menerjemahkan draf menjadi SplitMode, atau menjelaskan kenapa belum bisa.
 *
 * Pesannya sengaja menyebut angka — "Kurang Rp 10.000 lagi" jauh lebih berguna
 * daripada "jumlah tidak sesuai", karena pengguna langsung tahu harus mengetik apa
 * tanpa perlu menghitung selisihnya sendiri.
 */
export function buildMode(
  draft: SplitDraft,
  participants: MemberId[],
  total: Rupiah,
): BuildResult {
  switch (draft.kind) {
    case 'equal':
      return { mode: { kind: 'equal' } };

    case 'exact': {
      const amounts: Record<MemberId, number> = {};
      let sum = 0;
      for (const id of participants) {
        const value = parseRupiah(draft.exact[id] ?? '') ?? 0;
        amounts[id] = value;
        sum += value;
      }

      const selisih = total - sum;
      if (selisih > 0) return { problem: `Kurang ${formatRupiah(selisih)} lagi.` };
      if (selisih < 0) return { problem: `Lebih ${formatRupiah(-selisih)} dari totalnya.` };
      return { mode: { kind: 'exact', amounts } };
    }

    case 'percent': {
      const percents: Record<MemberId, number> = {};
      let sum = 0;
      for (const id of participants) {
        const value = parsePercent(draft.percent[id] ?? '');
        percents[id] = value;
        // Dijumlahkan dalam basis point supaya perbandingannya bebas galat float.
        sum += Math.round(value * 100);
      }

      const selisih = 10_000 - sum;
      if (selisih !== 0) {
        // Nol di belakang koma dibuang dulu, baru titik ditukar koma. Urutannya
        // penting: "0,5" jauh lebih enak dibaca daripada "0,50", dan "10" daripada
        // "10,00".
        const angka = Math.abs(selisih / 100)
          .toFixed(2)
          .replace(/\.?0+$/, '')
          .replace('.', ',');
        return {
          problem: `${selisih > 0 ? 'Kurang' : 'Lebih'} ${angka}% — totalnya harus 100%.`,
        };
      }
      return { mode: { kind: 'percent', percents } };
    }

    case 'shares': {
      const shares: Record<MemberId, number> = {};
      let sum = 0;
      for (const id of participants) {
        // Porsi yang belum disentuh dianggap 1: bagi rata adalah titik awal yang
        // paling masuk akal, dan pengguna tinggal menaikkan yang perlu saja.
        const value = draft.shares[id] ?? 1;
        shares[id] = value;
        sum += value;
      }
      if (sum === 0) return { problem: 'Beri porsi minimal satu orang.' };
      return { mode: { kind: 'shares', shares } };
    }
  }
}

/** "33,33" dan "33.33" sama-sama diterima; yang tak terbaca dianggap nol. */
export function parsePercent(text: string): number {
  const cleaned = text.trim().replace('%', '').replace(',', '.');
  if (cleaned === '') return 0;
  const value = Number(cleaned);
  return Number.isFinite(value) && value >= 0 ? value : 0;
}

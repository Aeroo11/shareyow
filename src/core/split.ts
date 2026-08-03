/**
 * Pembagian tagihan menjadi bagian-bagian yang berjumlah persis sama dengan total.
 *
 * Masalahnya terlihat sepele sampai kamu mencoba: Rp 10.000 dibagi tiga orang
 * adalah 3.333,33 per orang. Dibulatkan ke bawah jadi 9.999 — kurang satu rupiah.
 * Dibulatkan ke atas jadi 10.002 — lebih dua rupiah. Selisih satu rupiah itu
 * tidak penting sekali; yang penting adalah ia tidak pernah hilang, karena saldo
 * seluruh anggota harus selalu berjumlah nol supaya "siapa transfer ke siapa"
 * bisa dipercaya.
 *
 * Solusinya metode sisa terbesar (largest remainder): bagi ke bawah dulu, lalu
 * sebarkan sisa rupiah satu per satu kepada yang bagian pecahannya paling besar.
 *
 * INVARIAN YANG DIJAMIN MODUL INI:
 *   sum(computeShares(total, ...)) === total   untuk setiap input yang sah.
 */

import { assertAmount, type Rupiah } from './money';

export type MemberId = string;

export type SplitMode =
  /** Bagi rata di antara semua peserta. */
  | { kind: 'equal' }
  /** Nominal ditentukan sendiri per orang; harus berjumlah persis total. */
  | { kind: 'exact'; amounts: Record<MemberId, Rupiah> }
  /** Persen per orang (boleh 2 desimal); harus berjumlah persis 100. */
  | { kind: 'percent'; percents: Record<MemberId, number> }
  /** Porsi/bobot bulat — mis. yang makan 2 porsi dapat bobot 2. */
  | { kind: 'shares'; shares: Record<MemberId, number> };

export interface Share {
  memberId: MemberId;
  amount: Rupiah;
}

/** 10.000 basis point = 100%. Persen disimpan sebagai integer agar bebas float. */
const BASIS_POINTS_TOTAL = 10_000;

export function computeShares(
  total: Rupiah,
  participants: MemberId[],
  mode: SplitMode,
  /**
   * Penentu urutan pembagian sisa rupiah. Beri id pengeluaran di sini: sisa
   * pembulatan jadi berpindah-pindah antar pengeluaran, sehingga orang yang
   * sama tidak selalu kebagian rupiah lebih. Hasilnya tetap deterministik —
   * seed yang sama selalu memberi pembagian yang sama, syarat mutlak agar
   * semua perangkat menghitung angka yang identik.
   */
  seed = '',
): Share[] {
  assertAmount(total, 'total pengeluaran');
  if (total < 0) throw new Error('total pengeluaran tidak boleh negatif');
  if (participants.length === 0) throw new Error('pengeluaran harus punya minimal satu peserta');
  if (new Set(participants).size !== participants.length) {
    throw new Error('ada peserta yang tercatat dua kali');
  }

  if (mode.kind === 'exact') return exactShares(total, participants, mode.amounts);

  const weights = weightsFor(participants, mode);
  const amounts = allocate(total, weights, rotationFor(seed, participants.length));

  return participants.map((memberId, i) => ({ memberId, amount: amounts[i]! }));
}

function exactShares(
  total: Rupiah,
  participants: MemberId[],
  amounts: Record<MemberId, Rupiah>,
): Share[] {
  const shares = participants.map((memberId) => {
    const amount = amounts[memberId];
    if (amount === undefined) throw new Error(`nominal untuk peserta ${memberId} belum diisi`);
    assertAmount(amount, `nominal untuk ${memberId}`);
    if (amount < 0) throw new Error(`nominal untuk ${memberId} tidak boleh negatif`);
    return { memberId, amount };
  });

  const sum = shares.reduce((acc, s) => acc + s.amount, 0);
  if (sum !== total) {
    const selisih = total - sum;
    throw new Error(
      `jumlah nominal (${sum}) tidak sama dengan total (${total}); ` +
        `${selisih > 0 ? 'kurang' : 'lebih'} ${Math.abs(selisih)}`,
    );
  }

  return shares;
}

/** Mode `exact` sudah ditangani lebih dulu di computeShares — di sini tinggal yang berbobot. */
type WeightedMode = Exclude<SplitMode, { kind: 'exact' }>;

function weightsFor(participants: MemberId[], mode: WeightedMode): number[] {
  switch (mode.kind) {
    case 'equal':
      return participants.map(() => 1);

    case 'shares': {
      const weights = participants.map((id) => {
        const w = mode.shares[id];
        if (w === undefined) throw new Error(`porsi untuk peserta ${id} belum diisi`);
        if (!Number.isSafeInteger(w) || w < 0) {
          throw new Error(`porsi untuk ${id} harus bilangan bulat >= 0, diterima: ${w}`);
        }
        return w;
      });
      if (weights.every((w) => w === 0)) throw new Error('total porsi tidak boleh nol');
      return weights;
    }

    case 'percent': {
      const weights = participants.map((id) => {
        const p = mode.percents[id];
        if (p === undefined) throw new Error(`persen untuk peserta ${id} belum diisi`);
        if (!Number.isFinite(p) || p < 0) throw new Error(`persen untuk ${id} tidak sah: ${p}`);
        // Dibulatkan ke basis point supaya perbandingan totalnya bebas dari galat float.
        return Math.round(p * 100);
      });
      const sum = weights.reduce((a, b) => a + b, 0);
      if (sum !== BASIS_POINTS_TOTAL) {
        throw new Error(`total persen harus 100, diterima: ${(sum / 100).toFixed(2)}`);
      }
      return weights;
    }

    default: {
      const never: never = mode;
      throw new Error(`mode pembagian tidak dikenal: ${JSON.stringify(never)}`);
    }
  }
}

/**
 * Metode sisa terbesar. Mengembalikan bilangan bulat yang berjumlah persis
 * `total`, dibagi sesuai bobot.
 */
function allocate(total: Rupiah, weights: number[], rotation: number): Rupiah[] {
  const n = weights.length;
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  if (totalWeight <= 0) throw new Error('total bobot harus lebih dari nol');

  const maxWeight = Math.max(...weights);
  if (!Number.isSafeInteger(total * maxWeight)) {
    throw new Error('nilai terlalu besar untuk dihitung dengan aman');
  }

  const base: number[] = new Array(n);
  // remainder = sisa pembagian dalam satuan (rupiah × bobot), tetap integer.
  const remainder: number[] = new Array(n);
  let distributed = 0;

  for (let i = 0; i < n; i++) {
    const numerator = total * weights[i]!;
    const q = Math.floor(numerator / totalWeight);
    base[i] = q;
    remainder[i] = numerator - q * totalWeight;
    distributed += q;
  }

  let leftover = total - distributed;

  // Urutkan berdasarkan sisa terbesar. Saat sisanya sama persis — kasus paling
  // umum, yaitu bagi rata — pemenangnya ditentukan `rotation`, bukan selalu
  // orang pertama dalam daftar.
  const order = Array.from({ length: n }, (_, i) => i).sort((a, b) => {
    if (remainder[b]! !== remainder[a]!) return remainder[b]! - remainder[a]!;
    return ((a - rotation + n) % n) - ((b - rotation + n) % n);
  });

  for (const i of order) {
    if (leftover <= 0) break;
    base[i]! += 1;
    leftover -= 1;
  }

  return base;
}

/** FNV-1a 32-bit — kecil, deterministik, dan cukup untuk memutar urutan. */
function rotationFor(seed: string, n: number): number {
  if (n <= 1) return 0;
  let hash = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash % n;
}

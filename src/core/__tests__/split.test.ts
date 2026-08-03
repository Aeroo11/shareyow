import { computeShares, type SplitMode } from '../split';
import { makeRng, memberIds, randomInt, randomPartition } from './helpers';

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe('computeShares — contoh yang mudah diperiksa dengan tangan', () => {
  it('membagi rata saat habis dibagi', () => {
    const shares = computeShares(90_000, memberIds(3), { kind: 'equal' });
    expect(shares.map((s) => s.amount)).toEqual([30_000, 30_000, 30_000]);
  });

  it('menyebar sisa rupiah saat tidak habis dibagi, tanpa menghilangkannya', () => {
    // 10.000 / 3 = 3.333,33... Dua orang dapat 3.333, satu orang dapat 3.334.
    const shares = computeShares(10_000, memberIds(3), { kind: 'equal' });
    const amounts = shares.map((s) => s.amount).sort((a, b) => a - b);
    expect(amounts).toEqual([3_333, 3_333, 3_334]);
    expect(sum(amounts)).toBe(10_000);
  });

  it('menghormati porsi — yang makan dua porsi menanggung dua kali lipat', () => {
    const shares = computeShares(60_000, memberIds(3), {
      kind: 'shares',
      shares: { m1: 2, m2: 1, m3: 1 },
    });
    expect(shares).toEqual([
      { memberId: 'm1', amount: 30_000 },
      { memberId: 'm2', amount: 15_000 },
      { memberId: 'm3', amount: 15_000 },
    ]);
  });

  it('menerima porsi nol — anggota yang ikut dicatat tapi tidak menanggung', () => {
    const shares = computeShares(50_000, memberIds(3), {
      kind: 'shares',
      shares: { m1: 1, m2: 1, m3: 0 },
    });
    expect(shares.find((s) => s.memberId === 'm3')!.amount).toBe(0);
    expect(sum(shares.map((s) => s.amount))).toBe(50_000);
  });

  it('membagi berdasarkan persen berdesimal', () => {
    const shares = computeShares(100_000, memberIds(3), {
      kind: 'percent',
      percents: { m1: 33.33, m2: 33.33, m3: 33.34 },
    });
    expect(sum(shares.map((s) => s.amount))).toBe(100_000);
    expect(shares[2]!.amount).toBeGreaterThanOrEqual(shares[0]!.amount);
  });

  it('menerima total nol', () => {
    const shares = computeShares(0, memberIds(4), { kind: 'equal' });
    expect(shares.map((s) => s.amount)).toEqual([0, 0, 0, 0]);
  });
});

describe('computeShares — input yang harus ditolak', () => {
  it('menolak nominal manual yang tidak berjumlah total, dan menyebut selisihnya', () => {
    expect(() =>
      computeShares(100_000, memberIds(2), { kind: 'exact', amounts: { m1: 40_000, m2: 50_000 } }),
    ).toThrow(/kurang 10000/);
  });

  it('menolak persen yang tidak berjumlah 100', () => {
    expect(() =>
      computeShares(100_000, memberIds(2), { kind: 'percent', percents: { m1: 50, m2: 40 } }),
    ).toThrow(/total persen harus 100/);
  });

  it('menolak total pecahan — uang tidak pernah float di aplikasi ini', () => {
    expect(() => computeShares(10_000.5, memberIds(2), { kind: 'equal' })).toThrow(
      /bilangan bulat rupiah/,
    );
  });

  it('menolak total negatif', () => {
    expect(() => computeShares(-1_000, memberIds(2), { kind: 'equal' })).toThrow(/negatif/);
  });

  it('menolak pengeluaran tanpa peserta', () => {
    expect(() => computeShares(10_000, [], { kind: 'equal' })).toThrow(/minimal satu peserta/);
  });

  it('menolak peserta yang tercatat dua kali', () => {
    expect(() => computeShares(10_000, ['m1', 'm1'], { kind: 'equal' })).toThrow(/dua kali/);
  });

  it('menolak peserta yang porsinya belum diisi', () => {
    expect(() =>
      computeShares(10_000, memberIds(2), { kind: 'shares', shares: { m1: 1 } }),
    ).toThrow(/porsi untuk peserta m2/);
  });
});

describe('INVARIAN: jumlah seluruh bagian selalu persis sama dengan total', () => {
  // Inilah satu-satunya jaminan yang menopang semua perhitungan saldo. Kalau ia
  // pernah gagal, ada rupiah yang bocor dan daftar "siapa transfer ke siapa"
  // tidak lagi bisa dipercaya. Karena itu diuji dengan ratusan input acak,
  // bukan beberapa contoh pilihan.
  const rng = makeRng(20260803);

  it.each([['equal'], ['shares'], ['percent'], ['exact']] as const)(
    'bertahan untuk 400 kasus acak — mode %s',
    (kind) => {
      for (let i = 0; i < 400; i++) {
        const n = randomInt(rng, 1, 8);
        const ids = memberIds(n);
        const total = randomInt(rng, 0, 100_000_000);
        const mode = randomMode(kind, ids, total);

        const shares = computeShares(total, ids, mode, `expense-${i}`);

        expect(sum(shares.map((s) => s.amount))).toBe(total);
        expect(shares).toHaveLength(n);
        for (const share of shares) {
          expect(Number.isSafeInteger(share.amount)).toBe(true);
          expect(share.amount).toBeGreaterThanOrEqual(0);
        }
      }
    },
  );

  function randomMode(kind: string, ids: string[], total: number): SplitMode {
    switch (kind) {
      case 'equal':
        return { kind: 'equal' };
      case 'shares': {
        const shares: Record<string, number> = {};
        for (const id of ids) shares[id] = randomInt(rng, 0, 5);
        if (ids.every((id) => shares[id] === 0)) shares[ids[0]!] = 1;
        return { kind: 'shares', shares };
      }
      case 'percent': {
        // Basis point acak yang berjumlah persis 10.000, lalu dibagi 100 jadi persen.
        const bps = randomPartition(rng, 10_000, ids.length);
        const percents: Record<string, number> = {};
        ids.forEach((id, i) => (percents[id] = bps[i]! / 100));
        return { kind: 'percent', percents };
      }
      default: {
        const parts = randomPartition(rng, total, ids.length);
        const amounts: Record<string, number> = {};
        ids.forEach((id, i) => (amounts[id] = parts[i]!));
        return { kind: 'exact', amounts };
      }
    }
  }
});

describe('sisa pembulatan berpindah antar pengeluaran', () => {
  it('tidak selalu membebankan rupiah lebih ke orang yang sama', () => {
    // Rp 10.000 dibagi 3 selalu menyisakan satu rupiah. Kalau penerimanya
    // ditentukan oleh urutan daftar, orang pertama akan selalu membayar lebih —
    // tiap hari, selamanya. Seed per pengeluaran yang membuatnya bergilir.
    const penerima = new Set<string>();
    for (let i = 0; i < 60; i++) {
      const shares = computeShares(10_000, memberIds(3), { kind: 'equal' }, `expense-${i}`);
      penerima.add(shares.find((s) => s.amount === 3_334)!.memberId);
    }
    expect(penerima.size).toBeGreaterThan(1);
  });

  it('seed yang berbeda memberi pembagian yang berbeda — jadi seed tidak boleh dikarang', () => {
    // Konsekuensi praktisnya: pratinjau di layar form WAJIB memakai id pengeluaran
    // yang sebenarnya akan disimpan. Memakai seed karangan seperti 'pratinjau'
    // membuat layar menjanjikan pembagian yang berbeda dari yang tercatat.
    const hasil = new Set(
      Array.from({ length: 20 }, (_, i) =>
        JSON.stringify(computeShares(10_000, memberIds(3), { kind: 'equal' }, `id-${i}`)),
      ),
    );
    expect(hasil.size).toBeGreaterThan(1);
  });

  it('tetap deterministik: seed yang sama selalu memberi hasil yang sama', () => {
    // Syarat mutlak agar semua HP menghitung angka yang identik dari op log
    // yang sama, tanpa perlu saling bertanya.
    const a = computeShares(10_000, memberIds(3), { kind: 'equal' }, 'exp-abc');
    const b = computeShares(10_000, memberIds(3), { kind: 'equal' }, 'exp-abc');
    expect(a).toEqual(b);
  });
});

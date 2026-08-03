import { computeShares } from '../split';
import { buildMode, draftFrom, emptyDraft, parsePercent, type SplitDraft } from '../splitDraft';
import { memberIds } from './helpers';

function draft(overrides: Partial<SplitDraft>): SplitDraft {
  return { ...emptyDraft(), ...overrides };
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

describe('buildMode — bagi rata', () => {
  it('selalu sah, tanpa perlu diisi apa pun', () => {
    expect(buildMode(draft({ kind: 'equal' }), memberIds(3), 90_000)).toEqual({
      mode: { kind: 'equal' },
    });
  });
});

describe('buildMode — nominal', () => {
  it('menyebut kekurangannya dalam rupiah, bukan sekadar "tidak sesuai"', () => {
    const result = buildMode(
      draft({ kind: 'exact', exact: { m1: '40.000', m2: '50.000' } }),
      memberIds(2),
      100_000,
    );
    expect(result).toEqual({ problem: 'Kurang Rp 10.000 lagi.' });
  });

  it('menyebut kelebihannya juga', () => {
    const result = buildMode(
      draft({ kind: 'exact', exact: { m1: '60.000', m2: '50.000' } }),
      memberIds(2),
      100_000,
    );
    expect(result).toEqual({ problem: 'Lebih Rp 10.000 dari totalnya.' });
  });

  it('menerima "45rb" dan "12.500" apa adanya', () => {
    const result = buildMode(
      draft({ kind: 'exact', exact: { m1: '45rb', m2: '12.500' } }),
      memberIds(2),
      57_500,
    );
    expect(result).toEqual({ mode: { kind: 'exact', amounts: { m1: 45_000, m2: 12_500 } } });
  });

  it('menganggap yang belum diisi sebagai nol, bukan gagal', () => {
    // Orang baru mulai mengetik. Menegurnya dengan pesan kesalahan program di
    // tengah pengisian akan terasa seperti aplikasinya rusak.
    const result = buildMode(draft({ kind: 'exact', exact: { m1: '100.000' } }), memberIds(2), 100_000);
    expect(result).toEqual({ mode: { kind: 'exact', amounts: { m1: 100_000, m2: 0 } } });
  });
});

describe('buildMode — persen', () => {
  it('menerima persen berdesimal yang berjumlah 100', () => {
    const result = buildMode(
      draft({ kind: 'percent', percent: { m1: '33,33', m2: '33.33', m3: '33,34' } }),
      memberIds(3),
      100_000,
    );
    expect(result).toEqual({
      mode: { kind: 'percent', percents: { m1: 33.33, m2: 33.33, m3: 33.34 } },
    });
  });

  it('menyebut selisih persennya', () => {
    const result = buildMode(
      draft({ kind: 'percent', percent: { m1: '50', m2: '40' } }),
      memberIds(2),
      100_000,
    );
    expect(result).toEqual({ problem: 'Kurang 10% — totalnya harus 100%.' });
  });

  it('menampilkan desimal hanya kalau memang ada', () => {
    const result = buildMode(
      draft({ kind: 'percent', percent: { m1: '50', m2: '49,5' } }),
      memberIds(2),
      100_000,
    );
    expect(result).toEqual({ problem: 'Kurang 0,5% — totalnya harus 100%.' });
  });
});

describe('buildMode — porsi', () => {
  it('menganggap porsi yang belum disentuh sebagai 1 — bagi rata sebagai titik awal', () => {
    const result = buildMode(draft({ kind: 'shares', shares: { m1: 2 } }), memberIds(3), 60_000);
    expect(result).toEqual({ mode: { kind: 'shares', shares: { m1: 2, m2: 1, m3: 1 } } });
  });

  it('menolak kalau semua porsinya nol', () => {
    const result = buildMode(
      draft({ kind: 'shares', shares: { m1: 0, m2: 0 } }),
      memberIds(2),
      60_000,
    );
    expect(result).toEqual({ problem: 'Beri porsi minimal satu orang.' });
  });
});

describe('draftFrom — memuat kembali pengeluaran untuk diubah', () => {
  it('menandai anggota yang bukan peserta sebagai dikecualikan', () => {
    const d = draftFrom(memberIds(3), ['m1', 'm3'], { kind: 'equal' });
    expect([...d.excluded]).toEqual(['m2']);
  });

  it('memuat kembali nominal, persen, dan porsi', () => {
    expect(draftFrom(memberIds(2), memberIds(2), {
      kind: 'exact',
      amounts: { m1: 40_000, m2: 60_000 },
    }).exact).toEqual({ m1: '40000', m2: '60000' });

    expect(draftFrom(memberIds(2), memberIds(2), {
      kind: 'shares',
      shares: { m1: 2, m2: 1 },
    }).shares).toEqual({ m1: 2, m2: 1 });
  });

  it('bolak-balik: pengeluaran → draf → mode yang sama', () => {
    // Membuka pengeluaran untuk diubah lalu menyimpannya tanpa menyentuh apa pun
    // tidak boleh mengubah pembagiannya sedikit pun.
    const ids = memberIds(3);
    const original = { kind: 'percent' as const, percents: { m1: 20, m2: 30, m3: 50 } };

    const rebuilt = buildMode(draftFrom(ids, ids, original), ids, 100_000);
    expect(rebuilt).toEqual({ mode: original });

    expect(computeShares(100_000, ids, original, 'e1')).toEqual(
      computeShares(100_000, ids, (rebuilt as { mode: typeof original }).mode, 'e1'),
    );
  });
});

describe('INVARIAN: apa pun yang lolos buildMode selalu berjumlah persis total', () => {
  it('untuk keempat mode', () => {
    const ids = memberIds(3);
    const cases: SplitDraft[] = [
      draft({ kind: 'equal' }),
      draft({ kind: 'exact', exact: { m1: '33.333', m2: '33.333', m3: '33.334' } }),
      draft({ kind: 'percent', percent: { m1: '33,33', m2: '33,33', m3: '33,34' } }),
      draft({ kind: 'shares', shares: { m1: 2, m2: 1, m3: 1 } }),
    ];

    for (const d of cases) {
      const built = buildMode(d, ids, 100_000);
      expect(built).not.toHaveProperty('problem');
      const shares = computeShares(100_000, ids, (built as { mode: never }).mode, 'e1');
      expect(sum(shares.map((s) => s.amount))).toBe(100_000);
    }
  });
});

describe('parsePercent', () => {
  it.each([
    ['33,33', 33.33],
    ['33.33', 33.33],
    ['50%', 50],
    ['  20 ', 20],
    ['', 0],
    ['abc', 0],
    ['-5', 0],
  ])('membaca "%s" sebagai %s', (input, expected) => {
    expect(parsePercent(input)).toBe(expected);
  });
});

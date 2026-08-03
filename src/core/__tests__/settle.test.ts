import { settleUp, type Transfer } from '../settle';
import { makeRng, memberIds, randomInt } from './helpers';

/** Menerapkan daftar transfer ke saldo. Semua saldo harus jadi nol sesudahnya. */
function applyTransfers(balances: Map<string, number>, transfers: Transfer[]): Map<string, number> {
  const after = new Map(balances);
  for (const t of transfers) {
    after.set(t.fromId, (after.get(t.fromId) ?? 0) + t.amount);
    after.set(t.toId, (after.get(t.toId) ?? 0) - t.amount);
  }
  return after;
}

describe('settleUp', () => {
  it('tidak menghasilkan transfer apa pun kalau semua sudah lunas', () => {
    expect(settleUp(new Map([['m1', 0], ['m2', 0]]))).toEqual([]);
  });

  it('menghasilkan satu transfer untuk kasus dua orang', () => {
    const transfers = settleUp(new Map([['m1', 30_000], ['m2', -30_000]]));
    expect(transfers).toEqual([{ fromId: 'm2', toId: 'm1', amount: 30_000 }]);
  });

  it('mengalihkan utang berantai jadi satu transfer langsung', () => {
    // m3 berutang pada m2, m2 berutang pada m1, dengan jumlah yang sama.
    // Tanpa penyederhanaan butuh dua transfer; dialihkan cukup satu.
    const transfers = settleUp(new Map([['m1', 50_000], ['m2', 0], ['m3', -50_000]]));
    expect(transfers).toEqual([{ fromId: 'm3', toId: 'm1', amount: 50_000 }]);
  });

  it('memecah satu utang besar ke beberapa penerima saat memang perlu', () => {
    const balances = new Map([['m1', 60_000], ['m2', 40_000], ['m3', -100_000]]);
    const transfers = settleUp(balances);

    expect(transfers).toHaveLength(2);
    expect(transfers.every((t) => t.fromId === 'm3')).toBe(true);
    expect(transfers.reduce((a, t) => a + t.amount, 0)).toBe(100_000);
  });

  it('gagal keras kalau saldo tidak berjumlah nol', () => {
    // Kalau ini terjadi, penyebabnya bug pembulatan di hulu. Menampilkan daftar
    // transfer yang diam-diam salah jauh lebih berbahaya daripada gagal.
    expect(() => settleUp(new Map([['m1', 10], ['m2', -5]]))).toThrow(/tidak berjumlah nol/);
  });

  it('menghasilkan daftar yang identik di setiap perangkat', () => {
    // Urutan Map berbeda, isinya sama — hasilnya harus tetap sama persis,
    // supaya dua HP tidak menampilkan instruksi transfer yang berbeda.
    const a = new Map([['m1', 40_000], ['m2', -70_000], ['m3', 30_000]]);
    const b = new Map([['m3', 30_000], ['m1', 40_000], ['m2', -70_000]]);
    expect(settleUp(a)).toEqual(settleUp(b));
  });
});

describe('INVARIAN penyelesaian', () => {
  it('melunaskan semua orang dengan paling banyak n−1 transfer, untuk 500 saldo acak', () => {
    const rng = makeRng(4242);

    for (let run = 0; run < 500; run++) {
      const n = randomInt(rng, 2, 9);
      const ids = memberIds(n);

      // Saldo acak yang dipaksa berjumlah nol: n−1 angka bebas, sisanya penutup.
      const balances = new Map<string, number>();
      let running = 0;
      for (let i = 0; i < n - 1; i++) {
        const v = randomInt(rng, -2_000_000, 2_000_000);
        balances.set(ids[i]!, v);
        running += v;
      }
      balances.set(ids[n - 1]!, -running);

      const transfers = settleUp(balances);

      expect(transfers.length).toBeLessThanOrEqual(n - 1);
      for (const t of transfers) {
        expect(t.amount).toBeGreaterThan(0);
        expect(t.fromId).not.toBe(t.toId);
      }
      for (const value of applyTransfers(balances, transfers).values()) {
        expect(value).toBe(0);
      }
    }
  });
});

import { computeBalances, perspectiveOf, type ExpenseForBalance } from '../balance';
import { makeRng, memberIds, randomInt, randomPartition } from './helpers';

const totalOf = (balances: Map<string, number>) => [...balances.values()].reduce((a, b) => a + b, 0);

describe('computeBalances', () => {
  it('menghitung kasus sederhana: satu orang menalangi, semua ikut menanggung', () => {
    const balances = computeBalances(
      memberIds(3),
      [
        {
          id: 'e1',
          payerId: 'm1',
          total: 90_000,
          participants: memberIds(3),
          mode: { kind: 'equal' },
        },
      ],
      [],
    );

    // m1 menalangi 90.000, porsinya 30.000 → berhak menerima 60.000.
    expect(balances.get('m1')).toBe(60_000);
    expect(balances.get('m2')).toBe(-30_000);
    expect(balances.get('m3')).toBe(-30_000);
  });

  it('pelunasan mengurangi utang yang mentransfer', () => {
    const expenses: ExpenseForBalance[] = [
      { id: 'e1', payerId: 'm1', total: 90_000, participants: memberIds(3), mode: { kind: 'equal' } },
    ];

    const balances = computeBalances(memberIds(3), expenses, [
      { fromId: 'm2', toId: 'm1', amount: 30_000 },
    ]);

    expect(balances.get('m2')).toBe(0);
    expect(balances.get('m1')).toBe(30_000);
  });

  it('anggota tanpa pengeluaran apa pun bersaldo nol, bukan hilang dari daftar', () => {
    const balances = computeBalances(memberIds(3), [], []);
    expect([...balances.keys()].sort()).toEqual(['m1', 'm2', 'm3']);
    expect([...balances.values()]).toEqual([0, 0, 0]);
  });

  it('tetap menghitung anggota yang belum dikenal', () => {
    // Saat dua HP menulis terpisah, pengeluaran bisa tiba lebih dulu daripada
    // operasi yang menambahkan anggotanya. Mengabaikannya akan membuat total
    // saldo tidak nol — kebocoran yang persis ingin dicegah.
    const balances = computeBalances(
      ['m1'],
      [
        {
          id: 'e1',
          payerId: 'm1',
          total: 50_000,
          participants: ['m1', 'orang-baru'],
          mode: { kind: 'equal' },
        },
      ],
      [],
    );

    expect(balances.get('orang-baru')).toBe(-25_000);
    expect(totalOf(balances)).toBe(0);
  });

  it('perspectiveOf memisahkan "kamu berutang" dari "kamu menagih"', () => {
    const balances = new Map([
      ['m1', 60_000],
      ['m2', -60_000],
    ]);

    expect(perspectiveOf(balances, 'm1')).toEqual({ owes: 0, isOwed: 60_000, net: 60_000 });
    expect(perspectiveOf(balances, 'm2')).toEqual({ owes: 60_000, isOwed: 0, net: -60_000 });
    expect(perspectiveOf(balances, 'tidak-ada')).toEqual({ owes: 0, isOwed: 0, net: 0 });
  });
});

describe('INVARIAN: seluruh saldo selalu berjumlah nol', () => {
  it('bertahan untuk 300 riwayat grup acak', () => {
    const rng = makeRng(999);

    for (let run = 0; run < 300; run++) {
      const n = randomInt(rng, 2, 7);
      const ids = memberIds(n);

      const expenses: ExpenseForBalance[] = [];
      for (let e = 0; e < randomInt(rng, 0, 12); e++) {
        const total = randomInt(rng, 0, 5_000_000);
        const participantCount = randomInt(rng, 1, n);
        const participants = ids.slice(0, participantCount);
        const bps = randomPartition(rng, 10_000, participants.length);
        const percents: Record<string, number> = {};
        participants.forEach((id, i) => (percents[id] = bps[i]! / 100));

        expenses.push({
          id: `run${run}-e${e}`,
          payerId: ids[randomInt(rng, 0, n - 1)]!,
          total,
          participants,
          mode: rng() < 0.5 ? { kind: 'equal' } : { kind: 'percent', percents },
        });
      }

      const settlements = Array.from({ length: randomInt(rng, 0, 4) }, () => ({
        fromId: ids[randomInt(rng, 0, n - 1)]!,
        toId: ids[randomInt(rng, 0, n - 1)]!,
        amount: randomInt(rng, 0, 1_000_000),
      }));

      expect(totalOf(computeBalances(ids, expenses, settlements))).toBe(0);
    }
  });
});

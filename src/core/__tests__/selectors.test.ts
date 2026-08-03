import { activeExpenses, fold, type Op } from '../ops';
import { balancesOf, displayName, totalSpend, transfersOf } from '../selectors';

const GROUP = 'g1';

function op<T extends Op['type']>(
  id: string,
  type: T,
  seq: number,
  payload: Extract<Op, { type: T }>['payload'],
): Op {
  return {
    id,
    groupId: GROUP,
    type,
    authorId: 'm1',
    clientTs: 1_700_000_000_000 + seq,
    seq,
    payload,
  } as Op;
}

const base: Op[] = [
  op('o1', 'group.create', 1, { name: 'Kos Keputih', currency: 'IDR' }),
  op('o2', 'member.add', 2, { memberId: 'm1', displayName: 'Efan' }),
  op('o3', 'member.add', 3, { memberId: 'm2', displayName: 'Rian' }),
  op('o4', 'member.add', 4, { memberId: 'm3', displayName: 'Dika' }),
  op('o5', 'expense.add', 5, {
    expenseId: 'e1',
    description: 'Galon',
    total: 45_000,
    payerId: 'm1',
    participants: ['m1', 'm2', 'm3'],
    mode: { kind: 'equal' },
    occurredAt: 1_700_000_000_000,
  }),
  op('o6', 'expense.add', 6, {
    expenseId: 'e2',
    description: 'Wifi',
    total: 150_000,
    payerId: 'm2',
    participants: ['m1', 'm2', 'm3'],
    mode: { kind: 'equal' },
    occurredAt: 1_700_000_100_000,
  }),
];

const deleted = op('o7', 'expense.delete', 7, { expenseId: 'e1' });

describe('pengeluaran yang dihapus tidak boleh ikut terhitung di mana pun', () => {
  // Log sengaja menyimpan jejak penghapusan, jadi `state.expenses` tetap berisi
  // pengeluaran yang sudah dihapus. Siapa pun yang memakai `.size` akan mendapat
  // angka yang tidak pernah turun — persis bug yang muncul di kartu daftar grup.
  it('peta pengeluaran memang tetap menyimpan yang terhapus', () => {
    const state = fold(GROUP, [...base, deleted]);
    expect(state.expenses.size).toBe(2);
  });

  it('tapi activeExpenses tidak — inilah angka yang benar untuk ditampilkan', () => {
    const state = fold(GROUP, [...base, deleted]);
    expect(activeExpenses(state)).toHaveLength(1);
    expect(activeExpenses(state)[0]!.id).toBe('e2');
  });

  it('totalSpend mengabaikan yang terhapus', () => {
    expect(totalSpend(fold(GROUP, base))).toBe(195_000);
    expect(totalSpend(fold(GROUP, [...base, deleted]))).toBe(150_000);
  });

  it('saldo ikut menyesuaikan setelah penghapusan', () => {
    const before = balancesOf(fold(GROUP, base));
    const after = balancesOf(fold(GROUP, [...base, deleted]));

    expect(before.get('m1')).toBe(45_000 - 15_000 - 50_000);
    expect(after.get('m1')).toBe(-50_000);
  });
});

describe('balancesOf → transfersOf', () => {
  it('daftar transfer melunaskan semua orang', () => {
    const state = fold(GROUP, base);
    const balances = balancesOf(state);
    const transfers = transfersOf(state);

    const after = new Map(balances);
    for (const t of transfers) {
      after.set(t.fromId, after.get(t.fromId)! + t.amount);
      after.set(t.toId, after.get(t.toId)! - t.amount);
    }

    expect([...after.values()]).toEqual([0, 0, 0]);
    expect(transfers.length).toBeLessThanOrEqual(2);
  });

  it('grup tanpa pengeluaran tidak menghasilkan transfer apa pun', () => {
    expect(transfersOf(fold(GROUP, base.slice(0, 4)))).toEqual([]);
  });

  it('displayName tetap mengenali anggota yang sudah dihapus', () => {
    // Nama masih dibutuhkan untuk menampilkan pengeluaran lama.
    const state = fold(GROUP, [...base, op('o8', 'member.remove', 8, { memberId: 'm3' })]);
    expect(displayName(state, 'm3')).toBe('Dika');
    expect(displayName(state, 'entah-siapa')).toBe('Anggota tak dikenal');
  });
});

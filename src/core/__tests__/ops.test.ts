import { activeExpenses, activeMembers, fold, type Op } from '../ops';
import { makeRng } from './helpers';

const GROUP = 'g1';

function op<T extends Op['type']>(
  type: T,
  seq: number | null,
  payload: Extract<Op, { type: T }>['payload'],
  overrides: Partial<Op> = {},
): Op {
  return {
    id: `op-${type}-${seq ?? 'local'}-${JSON.stringify(payload).length}`,
    groupId: GROUP,
    type,
    authorId: 'm1',
    clientTs: 1_700_000_000_000 + (seq ?? 999),
    seq,
    payload,
    ...overrides,
  } as Op;
}

const baseOps = (): Op[] => [
  op('group.create', 1, { name: 'Kos Keputih', currency: 'IDR' }),
  op('member.add', 2, { memberId: 'm1', displayName: 'Efan' }),
  op('member.add', 3, { memberId: 'm2', displayName: 'Rian' }),
  op('expense.add', 4, {
    expenseId: 'e1',
    description: 'Galon + gas',
    total: 45_000,
    payerId: 'm1',
    participants: ['m1', 'm2'],
    mode: { kind: 'equal' },
    occurredAt: 1_700_000_000_000,
  }),
];

describe('fold', () => {
  it('membangun state dari nol', () => {
    const state = fold(GROUP, baseOps());

    expect(state.name).toBe('Kos Keputih');
    expect(activeMembers(state).map((m) => m.displayName)).toEqual(['Efan', 'Rian']);
    expect(activeExpenses(state)).toHaveLength(1);
    expect(activeExpenses(state)[0]!.total).toBe(45_000);
  });

  it('mengabaikan operasi milik grup lain', () => {
    const ops = [...baseOps(), op('member.add', 5, { memberId: 'x', displayName: 'Asing' }, { groupId: 'grup-lain' })];
    expect(activeMembers(fold(GROUP, ops))).toHaveLength(2);
  });

  it('menghapus pengeluaran tanpa membuang jejaknya', () => {
    const ops = [...baseOps(), op('expense.delete', 5, { expenseId: 'e1' })];
    const state = fold(GROUP, ops);

    expect(activeExpenses(state)).toHaveLength(0);
    expect(state.expenses.get('e1')!.deleted).toBe(true);
  });

  it('mempertahankan nama anggota yang sudah dihapus, demi riwayat lama', () => {
    const ops = [...baseOps(), op('member.remove', 5, { memberId: 'm2' })];
    const state = fold(GROUP, ops);

    expect(activeMembers(state)).toHaveLength(1);
    expect(state.members.get('m2')!.displayName).toBe('Rian');
  });

  it('mengabaikan operasi ubah untuk pengeluaran yang tidak dikenal, bukan gagal', () => {
    const ops = [...baseOps(), op('expense.edit', 5, { expenseId: 'entah-apa', total: 1 })];
    expect(() => fold(GROUP, ops)).not.toThrow();
  });
});

describe('perubahan digabung per field (last-op-wins)', () => {
  it('dua orang mengubah field berbeda — kedua perubahan bertahan', () => {
    // Skenario nyata: satu orang membetulkan nominal, satu lagi membetulkan
    // keterangan, keduanya saat offline. Kalau yang disinkronkan baris tabel,
    // salah satu perubahan pasti hilang. Dengan operasi, keduanya selamat.
    const ops = [
      ...baseOps(),
      op('expense.edit', 5, { expenseId: 'e1', total: 50_000 }),
      op('expense.edit', 6, { expenseId: 'e1', description: 'Galon, gas, tisu' }),
    ];
    const expense = fold(GROUP, ops).expenses.get('e1')!;

    expect(expense.total).toBe(50_000);
    expect(expense.description).toBe('Galon, gas, tisu');
  });

  it('dua orang mengubah field yang sama — nomor urut server yang menentukan', () => {
    const ops = [
      ...baseOps(),
      op('expense.edit', 6, { expenseId: 'e1', total: 70_000 }),
      op('expense.edit', 5, { expenseId: 'e1', total: 60_000 }),
    ];
    expect(fold(GROUP, ops).expenses.get('e1')!.total).toBe(70_000);
  });

  it('operasi yang masih tertahan di HP dianggap paling baru', () => {
    // Sebelum server memberi nomor, perubahan lokal harus terlihat langsung di
    // layar — kalau tidak, aplikasi terasa "menolak" ketikan penggunanya.
    const ops = [
      ...baseOps(),
      op('expense.edit', 9, { expenseId: 'e1', total: 70_000 }),
      op('expense.edit', null, { expenseId: 'e1', total: 12_345 }),
    ];
    expect(fold(GROUP, ops).expenses.get('e1')!.total).toBe(12_345);
  });
});

describe('SIFAT WAJIB log operasi', () => {
  it('deterministik: urutan kedatangan tidak memengaruhi hasil', () => {
    // Dua HP menarik operasi yang sama dalam urutan berbeda. Kalau state yang
    // dihasilkan bisa berbeda, seluruh gagasan sinkronisasi ini runtuh.
    const ops = [
      ...baseOps(),
      op('expense.edit', 5, { expenseId: 'e1', total: 50_000 }),
      op('member.rename', 6, { memberId: 'm2', displayName: 'Rian A.' }),
      op('settlement.add', 7, {
        settlementId: 's1',
        fromId: 'm2',
        toId: 'm1',
        amount: 25_000,
        occurredAt: 1_700_000_100_000,
      }),
    ];

    const rng = makeRng(7);
    const expected = JSON.stringify(serialise(fold(GROUP, ops)));

    for (let i = 0; i < 50; i++) {
      const shuffled = [...ops].sort(() => rng() - 0.5);
      expect(JSON.stringify(serialise(fold(GROUP, shuffled)))).toBe(expected);
    }
  });

  it('idempoten: operasi yang sama masuk dua kali tidak mengubah apa pun', () => {
    // Ini yang membuat pengiriman ulang aman. Sinyal putus di tengah kirim,
    // HP mengirim lagi — dan tidak ada pengeluaran ganda.
    const ops = baseOps();
    const once = serialise(fold(GROUP, ops));
    const twice = serialise(fold(GROUP, [...ops, ...ops, ...ops]));

    expect(twice).toEqual(once);
  });
});

function serialise(state: ReturnType<typeof fold>) {
  return {
    name: state.name,
    currency: state.currency,
    members: [...state.members.entries()].sort(),
    expenses: [...state.expenses.entries()].sort(),
    settlements: [...state.settlements.entries()].sort(),
  };
}

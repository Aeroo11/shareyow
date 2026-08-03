import { activeExpenses, activeMembers, type Op } from '../../core/ops';
import { migrate } from '../migrations';
import {
  appendOps,
  countPendingOps,
  getIdentity,
  loadAllGroups,
  loadGroup,
  markSynced,
  pendingOps,
  setIdentity,
} from '../repository';
import { openTestDatabase } from './sqlite-adapter';

const GROUP = 'grup-kos';

function op(
  id: string,
  type: Op['type'],
  payload: unknown,
  seq: number | null = null,
  groupId = GROUP,
): Op {
  return {
    id,
    groupId,
    type,
    authorId: 'm1',
    clientTs: 1_700_000_000_000 + Number(id.replace(/\D/g, '') || 0),
    seq,
    payload,
  } as Op;
}

const seedOps = (): Op[] => [
  op('op1', 'group.create', { name: 'Kos Keputih', currency: 'IDR' }, 1),
  op('op2', 'member.add', { memberId: 'm1', displayName: 'Efan' }, 2),
  op('op3', 'member.add', { memberId: 'm2', displayName: 'Rian' }, 3),
  op('op4', 'expense.add', {
    expenseId: 'e1',
    description: 'Galon + gas',
    total: 45_000,
    payerId: 'm1',
    participants: ['m1', 'm2'],
    mode: { kind: 'equal' },
    occurredAt: 1_700_000_000_000,
  }, 4),
];

describe('skema dan repository terhadap SQLite sungguhan', () => {
  let db: ReturnType<typeof openTestDatabase>;

  beforeEach(async () => {
    db = openTestDatabase();
    await migrate(db);
  });

  afterEach(() => db.closeSync());

  it('migrasi berjalan dan menaikkan user_version', async () => {
    const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
    expect(row?.user_version).toBe(1);
  });

  it('migrasi kedua tidak melakukan apa-apa — aman dijalankan tiap kali aplikasi dibuka', async () => {
    await appendOps(db, seedOps());
    await expect(migrate(db)).resolves.toBeUndefined();
    expect((await loadGroup(db, GROUP))!.expenses.size).toBe(1);
  });

  it('menyimpan lalu membaca kembali seluruh grup', async () => {
    await appendOps(db, seedOps());
    const state = (await loadGroup(db, GROUP))!;

    expect(state.name).toBe('Kos Keputih');
    expect(activeMembers(state).map((m) => m.displayName)).toEqual(['Efan', 'Rian']);
    expect(activeExpenses(state)[0]!.total).toBe(45_000);
    // Payload JSON harus kembali sebagai objek, bukan teks.
    expect(activeExpenses(state)[0]!.mode).toEqual({ kind: 'equal' });
  });

  it('mengembalikan null untuk grup yang tidak ada', async () => {
    expect(await loadGroup(db, 'entah-apa')).toBeNull();
  });

  it('menyimpan operasi yang sama dua kali tanpa menggandakan apa pun', async () => {
    // Ini yang membuat pengiriman ulang aman: sinyal putus di tengah kirim, HP
    // mengirim lagi, dan tidak ada pengeluaran ganda.
    await appendOps(db, seedOps());
    await appendOps(db, seedOps());

    const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM ops');
    expect(row?.n).toBe(4);
    expect(activeExpenses((await loadGroup(db, GROUP))!)).toHaveLength(1);
  });

  it('memisahkan grup satu dengan lainnya', async () => {
    await appendOps(db, [
      ...seedOps(),
      op('x1', 'group.create', { name: 'FP Visi Komputer', currency: 'IDR' }, 1, 'grup-lain'),
      op('x2', 'member.add', { memberId: 'z1', displayName: 'Dika' }, 2, 'grup-lain'),
    ]);

    const groups = await loadAllGroups(db);
    expect(groups.map((g) => g.name)).toEqual(['FP Visi Komputer', 'Kos Keputih']);
    expect(activeMembers(groups.find((g) => g.id === 'grup-lain')!)).toHaveLength(1);
  });
});

describe('antrean kirim', () => {
  let db: ReturnType<typeof openTestDatabase>;

  beforeEach(async () => {
    db = openTestDatabase();
    await migrate(db);
  });

  afterEach(() => db.closeSync());

  it('operasi tanpa nomor urut menunggu di antrean; yang sudah bernomor tidak', async () => {
    await appendOps(db, [
      op('op1', 'group.create', { name: 'Kos', currency: 'IDR' }, 1),
      op('op2', 'member.add', { memberId: 'm1', displayName: 'Efan' }, null),
      op('op3', 'member.add', { memberId: 'm2', displayName: 'Rian' }, null),
    ]);

    expect(await countPendingOps(db)).toBe(2);
    expect((await pendingOps(db)).map((o) => o.id)).toEqual(['op2', 'op3']);
  });

  it('operasi yang sudah diakui server keluar dari antrean', async () => {
    await appendOps(db, [
      op('op2', 'member.add', { memberId: 'm1', displayName: 'Efan' }, null),
      op('op3', 'member.add', { memberId: 'm2', displayName: 'Rian' }, null),
    ]);

    await markSynced(db, [{ id: 'op2', seq: 7 }]);

    expect(await countPendingOps(db)).toBe(1);
    const state = (await loadGroup(db, GROUP))!;
    expect(activeMembers(state)).toHaveLength(2); // keduanya tetap terlihat di layar
  });

  it('pengakuan server tidak menimpa nomor urut yang sudah ada', async () => {
    await appendOps(db, [op('op1', 'group.create', { name: 'Kos', currency: 'IDR' }, 5)]);
    await markSynced(db, [{ id: 'op1', seq: 99 }]);

    const row = await db.getFirstAsync<{ seq: number }>('SELECT seq FROM ops WHERE id = ?', 'op1');
    expect(row?.seq).toBe(5);
  });
});

describe('identitas per grup', () => {
  it('menyimpan dan menimpa anggota mana yang "aku"', async () => {
    const db = openTestDatabase();
    await migrate(db);

    expect(await getIdentity(db, GROUP)).toBeNull();

    await setIdentity(db, GROUP, 'm1');
    expect(await getIdentity(db, GROUP)).toBe('m1');

    await setIdentity(db, GROUP, 'm2');
    expect(await getIdentity(db, GROUP)).toBe('m2');

    db.closeSync();
  });
});

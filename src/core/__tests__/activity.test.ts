import { describeOps, timeAgo } from '../activity';
import { fold, type Op } from '../ops';

const GROUP = 'g1';

function op<T extends Op['type']>(
  id: string,
  type: T,
  seq: number | null,
  authorId: string,
  payload: Extract<Op, { type: T }>['payload'],
): Op {
  return {
    id,
    groupId: GROUP,
    type,
    authorId,
    clientTs: 1_700_000_000_000 + (seq ?? 999) * 1000,
    seq,
    payload,
  } as Op;
}

const ops: Op[] = [
  op('o1', 'group.create', 1, 'm1', { name: 'Kos Keputih', currency: 'IDR' }),
  op('o2', 'member.add', 2, 'm1', { memberId: 'm1', displayName: 'Efan' }),
  op('o3', 'member.add', 3, 'm1', { memberId: 'm2', displayName: 'Rian' }),
  op('o4', 'expense.add', 4, 'm1', {
    expenseId: 'e1',
    description: 'Wifi bulanan',
    total: 150_000,
    payerId: 'm2',
    participants: ['m1', 'm2'],
    mode: { kind: 'equal' },
    occurredAt: 1_700_000_000_000,
  }),
  op('o5', 'settlement.add', 5, 'm2', {
    settlementId: 's1',
    fromId: 'm1',
    toId: 'm2',
    amount: 75_000,
    occurredAt: 1_700_000_000_000,
  }),
];

const state = () => fold(GROUP, ops);

describe('describeOps', () => {
  it('menerjemahkan tiap operasi jadi satu kalimat berbahasa manusia', () => {
    const entries = describeOps(state(), ops);
    const texts = entries.map((e) => `${e.actor} ${e.text}`);

    expect(texts).toContain('Efan membuat grup Kos Keputih');
    expect(texts).toContain('Efan menambahkan Rian');
    expect(texts).toContain('Efan mencatat Wifi bulanan');
    expect(texts).toContain('Rian menandai Efan → Rian sudah dibayar');
  });

  it('menempatkan yang terbaru di atas', () => {
    const entries = describeOps(state(), ops);
    expect(entries[0]!.id).toBe('o5');
    expect(entries[entries.length - 1]!.id).toBe('o1');
  });

  it('menyertakan nominal hanya pada operasi yang memang punya nominal', () => {
    const byId = new Map(describeOps(state(), ops).map((e) => [e.id, e]));

    expect(byId.get('o4')!.amount).toBe(150_000);
    expect(byId.get('o5')!.amount).toBe(75_000);
    expect(byId.get('o2')!.amount).toBeUndefined();
  });

  it('menandai operasi yang belum sampai ke server', () => {
    const pendingOp = op('o6', 'expense.add', null, 'm1', {
      expenseId: 'e2',
      description: 'Galon',
      total: 20_000,
      payerId: 'm1',
      participants: ['m1'],
      mode: { kind: 'equal' },
      occurredAt: 1_700_000_000_000,
    });

    const entries = describeOps(fold(GROUP, [...ops, pendingOp]), [...ops, pendingOp]);
    // Yang belum bernomor dianggap paling baru, jadi ia berada di paling atas.
    expect(entries[0]!.id).toBe('o6');
    expect(entries[0]!.pending).toBe(true);
    expect(entries[1]!.pending).toBe(false);
  });

  it('tetap menyebut nama pengeluaran yang sudah dihapus', () => {
    // Riwayat harus bisa dibaca setelah kejadiannya berlalu. Kalau nama
    // pengeluaran ikut hilang saat dihapus, barisnya jadi tidak berarti apa-apa.
    const withDelete = [...ops, op('o7', 'expense.delete', 6, 'm1', { expenseId: 'e1' })];
    const entries = describeOps(fold(GROUP, withDelete), withDelete);

    expect(entries[0]!.text).toBe('menghapus Wifi bulanan');
  });

  it('menyebut "Seseorang" untuk pelaku yang belum dikenal', () => {
    // Bisa terjadi saat sinkronisasi: operasi tiba lebih dulu daripada operasi
    // yang menambahkan pembuatnya.
    const asing = op('o8', 'expense.delete', 7, 'orang-asing', { expenseId: 'e1' });
    const entries = describeOps(fold(GROUP, [...ops, asing]), [...ops, asing]);

    expect(entries[0]!.actor).toBe('Seseorang');
  });
});

describe('timeAgo', () => {
  const now = 1_700_000_000_000;
  const ago = (ms: number) => timeAgo(now - ms, now);

  it.each([
    [30 * 1000, 'baru saja'],
    [5 * 60_000, '5 menit lalu'],
    [3 * 3_600_000, '3 jam lalu'],
    [2 * 86_400_000, '2 hari lalu'],
    [45 * 86_400_000, '1 bulan lalu'],
    [400 * 86_400_000, '1 tahun lalu'],
  ])('%i ms → %s', (elapsed, expected) => {
    expect(ago(elapsed)).toBe(expected);
  });

  it('tidak pernah menampilkan waktu negatif walau jam perangkat meleset', () => {
    expect(timeAgo(now + 60_000, now)).toBe('baru saja');
  });
});

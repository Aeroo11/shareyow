import { balancesOf } from '../selectors';
import { fold, type GroupState, type Op } from '../ops';
import { applyAcks, opsToPush, planMerge, statusOf, type Ack } from '../sync';
import { makeRng, randomInt } from './helpers';

const GROUP = 'g1';

/**
 * Server palsu — seluruh perilaku server yang penting, dalam 20 baris.
 *
 * Satu hal yang ditiru dengan sengaja: nomor urut diberikan **saat operasi
 * diterima**, bukan saat dibuat. Itulah yang membuat urutan akhirnya ditentukan
 * kedatangan di server, bukan jam perangkat yang bisa saja salah setel.
 */
class FakeServer {
  private stored: Op[] = [];
  private nextSeq = 1;

  push(ops: Op[]): Ack[] {
    const acks: Ack[] = [];
    for (const op of ops) {
      const existing = this.stored.find((s) => s.id === op.id);
      if (existing) {
        // Pengiriman ulang: nomor yang sudah ada dikembalikan apa adanya.
        acks.push({ id: existing.id, seq: existing.seq! });
        continue;
      }
      const stamped = { ...op, seq: this.nextSeq++ };
      this.stored.push(stamped);
      acks.push({ id: stamped.id, seq: stamped.seq });
    }
    return acks;
  }

  pull(groupId: string, since: number): Op[] {
    return this.stored
      .filter((op) => op.groupId === groupId && op.seq! > since)
      .sort((a, b) => a.seq! - b.seq!);
  }
}

/** Satu HP: punya operasinya sendiri, kursornya sendiri, dan bisa offline. */
class Device {
  ops: Op[] = [];
  cursor = 0;

  constructor(readonly name: string) {}

  write(op: Op): void {
    this.ops.push({ ...op, seq: null });
  }

  sync(server: FakeServer): void {
    const acks = server.push(opsToPush(this.ops));
    this.ops = applyAcks(this.ops, acks);

    const plan = planMerge(this.ops, server.pull(GROUP, this.cursor), this.cursor);
    this.ops = [...this.ops, ...plan.insert];
    this.ops = applyAcks(this.ops, plan.ack);
    this.cursor = plan.nextCursor;
  }

  state(): GroupState {
    return fold(GROUP, this.ops);
  }
}

let counter = 0;
function op<T extends Op['type']>(
  type: T,
  authorId: string,
  payload: Extract<Op, { type: T }>['payload'],
  clientTs = 1_700_000_000_000 + counter,
): Op {
  counter += 1;
  return { id: `op-${counter}`, groupId: GROUP, type, authorId, clientTs, seq: null, payload } as Op;
}

function expensePayload(expenseId: string, description: string, total: number, payerId: string) {
  return {
    expenseId,
    description,
    total,
    payerId,
    participants: ['m1', 'm2'],
    mode: { kind: 'equal' as const },
    occurredAt: 1_700_000_000_000,
  };
}

function seed(device: Device) {
  device.write(op('group.create', 'm1', { name: 'Kos Keputih', currency: 'IDR' }));
  device.write(op('member.add', 'm1', { memberId: 'm1', displayName: 'Efan' }));
  device.write(op('member.add', 'm1', { memberId: 'm2', displayName: 'Rian' }));
}

function serialise(state: GroupState) {
  return JSON.stringify({
    name: state.name,
    members: [...state.members.entries()].sort(),
    expenses: [...state.expenses.entries()].sort(),
    settlements: [...state.settlements.entries()].sort(),
  });
}

describe('opsToPush', () => {
  it('hanya mengambil yang belum bernomor, dalam urutan pembuatan', () => {
    const ops: Op[] = [
      { ...op('member.add', 'm1', { memberId: 'a', displayName: 'A' }), seq: 5 },
      op('member.add', 'm1', { memberId: 'b', displayName: 'B' }, 200),
      op('member.add', 'm1', { memberId: 'c', displayName: 'C' }, 100),
    ];

    const pushed = opsToPush(ops);
    expect(pushed).toHaveLength(2);
    // Urutan pembuatan dipertahankan: expense.add harus tiba sebelum edit-nya.
    expect(pushed[0]!.clientTs).toBeLessThan(pushed[1]!.clientTs);
  });
});

describe('planMerge', () => {
  it('menyimpan operasi yang belum pernah dilihat', () => {
    const incoming = { ...op('member.add', 'm1', { memberId: 'x', displayName: 'X' }), seq: 3 };
    const plan = planMerge([], [incoming], 0);

    expect(plan.insert).toEqual([incoming]);
    expect(plan.ack).toEqual([]);
    expect(plan.nextCursor).toBe(3);
  });

  it('operasi sendiri yang kembali hanya dicatat nomornya, tidak digandakan', () => {
    // Ini kasus yang paling gampang terlewat, dan akibatnya paling parah:
    // memperlakukannya sebagai operasi baru menggandakan setiap pengeluaran
    // yang pernah dikirim perangkat ini.
    const mine = op('expense.add', 'm1', expensePayload('e1', 'Galon', 45_000, 'm1'));
    const plan = planMerge([mine], [{ ...mine, seq: 7 }], 0);

    expect(plan.insert).toEqual([]);
    expect(plan.ack).toEqual([{ id: mine.id, seq: 7 }]);
  });

  it('mengabaikan tarikan yang tumpang tindih', () => {
    const known = { ...op('member.add', 'm1', { memberId: 'x', displayName: 'X' }), seq: 2 };
    const plan = planMerge([known], [known], 5);

    expect(plan.insert).toEqual([]);
    expect(plan.ack).toEqual([]);
    // Kursor tidak boleh mundur hanya karena menarik ulang operasi lama.
    expect(plan.nextCursor).toBe(5);
  });

  it('gagal keras kalau server mengirim operasi tanpa nomor', () => {
    const bad = op('member.add', 'm1', { memberId: 'x', displayName: 'X' });
    expect(() => planMerge([], [bad], 0)).toThrow(/tanpa nomor urut/);
  });
});

describe('applyAcks', () => {
  it('tidak menimpa nomor yang sudah ada', () => {
    const already = { ...op('member.add', 'm1', { memberId: 'x', displayName: 'X' }), seq: 3 };
    expect(applyAcks([already], [{ id: already.id, seq: 99 }])[0]!.seq).toBe(3);
  });
});

describe('statusOf', () => {
  it('menghitung berapa operasi yang masih menunggu', () => {
    const ops: Op[] = [
      { ...op('member.add', 'm1', { memberId: 'a', displayName: 'A' }), seq: 1 },
      op('member.add', 'm1', { memberId: 'b', displayName: 'B' }),
    ];
    expect(statusOf(ops, 4)).toEqual({ pendingCount: 1, cursor: 4 });
  });
});

describe('KONVERGENSI: dua perangkat selalu berakhir dengan keadaan identik', () => {
  it('dua orang mencatat saat sama-sama offline, lalu keduanya online', () => {
    const server = new FakeServer();
    const a = new Device('A');
    const b = new Device('B');

    seed(a);
    a.sync(server);
    b.sync(server);

    // Mode pesawat: keduanya menulis tanpa tahu apa yang ditulis yang lain.
    a.write(op('expense.add', 'm1', expensePayload('e1', 'Galon', 45_000, 'm1')));
    b.write(op('expense.add', 'm2', expensePayload('e2', 'Wifi', 150_000, 'm2')));

    // Sinyal kembali.
    a.sync(server);
    b.sync(server);
    a.sync(server);

    expect(serialise(a.state())).toBe(serialise(b.state()));
    expect(a.state().expenses.size).toBe(2);
  });

  it('konvergen untuk 200 urutan sinkronisasi acak', () => {
    // Inilah pertanyaan yang sebenarnya: apa pun urutan siapa menulis dan siapa
    // menyinkron lebih dulu, kedua HP harus berakhir menampilkan angka yang sama.
    const rng = makeRng(31337);

    for (let run = 0; run < 200; run++) {
      const server = new FakeServer();
      const a = new Device('A');
      const b = new Device('B');

      seed(a);
      a.sync(server);
      b.sync(server);

      const devices = [a, b];
      for (let step = 0; step < randomInt(rng, 4, 14); step++) {
        const device = devices[randomInt(rng, 0, 1)]!;

        if (rng() < 0.6) {
          const n = counter;
          device.write(
            rng() < 0.75
              ? op('expense.add', 'm1', expensePayload(`e${n}`, `Beli ${n}`, randomInt(rng, 1, 900) * 1000, rng() < 0.5 ? 'm1' : 'm2'))
              : op('settlement.add', 'm1', {
                  settlementId: `s${n}`,
                  fromId: 'm2',
                  toId: 'm1',
                  amount: randomInt(rng, 1, 200) * 1000,
                  occurredAt: 1_700_000_000_000,
                }),
          );
        } else {
          device.sync(server);
        }
      }

      // Sinkronisasi penutup: dua putaran karena masing-masing perlu mengirim
      // miliknya lalu menarik milik yang lain.
      a.sync(server);
      b.sync(server);
      a.sync(server);
      b.sync(server);

      expect(serialise(a.state())).toBe(serialise(b.state()));

      // Dan yang paling penting: hasil konvergennya masih sah secara akuntansi.
      const total = [...balancesOf(a.state()).values()].reduce((x, y) => x + y, 0);
      expect(total).toBe(0);
    }
  });

  it('mengirim ulang setelah koneksi putus tidak menggandakan apa pun', () => {
    const server = new FakeServer();
    const a = new Device('A');

    seed(a);
    a.write(op('expense.add', 'm1', expensePayload('e1', 'Galon', 45_000, 'm1')));

    // Sinyal putus tepat setelah server menerima tapi sebelum jawabannya sampai:
    // perangkat tidak pernah tahu operasinya sudah tersimpan, jadi ia mengirim lagi.
    server.push(opsToPush(a.ops));
    a.sync(server);
    a.sync(server);

    expect(a.state().expenses.size).toBe(1);
    expect(statusOf(a.ops, a.cursor).pendingCount).toBe(0);
  });

  it('perangkat ketiga yang baru bergabung menarik seluruh riwayat', () => {
    const server = new FakeServer();
    const a = new Device('A');

    seed(a);
    a.write(op('expense.add', 'm1', expensePayload('e1', 'Galon', 45_000, 'm1')));
    a.write(op('expense.add', 'm1', expensePayload('e2', 'Wifi', 150_000, 'm2')));
    a.sync(server);

    const c = new Device('C');
    c.sync(server);

    expect(serialise(c.state())).toBe(serialise(a.state()));
  });
});

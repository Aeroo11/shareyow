/**
 * Aksi pengguna → operasi.
 *
 * Setiap fungsi di sini membangun satu atau beberapa operasi lalu menyimpannya.
 * Perhatikan tidak ada satu pun cabang "kalau online, kirim ke server; kalau
 * tidak, simpan lokal". Memang itu intinya: menulis saat offline dan saat online
 * adalah jalur kode yang sama persis. Mesin sinkronisasi nanti hanya bertugas
 * menguras operasi yang `seq`-nya masih null — kapan pun sinyal kebetulan ada.
 */

import type { SQLiteDatabase } from 'expo-sqlite';
import type { ExpenseFields, Op } from '../core/ops';
import type { MemberId } from '../core/split';
import type { Rupiah } from '../core/money';
import { newId } from './ids';
import { bumpRevision } from './live';
import { appendOps, setIdentity } from './repository';

function build<T extends Op['type']>(
  type: T,
  groupId: string,
  authorId: MemberId,
  payload: Extract<Op, { type: T }>['payload'],
): Op {
  return {
    id: newId(),
    groupId,
    type,
    authorId,
    clientTs: Date.now(),
    seq: null,
    payload,
  } as Op;
}

async function commit(db: SQLiteDatabase, ops: Op[]): Promise<void> {
  await appendOps(db, ops);
  bumpRevision();
}

export interface CreateGroupInput {
  name: string;
  /** Namamu sendiri — kamu otomatis jadi anggota pertama. */
  myName: string;
  /** Nama teman-teman. Mereka tidak perlu punya akun, bahkan tidak perlu tahu. */
  otherNames: string[];
}

export async function createGroup(
  db: SQLiteDatabase,
  input: CreateGroupInput,
): Promise<{ groupId: string; myMemberId: MemberId }> {
  const groupId = newId();
  const myMemberId = newId();

  const ops: Op[] = [
    build('group.create', groupId, myMemberId, { name: input.name.trim(), currency: 'IDR' }),
    build('member.add', groupId, myMemberId, {
      memberId: myMemberId,
      displayName: input.myName.trim(),
    }),
    ...input.otherNames
      .map((n) => n.trim())
      .filter((n) => n.length > 0)
      .map((displayName) =>
        build('member.add', groupId, myMemberId, { memberId: newId(), displayName }),
      ),
  ];

  await appendOps(db, ops);
  await setIdentity(db, groupId, myMemberId);
  bumpRevision();

  return { groupId, myMemberId };
}

export async function addMember(
  db: SQLiteDatabase,
  groupId: string,
  authorId: MemberId,
  displayName: string,
): Promise<MemberId> {
  const memberId = newId();
  await commit(db, [
    build('member.add', groupId, authorId, { memberId, displayName: displayName.trim() }),
  ]);
  return memberId;
}

export async function renameMember(
  db: SQLiteDatabase,
  groupId: string,
  authorId: MemberId,
  memberId: MemberId,
  displayName: string,
): Promise<void> {
  await commit(db, [
    build('member.rename', groupId, authorId, { memberId, displayName: displayName.trim() }),
  ]);
}

export async function removeMember(
  db: SQLiteDatabase,
  groupId: string,
  authorId: MemberId,
  memberId: MemberId,
): Promise<void> {
  await commit(db, [build('member.remove', groupId, authorId, { memberId })]);
}

export async function addExpense(
  db: SQLiteDatabase,
  groupId: string,
  authorId: MemberId,
  /**
   * Id dibuat di layar form, bukan di sini — dan itu bukan detail sepele.
   *
   * Id ini juga menjadi seed pembagian sisa rupiah (lihat computeShares), jadi
   * pratinjau yang ditampilkan di form dan bagian yang akhirnya tersimpan wajib
   * memakai id yang sama persis. Membuat id di dalam fungsi ini membuat keduanya
   * mustahil disamakan.
   *
   * Bonusnya: tombol Simpan yang tertekan dua kali menghasilkan id yang sama, dan
   * INSERT OR IGNORE di repository membuat penyimpanan kedua tidak berpengaruh.
   */
  expenseId: string,
  fields: ExpenseFields,
): Promise<void> {
  await commit(db, [build('expense.add', groupId, authorId, { expenseId, ...fields })]);
}

export async function editExpense(
  db: SQLiteDatabase,
  groupId: string,
  authorId: MemberId,
  expenseId: string,
  patch: Partial<ExpenseFields>,
): Promise<void> {
  await commit(db, [build('expense.edit', groupId, authorId, { expenseId, ...patch })]);
}

export async function deleteExpense(
  db: SQLiteDatabase,
  groupId: string,
  authorId: MemberId,
  expenseId: string,
): Promise<void> {
  await commit(db, [build('expense.delete', groupId, authorId, { expenseId })]);
}

export async function addSettlement(
  db: SQLiteDatabase,
  groupId: string,
  authorId: MemberId,
  input: { fromId: MemberId; toId: MemberId; amount: Rupiah; note?: string },
): Promise<string> {
  const settlementId = newId();
  await commit(db, [
    build('settlement.add', groupId, authorId, {
      settlementId,
      ...input,
      occurredAt: Date.now(),
    }),
  ]);
  return settlementId;
}

export async function deleteSettlement(
  db: SQLiteDatabase,
  groupId: string,
  authorId: MemberId,
  settlementId: string,
): Promise<void> {
  await commit(db, [build('settlement.delete', groupId, authorId, { settlementId })]);
}

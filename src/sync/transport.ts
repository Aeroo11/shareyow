/**
 * Lapisan jaringan — bagian yang mengantar, bukan bagian yang berpikir.
 *
 * Seluruh keputusan "apa yang harus dikirim" dan "apa yang harus disimpan" sudah
 * dihitung di `core/sync.ts` sebagai fungsi murni yang diuji terhadap 200 urutan
 * sinkronisasi acak. Berkas ini sesempit mungkin dengan sengaja: ia satu-satunya
 * bagian yang hanya bisa diuji dengan koneksi sungguhan, jadi semakin sedikit
 * penalaran yang tinggal di sini, semakin sedikit yang bisa salah tanpa
 * ketahuan test.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Op } from '../core/ops';
import type { Ack } from '../core/sync';
import { getSupabase } from './client';

interface OpRow {
  id: string;
  group_id: string;
  seq: number;
  type: string;
  author_id: string;
  client_ts: number;
  payload: unknown;
}

function toRow(op: Op) {
  return {
    id: op.id,
    group_id: op.groupId,
    type: op.type,
    author_id: op.authorId,
    client_ts: op.clientTs,
    payload: op.payload,
    // `seq` sengaja tidak dikirim. Trigger di basis data selalu menimpanya —
    // penomoran adalah wewenang server, dan klien tidak boleh bisa memilih
    // tempatnya sendiri dalam urutan.
  };
}

function fromRow(row: OpRow): Op {
  return {
    id: row.id,
    groupId: row.group_id,
    seq: row.seq,
    type: row.type,
    authorId: row.author_id,
    clientTs: row.client_ts,
    payload: row.payload,
  } as Op;
}

export class NotSignedInError extends Error {
  constructor() {
    super('Belum masuk ke akun');
  }
}

export class SupabaseTransport {
  constructor(private readonly db: SupabaseClient) {}

  static create(): SupabaseTransport | null {
    const client = getSupabase();
    return client ? new SupabaseTransport(client) : null;
  }

  private async userId(): Promise<string> {
    const { data } = await this.db.auth.getUser();
    if (!data.user) throw new NotSignedInError();
    return data.user.id;
  }

  /**
   * Memastikan grup ini ada di server dan akun ini boleh mengaksesnya.
   *
   * Grup dibuat lebih dulu di HP, jauh sebelum ada akun — itu memang inti
   * produknya. Jadi saat sinkronisasi pertama kali dinyalakan, barisnya baru
   * dibuat di sini. Idempoten, karena ia dipanggil setiap kali menyinkron.
   */
  async ensureGroup(input: { groupId: string; name: string; myMemberId: string }): Promise<void> {
    const uid = await this.userId();

    const group = await this.db
      .from('groups')
      .upsert({ id: input.groupId, name: input.name, created_by: uid }, { onConflict: 'id' });
    if (group.error) throw group.error;

    const access = await this.db
      .from('group_access')
      .upsert(
        { group_id: input.groupId, user_id: uid, member_id: input.myMemberId },
        { onConflict: 'group_id,user_id' },
      );
    if (access.error) throw access.error;
  }

  /**
   * Mengirim operasi, lalu mengambil nomor urut yang diberikan server.
   *
   * Dua langkah, dan langkah kedua bukan pemborosan: penyisipan yang bentrok
   * dilewati diam-diam (`ignoreDuplicates`), sehingga operasi yang sebelumnya
   * sudah sampai tidak ikut terbawa di hasilnya. Tanpa pengambilan kedua,
   * operasi yang jawabannya hilang karena sinyal putus akan menggantung selamanya
   * sebagai "belum tersinkron" padahal server sudah menyimpannya.
   */
  async push(ops: Op[]): Promise<Ack[]> {
    if (ops.length === 0) return [];

    const inserted = await this.db
      .from('ops')
      .upsert(ops.map(toRow), { onConflict: 'id', ignoreDuplicates: true });
    if (inserted.error) throw inserted.error;

    const acked = await this.db
      .from('ops')
      .select('id,seq')
      .in('id', ops.map((op) => op.id));
    if (acked.error) throw acked.error;

    return (acked.data ?? []).map((row) => ({ id: row.id as string, seq: row.seq as number }));
  }

  async pull(groupId: string, since: number): Promise<Op[]> {
    const { data, error } = await this.db
      .from('ops')
      .select('*')
      .eq('group_id', groupId)
      .gt('seq', since)
      .order('seq', { ascending: true });
    if (error) throw error;

    return (data ?? []).map((row) => fromRow(row as OpRow));
  }

  /** Kode undangan berumur pendek, sehingga tangkapan layar lama tidak jadi pintu masuk. */
  async createInvite(groupId: string, validForDays = 7): Promise<{ code: string; expiresAt: number }> {
    const uid = await this.userId();
    const code = randomCode();
    const expiresAt = Date.now() + validForDays * 86_400_000;

    const { error } = await this.db.from('group_invites').insert({
      code,
      group_id: groupId,
      created_by: uid,
      expires_at: new Date(expiresAt).toISOString(),
    });
    if (error) throw error;

    return { code, expiresAt };
  }

  /**
   * Bergabung lewat kode undangan sekaligus mengklaim satu anggota bayangan.
   *
   * Dijalankan sebagai fungsi di basis data karena pemanggilnya justru belum
   * menjadi anggota — ia belum boleh membaca apa pun tentang grup ini sampai
   * fungsi itu selesai.
   */
  async joinGroup(code: string, claimMemberId: string): Promise<string> {
    const { data, error } = await this.db.rpc('join_group', {
      invite_code: code.trim().toUpperCase(),
      claim_member_id: claimMemberId,
    });
    if (error) throw error;
    return data as string;
  }
}

/** Tanpa huruf dan angka yang mudah tertukar saat dibacakan: 0/O, 1/I/L. */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function randomCode(length = 6): string {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(length));
  let code = '';
  for (const byte of bytes) code += ALPHABET[byte % ALPHABET.length];
  return code;
}

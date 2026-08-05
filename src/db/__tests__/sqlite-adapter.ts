/**
 * Menjalankan SQLite sungguhan di dalam test, tanpa perangkat.
 *
 * Node 22 punya SQLite bawaan (`node:sqlite`). Adaptor tipis ini memberinya
 * bentuk yang sama dengan expo-sqlite, sebatas yang dipakai repository. Hasilnya
 * migrasi dan kueri diuji terhadap mesin SQLite betulan — salah ketik di DDL
 * ketahuan di sini, bukan saat aplikasi pertama kali dibuka di HP.
 */

import { DatabaseSync } from 'node:sqlite';
import type { SQLiteDatabase } from 'expo-sqlite';

type Params = readonly unknown[];

/** Anotasi eksplisit diperlukan karena withExclusiveTransactionAsync menyebut dirinya sendiri. */
interface TestDb {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...params: Params): Promise<{ lastInsertRowId: number; changes: number }>;
  getAllAsync<T>(sql: string, ...params: Params): Promise<T[]>;
  getFirstAsync<T>(sql: string, ...params: Params): Promise<T | null>;
  withExclusiveTransactionAsync(fn: (txn: TestDb) => Promise<void>): Promise<void>;
  /** Tersedia di semua platform, termasuk web. */
  withTransactionAsync(fn: () => Promise<void>): Promise<void>;
  closeSync(): void;
}

function wrap(raw: DatabaseSync): TestDb {
  const transaction = async (run: () => Promise<void>): Promise<void> => {
    raw.exec('BEGIN IMMEDIATE');
    try {
      await run();
      raw.exec('COMMIT');
    } catch (error) {
      raw.exec('ROLLBACK');
      throw error;
    }
  };

  const api: TestDb = {
    async execAsync(sql: string): Promise<void> {
      raw.exec(sql);
    },
    async runAsync(sql: string, ...params: Params) {
      const result = raw.prepare(sql).run(...(params as never[]));
      return { lastInsertRowId: Number(result.lastInsertRowid), changes: Number(result.changes) };
    },
    async getAllAsync<T>(sql: string, ...params: Params): Promise<T[]> {
      return raw.prepare(sql).all(...(params as never[])) as T[];
    },
    async getFirstAsync<T>(sql: string, ...params: Params): Promise<T | null> {
      return (raw.prepare(sql).get(...(params as never[])) as T) ?? null;
    },
    async withExclusiveTransactionAsync(fn: (txn: TestDb) => Promise<void>): Promise<void> {
      await transaction(() => fn(api));
    },
    async withTransactionAsync(fn: () => Promise<void>): Promise<void> {
      await transaction(fn);
    },
    closeSync() {
      raw.close();
    },
  };

  return api;
}

export function openTestDatabase(): SQLiteDatabase & { closeSync(): void } {
  const raw = new DatabaseSync(':memory:');
  return wrap(raw) as unknown as SQLiteDatabase & { closeSync(): void };
}

/**
 * Basis data yang berperilaku seperti di browser: `withExclusiveTransactionAsync`
 * melempar error dengan pesan yang sama persis seperti expo-sqlite di web.
 *
 * Ini yang membuat jalur web bisa diuji tanpa browser sama sekali — dan bug yang
 * memunculkannya lolos justru karena jalur itu tidak pernah dijalankan test.
 */
export function openWebLikeDatabase(): SQLiteDatabase & { closeSync(): void } {
  const raw = new DatabaseSync(':memory:');
  const api = wrap(raw);

  return {
    ...api,
    async withExclusiveTransactionAsync() {
      throw new Error('withExclusiveTransactionAsync is not supported on web');
    },
  } as unknown as SQLiteDatabase & { closeSync(): void };
}

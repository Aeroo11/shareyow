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
  closeSync(): void;
}

function wrap(raw: DatabaseSync): TestDb {
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
      raw.exec('BEGIN IMMEDIATE');
      try {
        await fn(api);
        raw.exec('COMMIT');
      } catch (error) {
        raw.exec('ROLLBACK');
        throw error;
      }
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

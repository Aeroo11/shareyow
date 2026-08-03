import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { countPendingOps } from '../db/repository';
import { useDbQuery } from '../db/live';
import { syncAllGroups } from '../sync/engine';
import { SupabaseTransport } from '../sync/transport';
import { useAuth } from './useAuth';

export interface SyncState {
  /** Operasi yang belum pernah sampai ke server, di seluruh grup. */
  pending: number;
  running: boolean;
  lastError: string | null;
  lastSyncedAt: number | null;
  canSync: boolean;
  sync: () => void;
}

export function useSync(): SyncState {
  const db = useSQLiteContext();
  const { session, configured } = useAuth();

  const [running, setRunning] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);

  const { data: pending } = useDbQuery((d) => countPendingOps(d), []);

  const canSync = configured && session !== null;

  // Ref supaya penyinkronan yang sedang berjalan tidak memicu dirinya sendiri
  // lewat perubahan state — dan supaya dua pemicu bersamaan tidak menumpuk.
  const busy = useRef(false);

  const sync = useCallback(() => {
    if (!canSync || busy.current) return;

    const transport = SupabaseTransport.create();
    if (!transport) return;

    busy.current = true;
    setRunning(true);
    setLastError(null);

    void syncAllGroups(db, transport)
      .then(() => setLastSyncedAt(Date.now()))
      .catch((e: unknown) => {
        // Kegagalan sinkronisasi bukan kegagalan aplikasi. Datanya aman di HP,
        // antreannya tetap utuh, dan percobaan berikutnya akan mengirim ulang.
        setLastError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        busy.current = false;
        setRunning(false);
      });
  }, [canSync, db]);

  // Menyinkron saat aplikasi dibuka dan setiap kali kembali dari latar belakang.
  // Ini yang membuat "buka aplikasi, langsung terbaru" terasa otomatis tanpa
  // perlu penjadwalan latar belakang yang rumit.
  useEffect(() => {
    if (!canSync) return;

    sync();
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') sync();
    });

    return () => subscription.remove();
  }, [canSync, sync]);

  return {
    pending: pending ?? 0,
    running,
    lastError,
    lastSyncedAt,
    canSync,
    sync,
  };
}

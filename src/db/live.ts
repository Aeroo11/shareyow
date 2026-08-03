/**
 * Menjaga layar tetap sesuai isi database, tanpa menarik pustaka pengelola state.
 *
 * Karena setiap penulisan melewati satu pintu (appendOps), cukup satu penghitung
 * revisi yang naik setiap kali log berubah. Layar yang sedang terbuka
 * berlangganan penghitung itu dan menjalankan ulang kuerinya. Kasar, tapi tepat
 * untuk skala aplikasi ini — dan yang lebih penting, tidak mungkin tidak sinkron.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSQLiteContext, type SQLiteDatabase } from 'expo-sqlite';
import { useSyncExternalStore } from 'react';

let revision = 0;
const listeners = new Set<() => void>();

export function bumpRevision(): void {
  revision += 1;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const getRevision = () => revision;

export function useRevision(): number {
  return useSyncExternalStore(subscribe, getRevision, getRevision);
}

export interface QueryResult<T> {
  data: T | undefined;
  loading: boolean;
  error: Error | null;
  refresh: () => void;
}

/**
 * Menjalankan kueri dan menjalankannya ulang setiap kali log berubah.
 *
 * `deps` bekerja seperti pada useEffect. Fungsi `run` sengaja tidak masuk daftar
 * dependensi supaya pemanggil tidak wajib membungkusnya dengan useCallback —
 * yang kalau terlupa akan menyebabkan kueri berjalan tanpa henti.
 */
export function useDbQuery<T>(
  run: (db: SQLiteDatabase) => Promise<T>,
  deps: readonly unknown[] = [],
): QueryResult<T> {
  const db = useSQLiteContext();
  const rev = useRevision();
  const [manualRefresh, setManualRefresh] = useState(0);

  const [state, setState] = useState<{ data: T | undefined; loading: boolean; error: Error | null }>(
    { data: undefined, loading: true, error: null },
  );

  const runRef = useRef(run);
  runRef.current = run;

  useEffect(() => {
    // Jawaban dari kueri yang sudah kedaluwarsa harus dibuang. Tanpa penjaga
    // ini, hasil lama yang datang terlambat bisa menimpa hasil baru.
    let active = true;

    runRef
      .current(db)
      .then((data) => {
        if (active) setState({ data, loading: false, error: null });
      })
      .catch((error: unknown) => {
        if (active) {
          setState({
            data: undefined,
            loading: false,
            error: error instanceof Error ? error : new Error(String(error)),
          });
        }
      });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, rev, manualRefresh, ...deps]);

  const refresh = useCallback(() => setManualRefresh((n) => n + 1), []);

  return { ...state, refresh };
}

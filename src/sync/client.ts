import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';

import { SUPABASE_ANON_KEY, SUPABASE_URL, isSyncConfigured } from './config';

/**
 * Tempat sesi login disimpan, dan kenapa berbeda per platform.
 *
 * Di HP dipakai `expo-sqlite/kv-store` — penyimpanan kunci-nilai yang sudah ikut
 * bersama expo-sqlite, jadi tidak perlu memasang pustaka terpisah hanya untuk
 * menyimpan satu token.
 *
 * Di browser ia TIDAK BOLEH dipakai: di dalamnya kv-store memanggil
 * `withExclusiveTransactionAsync`, yang tidak ada di web dan melempar error
 * seketika. Akibatnya bukan sekadar sesi gagal tersimpan, melainkan seluruh
 * proses masuk gagal — persis yang terjadi sebelum perbaikan ini.
 *
 * Yang dipakai di browser adalah bawaan supabase-js sendiri, yaitu localStorage.
 * Melewatkan `storage` tanpa nilai membuatnya memilih itu.
 */
function sessionStorage(): unknown {
  if (Platform.OS === 'web') return undefined;
  // Diimpor di dalam fungsi supaya berkas kv-store tidak ikut dimuat di web sama
  // sekali — tidak ada gunanya membundel sesuatu yang pasti gagal di sana.
  return require('expo-sqlite/kv-store').default;
}

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!isSyncConfigured) return null;
  if (client) return client;

  client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      storage: sessionStorage() as never,
      autoRefreshToken: true,
      persistSession: true,
      // Sesi tidak pernah datang lewat URL di aplikasi ini: masuk memakai email
      // dan kata sandi, bukan tautan ajaib. Membiarkannya menyala justru membuat
      // versi web salah menafsirkan fragmen URL biasa sebagai token.
      detectSessionInUrl: false,
    },
  });

  return client;
}

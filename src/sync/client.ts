import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import Storage from 'expo-sqlite/kv-store';

import { SUPABASE_ANON_KEY, SUPABASE_URL, isSyncConfigured } from './config';

/**
 * Klien Supabase, dibuat sekali dan hanya kalau pengaturannya ada.
 *
 * Sesi disimpan lewat `expo-sqlite/kv-store` — penyimpanan kunci-nilai yang
 * sudah ikut bersama expo-sqlite dan berperilaku seperti AsyncStorage. Memakainya
 * berarti tidak perlu memasang pustaka penyimpanan terpisah hanya untuk menyimpan
 * satu token; SQLite-nya toh sudah ada di aplikasi ini sejak awal.
 */
let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!isSyncConfigured) return null;
  if (client) return client;

  client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      storage: Storage,
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

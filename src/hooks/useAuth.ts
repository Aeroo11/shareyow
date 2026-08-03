import type { Session } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';

import { getSupabase } from '../sync/client';
import { isSyncConfigured } from '../sync/config';

export interface AuthState {
  session: Session | null;
  loading: boolean;
  /** false kalau .env belum diisi — aplikasi tetap jalan penuh, hanya tanpa sinkronisasi. */
  configured: boolean;
}

export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isSyncConfigured);

  useEffect(() => {
    const client = getSupabase();
    if (!client) return;

    let active = true;

    void client.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });

    // Menangkap perubahan yang tidak kita picu sendiri: token yang disegarkan,
    // sesi yang kedaluwarsa, keluar dari perangkat lain.
    const { data: sub } = client.auth.onAuthStateChange((_event, next) => {
      if (active) setSession(next);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, loading, configured: isSyncConfigured };
}

export async function signIn(email: string, password: string): Promise<void> {
  const client = getSupabase();
  if (!client) throw new Error('Sinkronisasi belum diatur');

  const { error } = await client.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) throw error;
}

export async function signUp(email: string, password: string, displayName: string): Promise<void> {
  const client = getSupabase();
  if (!client) throw new Error('Sinkronisasi belum diatur');

  const { data, error } = await client.auth.signUp({
    email: email.trim(),
    password,
    options: { data: { display_name: displayName.trim() } },
  });
  if (error) throw error;

  // Kalau konfirmasi email menyala, sesi belum ada sampai tautannya diklik.
  // Profil baru bisa dibuat setelah itu — dan itu bukan kegagalan.
  if (data.session) {
    await client
      .from('profiles')
      .upsert({ id: data.session.user.id, display_name: displayName.trim() });
  }
}

export async function signOut(): Promise<void> {
  const client = getSupabase();
  if (!client) return;
  await client.auth.signOut();
}

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

/**
 * Menerjemahkan pesan Supabase menjadi kalimat yang menyebutkan apa yang harus
 * dilakukan.
 *
 * "Email not confirmed" adalah yang paling sering muncul dan paling membingungkan
 * saat pengembangan: akunnya sebenarnya berhasil dibuat, tautan konfirmasinya
 * dikirim ke email, dan layanan email bawaan Supabase dibatasi sekitar dua email
 * per jam pada proyek gratis — jadi tautannya sering tidak pernah sampai. Pesan
 * aslinya tidak menyebut satu pun dari itu.
 */
function explain(error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);

  if (/email not confirmed/i.test(message)) {
    return new Error(
      'Akunnya sudah ada, tapi emailnya belum dikonfirmasi. Saat pengembangan, ' +
        'matikan Confirm email di dasbor Supabase: Authentication → Sign In / Providers → ' +
        'Email. Nyalakan lagi sebelum rilis.',
    );
  }
  if (/invalid login credentials/i.test(message)) {
    return new Error('Email atau kata sandinya salah.');
  }
  if (/password should be at least/i.test(message)) {
    return new Error('Kata sandi minimal 6 karakter.');
  }
  if (/user already registered/i.test(message)) {
    return new Error('Email ini sudah terdaftar. Coba masuk saja.');
  }
  if (/rate limit|too many requests/i.test(message)) {
    return new Error(
      'Terlalu sering mencoba. Layanan email bawaan Supabase dibatasi sekitar dua ' +
        'email per jam — tunggu sebentar, atau matikan Confirm email supaya tidak ada ' +
        'email yang perlu dikirim sama sekali.',
    );
  }
  return error instanceof Error ? error : new Error(message);
}

export async function signIn(email: string, password: string): Promise<void> {
  const client = getSupabase();
  if (!client) throw new Error('Sinkronisasi belum diatur');

  const { error } = await client.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) throw explain(error);
}

/** Dilempar saat akun berhasil dibuat tapi belum bisa dipakai karena menunggu konfirmasi. */
export class NeedsEmailConfirmation extends Error {
  constructor() {
    super(
      'Akun dibuat, tapi belum bisa dipakai sampai emailnya dikonfirmasi. Saat ' +
        'pengembangan, matikan Confirm email di dasbor Supabase: Authentication → ' +
        'Sign In / Providers → Email, lalu masuk di sini. Nyalakan lagi sebelum rilis.',
    );
  }
}

export async function signUp(email: string, password: string, displayName: string): Promise<void> {
  const client = getSupabase();
  if (!client) throw new Error('Sinkronisasi belum diatur');

  const { data, error } = await client.auth.signUp({
    email: email.trim(),
    password,
    options: { data: { display_name: displayName.trim() } },
  });
  if (error) throw explain(error);

  // Tidak ada sesi berarti Supabase menunggu tautan konfirmasi diklik. Ini
  // dilaporkan sebagai kegagalan yang menjelaskan dirinya, bukan sebagai
  // keberhasilan — karena dari sudut pandang pengguna, ia belum bisa masuk.
  if (!data.session) throw new NeedsEmailConfirmation();

  const profile = await client
    .from('profiles')
    .upsert({ id: data.session.user.id, display_name: displayName.trim() });

  // Profil hanya keterangan tambahan; kegagalannya tidak boleh membatalkan
  // pendaftaran yang sebenarnya sudah berhasil. Tapi ia juga tidak boleh hilang
  // tanpa jejak seperti sebelumnya — dulu hasilnya tidak diperiksa sama sekali.
  if (profile.error) {
    console.warn('Profil gagal disimpan, tapi akunnya sudah jadi:', profile.error.message);
  }
}

export async function signOut(): Promise<void> {
  const client = getSupabase();
  if (!client) return;
  await client.auth.signOut();
}

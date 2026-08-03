import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { CONFIG_HELP } from '../sync/config';
import { signIn, signOut, signUp, useAuth } from '../hooks/useAuth';
import { useSync } from '../hooks/useSync';
import { Button, Card, Field, Loading, Screen, SectionTitle } from '../ui/components';
import { colors, radius, spacing, type } from '../ui/theme';

export default function AccountScreen() {
  const { session, loading, configured } = useAuth();
  const sync = useSync();

  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (loading) return <Loading />;

  if (!configured) {
    return (
      <Screen style={styles.padded}>
        <Card style={{ gap: spacing.md }}>
          <Text style={styles.title}>Sinkronisasi belum diatur</Text>
          <Text style={styles.body}>
            Aplikasi ini berjalan penuh tanpa akun — semua yang sudah kamu catat aman di HP dan
            tetap bisa dipakai. Sinkronisasi hanya menambah kemampuan berbagi grup dengan orang
            lain.
          </Text>
          <Text style={styles.mono}>{CONFIG_HELP}</Text>
        </Card>
      </Screen>
    );
  }

  async function submit() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === 'signIn') {
        await signIn(email, password);
      } else {
        await signUp(email, password, displayName);
        setNotice(
          'Akun dibuat. Kalau konfirmasi email menyala di proyek Supabase-mu, buka emailmu dulu ' +
            'lalu masuk di sini.',
        );
        setMode('signIn');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (session) {
    return (
      <View style={styles.root}>
        <Screen>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.headline}>
              <Text style={styles.headlineLabel}>masuk sebagai</Text>
              <Text style={styles.email}>{session.user.email}</Text>
            </View>

            <View style={styles.section}>
              <SectionTitle>sinkronisasi</SectionTitle>
              <Card style={{ gap: spacing.md }}>
                <View style={styles.statusRow}>
                  <Text style={styles.body}>Menunggu dikirim</Text>
                  <Text style={sync.pending > 0 ? styles.pendingValue : styles.okValue}>
                    {sync.pending === 0 ? 'tidak ada' : `${sync.pending} operasi`}
                  </Text>
                </View>

                {sync.lastSyncedAt ? (
                  <View style={styles.statusRow}>
                    <Text style={styles.body}>Terakhir sinkron</Text>
                    <Text style={styles.muted}>
                      {new Date(sync.lastSyncedAt).toLocaleTimeString('id-ID')}
                    </Text>
                  </View>
                ) : null}

                {sync.lastError ? <Text style={styles.error}>{sync.lastError}</Text> : null}

                <Button
                  label={sync.running ? 'Menyinkron…' : 'Sinkronkan sekarang'}
                  variant="secondary"
                  onPress={sync.sync}
                  disabled={sync.running}
                />
              </Card>
              <Text style={styles.hint}>
                Sinkronisasi berjalan sendiri setiap aplikasi dibuka. Tombol ini hanya untuk
                memaksanya lebih cepat.
              </Text>
            </View>

            <Button label="Keluar" variant="danger" onPress={() => void signOut()} />
          </ScrollView>
        </Screen>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <Screen>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headline}>
            <Text style={styles.headlineBig}>
              {mode === 'signIn' ? 'masuk' : 'buat akun'}
            </Text>
            <Text style={styles.body}>
              Akun hanya dibutuhkan untuk berbagi grup dengan orang lain. Tanpa akun, aplikasi ini
              tetap berjalan penuh di HP-mu sendiri.
            </Text>
          </View>

          {mode === 'signUp' ? (
            <Field label="namamu" placeholder="Efan" value={displayName} onChangeText={setDisplayName} />
          ) : null}

          <Field
            label="email"
            placeholder="efan@contoh.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />

          <Field
            label="kata sandi"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
            hint={mode === 'signUp' ? 'Minimal 6 karakter.' : undefined}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {notice ? <Text style={styles.notice}>{notice}</Text> : null}

          <Button
            label={busy ? 'Memproses…' : mode === 'signIn' ? 'Masuk' : 'Buat akun'}
            onPress={() => void submit()}
            disabled={busy || email.trim().length === 0 || password.length === 0}
          />

          <Button
            label={mode === 'signIn' ? 'Belum punya akun? Buat akun' : 'Sudah punya akun? Masuk'}
            variant="ghost"
            onPress={() => {
              setMode(mode === 'signIn' ? 'signUp' : 'signIn');
              setError(null);
            }}
          />
        </ScrollView>
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  padded: { padding: spacing.lg },
  content: { padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xxl },

  headline: { gap: spacing.sm },
  headlineLabel: { ...type.label, color: colors.textMuted, textTransform: 'lowercase' },
  headlineBig: { ...type.title, color: colors.text },
  email: { ...type.heading, color: colors.accent },

  section: { gap: spacing.md },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  title: { ...type.heading, color: colors.text },
  body: { ...type.body, color: colors.textMuted },
  muted: { ...type.body, color: colors.textFaint },
  hint: { ...type.caption, color: colors.textFaint },
  okValue: { ...type.bodyStrong, color: colors.accent },
  pendingValue: { ...type.bodyStrong, color: colors.warningText },
  error: { ...type.body, color: colors.negative },
  notice: { ...type.body, color: colors.accent },
  mono: {
    ...type.caption,
    color: colors.textMuted,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.sm,
    padding: spacing.md,
  },
});

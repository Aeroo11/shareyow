import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { activeMembers } from '../core/ops';
import { loadGroup, setIdentity } from '../db/repository';
import { useAuth } from '../hooks/useAuth';
import { syncGroup } from '../sync/engine';
import { SupabaseTransport } from '../sync/transport';
import { Button, Card, Chip, Field, Screen, SectionTitle } from '../ui/components';
import { colors, spacing, type } from '../ui/theme';

/**
 * Bergabung ke grup lewat kode undangan, lalu memilih "yang mana aku".
 *
 * Langkah kedua itu yang membuat anggota bayangan bekerja: teman-temanmu sudah
 * lebih dulu tercatat sebagai nama saja, dan saat mereka akhirnya bergabung,
 * mereka tinggal mengambil alih nama miliknya. Tidak ada satu pun catatan lama
 * yang perlu diubah — di log operasi, mereka memang sudah ada sejak awal.
 */
export default function JoinScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { session, configured } = useAuth();

  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [joined, setJoined] = useState<{
    groupId: string;
    groupName: string;
    members: Array<{ id: string; displayName: string }>;
  } | null>(null);

  if (!configured || !session) {
    return (
      <Screen style={styles.padded}>
        <Card style={{ gap: spacing.md }}>
          <Text style={styles.title}>Perlu masuk dulu</Text>
          <Text style={styles.body}>
            Bergabung ke grup orang lain memerlukan akun, karena datanya harus melewati server.
            Grup yang kamu buat sendiri tetap tidak memerlukan apa pun.
          </Text>
          <Button label="Buka halaman akun" onPress={() => router.replace('/account')} />
        </Card>
      </Screen>
    );
  }

  async function join() {
    const transport = SupabaseTransport.create();
    if (!transport) return;

    setBusy(true);
    setError(null);
    try {
      // Anggota yang diklaim belum diketahui sebelum log grupnya tertarik, jadi
      // sementara diisi id akun sendiri. Pilihan sebenarnya terjadi di langkah
      // kedua, setelah nama-namanya terlihat.
      const groupId = await transport.joinGroup(code, session!.user.id);
      await syncGroup(db, transport, groupId);

      const state = await loadGroup(db, groupId);
      if (!state) throw new Error('Grup berhasil digabung tapi datanya belum tertarik. Coba lagi.');

      setJoined({
        groupId,
        groupName: state.name,
        members: activeMembers(state).map((m) => ({ id: m.id, displayName: m.displayName })),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function claim(memberId: string) {
    if (!joined) return;
    const transport = SupabaseTransport.create();

    await setIdentity(db, joined.groupId, memberId);
    if (transport) await transport.ensureGroup({
      groupId: joined.groupId,
      name: joined.groupName,
      myMemberId: memberId,
    });

    router.replace(`/group/${joined.groupId}`);
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
          {!joined ? (
            <>
              <Field
                label="kode undangan"
                placeholder="ABC123"
                value={code}
                onChangeText={(text) => setCode(text.toUpperCase())}
                autoCapitalize="characters"
                autoCorrect={false}
                style={styles.codeInput}
                hint="Minta kodenya dari orang yang membuat grup."
              />

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <Button
                label={busy ? 'Mencari grup…' : 'Gabung'}
                onPress={() => void join()}
                disabled={busy || code.trim().length < 4}
              />
            </>
          ) : (
            <>
              <View style={styles.headline}>
                <Text style={styles.headlineLabel}>bergabung ke</Text>
                <Text style={styles.headlineBig}>{joined.groupName}</Text>
              </View>

              <View style={styles.section}>
                <SectionTitle>yang mana kamu?</SectionTitle>
                <Text style={styles.body}>
                  Nama-nama ini sudah tercatat sebelum kamu bergabung. Pilih yang mewakilimu —
                  seluruh pengeluaran lama yang tercatat atas namamu langsung ikut.
                </Text>
                <View style={styles.chipRow}>
                  {joined.members.map((member) => (
                    <Chip
                      key={member.id}
                      label={member.displayName}
                      selected={false}
                      onPress={() => void claim(member.id)}
                    />
                  ))}
                </View>
              </View>
            </>
          )}
        </ScrollView>
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  padded: { padding: spacing.lg },
  content: { padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xxl },
  section: { gap: spacing.md },
  headline: { gap: spacing.xs },
  headlineLabel: { ...type.label, color: colors.textMuted, textTransform: 'lowercase' },
  headlineBig: { ...type.title, color: colors.text },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  codeInput: { ...type.title, fontSize: 26, letterSpacing: 4, textAlign: 'center' },
  title: { ...type.heading, color: colors.text },
  body: { ...type.body, color: colors.textMuted },
  error: { ...type.body, color: colors.negative },
});

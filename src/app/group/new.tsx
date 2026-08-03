import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { createGroup } from '../../db/actions';
import { Button, Field, Screen, SectionTitle } from '../../ui/components';
import { tapFeedback } from '../../ui/motion';
import { colors, radius, spacing, type } from '../../ui/theme';

export default function NewGroupScreen() {
  const db = useSQLiteContext();
  const router = useRouter();

  const [name, setName] = useState('');
  const [myName, setMyName] = useState('');
  const [others, setOthers] = useState<string[]>(['']);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filledOthers = others.map((o) => o.trim()).filter((o) => o.length > 0);
  const canSave = name.trim().length > 0 && myName.trim().length > 0 && !saving;

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      const { groupId } = await createGroup(db, { name, myName, otherNames: others });
      router.replace(`/group/${groupId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  }

  return (
    <View style={styles.root}>
      <Screen>
        {/* Lihat catatan di layar pengeluaran: ruang untuk keyboard diserahkan ke
            sistem, bukan ditebak sendiri lewat KeyboardAvoidingView. */}
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={false}
        >
          <Field
            label="nama grup"
            placeholder="Kos Keputih 3"
            value={name}
            onChangeText={setName}
            autoFocus
          />

          <Field
            label="namamu"
            placeholder="Efan"
            value={myName}
            onChangeText={setMyName}
            hint="Dipakai untuk menghitung siapa berutang kepada siapa."
          />

          <View style={styles.section}>
            <SectionTitle>anggota lain</SectionTitle>
            <Text style={styles.hint}>
              Mereka tidak perlu memasang aplikasi ini. Cukup namanya — nanti kalau mau, mereka
              bisa bergabung dan mengambil alih catatannya.
            </Text>

            {others.map((value, index) => (
              <Field
                key={index}
                label={`orang ke-${index + 2}`}
                placeholder="Nama"
                value={value}
                onChangeText={(text) =>
                  setOthers((prev) => prev.map((v, i) => (i === index ? text : v)))
                }
              />
            ))}

            <Pressable
              onPress={() => {
                tapFeedback('light');
                setOthers((prev) => [...prev, '']);
              }}
              style={({ pressed }) => [styles.addRow, pressed && { opacity: 0.6 }]}
            >
              <Text style={styles.addRowText}>+ Tambah orang</Text>
            </Pressable>
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <View style={styles.summary}>
            <Text style={styles.summaryText}>
              {filledOthers.length === 0
                ? 'Grup akan berisi kamu sendiri. Kamu tetap bisa menambah orang nanti.'
                : `Grup akan berisi ${filledOthers.length + 1} orang: kamu, ${filledOthers.join(', ')}.`}
            </Text>
          </View>

          <Button
            label={saving ? 'Menyimpan…' : 'Buat grup'}
            onPress={save}
            disabled={!canSave}
            haptic="success"
          />
        </ScrollView>
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xxl },
  section: { gap: spacing.md },
  hint: { ...type.caption, color: colors.textFaint },
  addRow: { paddingVertical: spacing.sm },
  addRowText: { ...type.bodyStrong, color: colors.accent },
  summary: {
    backgroundColor: colors.accentSoft,
    borderRadius: radius.sm,
    padding: spacing.lg,
  },
  summaryText: { ...type.caption, color: colors.accent },
  error: { ...type.body, color: colors.negative },
});

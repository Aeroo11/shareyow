import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { formatRupiah, parseRupiah } from '../../../../core/money';
import { activeMembers } from '../../../../core/ops';
import { addExpense } from '../../../../db/actions';
import { newId } from '../../../../db/ids';
import { useGroup } from '../../../../hooks/useGroups';
import { useSplitDraft } from '../../../../hooks/useSplitDraft';
import {
  Button,
  Chip,
  ErrorNotice,
  Field,
  Loading,
  Screen,
  SectionTitle,
} from '../../../../ui/components';
import { CategoryPicker, DateStepper } from '../../../../ui/ExpenseMeta';
import { SplitEditor } from '../../../../ui/SplitEditor';
import { colors, spacing, type } from '../../../../ui/theme';

export default function NewExpenseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const router = useRouter();
  const { data, loading, error } = useGroup(id);

  const [description, setDescription] = useState('');
  const [amountText, setAmountText] = useState('');
  const [payerId, setPayerId] = useState<string | null>(null);
  const [category, setCategory] = useState('makan');
  const [occurredAt, setOccurredAt] = useState(() => Date.now());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Dibuat sekali saat form dibuka, lalu dipakai untuk dua hal yang harus cocok:
  // seed pratinjau pembagian, dan id pengeluaran yang disimpan. Kalau keduanya
  // berbeda, angka yang dilihat pengguna bisa berbeda dari yang tercatat.
  const [expenseId] = useState(newId);

  const members = data ? activeMembers(data.state) : [];
  const amount = parseRupiah(amountText);
  const split = useSplitDraft(
    members.map((m) => m.id),
    amount,
    expenseId,
  );

  if (loading) return <Loading />;
  if (error) {
    return (
      <Screen style={styles.padded}>
        <ErrorNotice error={error} />
      </Screen>
    );
  }
  if (!data) return null;

  // Pembayar punya nilai awal yang masuk akal: kamu. Itu kasus yang paling sering
  // terjadi, jadi seringkali cukup mengetik keterangan dan nominal lalu simpan.
  const effectivePayerId = payerId ?? data.myMemberId ?? members[0]?.id ?? null;

  // authorId = siapa yang MENCATAT, bukan siapa yang membayar. Keduanya sering orang
  // yang sama, tapi tidak selalu — dan begitu sinkronisasi masuk, "siapa yang menulis
  // operasi ini" jadi pertanyaan yang punya jawaban penting.
  const authorId = data.myMemberId ?? effectivePayerId;

  const amountError =
    amountText.trim().length > 0 && amount === null ? 'Nominal tidak terbaca' : null;
  const canSave =
    description.trim().length > 0 &&
    amount !== null &&
    amount > 0 &&
    split.mode !== null &&
    effectivePayerId !== null &&
    !saving;

  async function save() {
    if (!canSave || amount === null || !effectivePayerId || !split.mode) return;
    setSaving(true);
    setSaveError(null);
    try {
      await addExpense(db, id, authorId ?? effectivePayerId, expenseId, {
        description: description.trim(),
        total: amount,
        payerId: effectivePayerId,
        participants: split.participants,
        mode: split.mode,
        occurredAt,
        category,
      });
      router.back();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  }

  return (
    <View style={styles.root}>
      <Screen>
        {/* automaticallyAdjustKeyboardInsets menyisipkan ruang untuk keyboard dari
            sisi sistem, jadi tidak perlu menebak tinggi header seperti
            KeyboardAvoidingView — tebakan yang justru meleset pada layar bermodal.
            keyboardDismissMode="on-drag" penting karena papan angka iOS tidak punya
            tombol untuk menutup dirinya sendiri. */}
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          automaticallyAdjustKeyboardInsets
          showsVerticalScrollIndicator={false}
        >
          <Field
            label="untuk apa"
            placeholder="Galon + gas"
            value={description}
            onChangeText={setDescription}
            autoFocus
          />

          <Field
            label="nominal"
            placeholder="45.000"
            value={amountText}
            onChangeText={setAmountText}
            keyboardType="numeric"
            error={amountError}
            hint={amount !== null && !amountError ? formatRupiah(amount) : 'Boleh ditulis "45rb"'}
            style={styles.amountInput}
          />

          <CategoryPicker value={category} onChange={setCategory} />

          <View style={styles.section}>
            <SectionTitle>siapa yang menalangi</SectionTitle>
            <View style={styles.chipRow}>
              {members.map((member) => (
                <Chip
                  key={member.id}
                  label={member.displayName}
                  selected={member.id === effectivePayerId}
                  onPress={() => setPayerId(member.id)}
                />
              ))}
            </View>
          </View>

          <SplitEditor members={members} split={split} />

          <DateStepper value={occurredAt} onChange={setOccurredAt} />

          {saveError ? <Text style={styles.warning}>{saveError}</Text> : null}

          <Button
            label={saving ? 'Menyimpan…' : 'Simpan'}
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
  padded: { padding: spacing.lg },
  content: { padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xxl },
  section: { gap: spacing.md },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },

  /** Nominal adalah isian terpenting di layar ini, jadi hurufnya paling besar. */
  amountInput: { ...type.title, fontSize: 26, paddingVertical: spacing.lg },

  warning: { ...type.body, color: colors.negative },
});

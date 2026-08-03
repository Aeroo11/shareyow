import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { formatRupiah, parseRupiah } from '../../../../core/money';
import { activeMembers } from '../../../../core/ops';
import { deleteExpense, editExpense } from '../../../../db/actions';
import { useGroup } from '../../../../hooks/useGroups';
import { draftFrom, useSplitDraft } from '../../../../hooks/useSplitDraft';
import {
  Button,
  Chip,
  EmptyState,
  ErrorNotice,
  Field,
  Loading,
  Screen,
  SectionTitle,
} from '../../../../ui/components';
import { CategoryPicker, DateStepper } from '../../../../ui/ExpenseMeta';
import { SplitEditor } from '../../../../ui/SplitEditor';
import { confirm } from '../../../../ui/confirm';
import { colors, spacing, type } from '../../../../ui/theme';

export default function EditExpenseScreen() {
  const { id, expenseId } = useLocalSearchParams<{ id: string; expenseId: string }>();
  const db = useSQLiteContext();
  const router = useRouter();
  const { data, loading, error } = useGroup(id);

  const expense = data?.state.expenses.get(expenseId);
  const members = data ? activeMembers(data.state) : [];

  const [description, setDescription] = useState<string | null>(null);
  const [amountText, setAmountText] = useState<string | null>(null);
  const [payerId, setPayerId] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [occurredAt, setOccurredAt] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Nilai yang ditampilkan: yang sedang diketik kalau ada, kalau belum yang tersimpan.
  // Pola ini menghindari useEffect penyalin nilai awal, yang selalu berakhir dengan
  // pertanyaan "kenapa ketikanku tertimpa sendiri".
  const shownDescription = description ?? expense?.description ?? '';
  const shownAmountText = amountText ?? (expense ? String(expense.total) : '');
  const amount = parseRupiah(shownAmountText);

  // Seed WAJIB id pengeluaran yang sedang diubah, bukan id baru — kalau tidak,
  // sisa rupiah bisa berpindah orang hanya karena pengeluaran itu dibuka.
  const split = useSplitDraft(
    members.map((m) => m.id),
    amount,
    expenseId,
    expense
      ? draftFrom(members.map((m) => m.id), expense.participants, expense.mode)
      : undefined,
  );

  if (loading) return <Loading />;
  if (error) {
    return (
      <Screen style={styles.padded}>
        <ErrorNotice error={error} />
      </Screen>
    );
  }
  if (!data || !expense) {
    return (
      <Screen style={styles.padded}>
        <EmptyState
          title="pengeluaran tidak ditemukan"
          body="Mungkin sudah dihapus dari perangkat lain."
        />
      </Screen>
    );
  }

  const effectivePayerId = payerId ?? expense.payerId;
  const shownCategory = category ?? expense.category ?? 'lainnya';
  const shownOccurredAt = occurredAt ?? expense.occurredAt;
  const authorId = data.myMemberId ?? effectivePayerId;

  const amountError =
    shownAmountText.trim().length > 0 && amount === null ? 'Nominal tidak terbaca' : null;
  const canSave =
    shownDescription.trim().length > 0 && amount !== null && amount > 0 && split.mode !== null && !saving;

  async function save() {
    if (!canSave || amount === null || !split.mode) return;
    setSaving(true);
    setSaveError(null);
    try {
      // Seluruh field dikirim sebagai satu operasi ubah. Field yang tidak berubah
      // ikut terkirim dengan nilai lamanya — itu tidak apa-apa, karena penggabungan
      // last-op-wins bekerja per field dan nilai lama sama dengan nilai sekarang.
      await editExpense(db, id, authorId, expenseId, {
        description: shownDescription.trim(),
        total: amount,
        payerId: effectivePayerId,
        participants: split.participants,
        mode: split.mode,
        occurredAt: shownOccurredAt,
        category: shownCategory,
      });
      router.back();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  }

  async function remove() {
    const yes = await confirm({
      title: 'Hapus pengeluaran?',
      message: `"${expense!.description}" akan dihapus dari perhitungan.`,
      confirmLabel: 'Hapus',
      destructive: true,
    });
    if (!yes) return;
    await deleteExpense(db, id, authorId, expenseId);
    router.back();
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
          <Field
            label="untuk apa"
            value={shownDescription}
            onChangeText={setDescription}
          />

          <Field
            label="nominal"
            value={shownAmountText}
            onChangeText={setAmountText}
            keyboardType="numeric"
            error={amountError}
            hint={amount !== null && !amountError ? formatRupiah(amount) : 'Boleh ditulis "45rb"'}
            style={styles.amountInput}
          />

          <CategoryPicker value={shownCategory} onChange={setCategory} />

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

          <DateStepper value={shownOccurredAt} onChange={setOccurredAt} />

          {saveError ? <Text style={styles.warning}>{saveError}</Text> : null}

          <Button
            label={saving ? 'Menyimpan…' : 'Simpan perubahan'}
            onPress={save}
            disabled={!canSave}
            haptic="success"
          />
          <Button label="Hapus pengeluaran" variant="danger" onPress={() => void remove()} />
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
  amountInput: { ...type.title, fontSize: 26, paddingVertical: spacing.lg },
  warning: { ...type.body, color: colors.negative },
});

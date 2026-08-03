import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { formatRupiah, parseRupiah } from '../../../../core/money';
import { activeMembers } from '../../../../core/ops';
import { computeShares } from '../../../../core/split';
import { addExpense } from '../../../../db/actions';
import { newId } from '../../../../db/ids';
import { useGroup } from '../../../../hooks/useGroups';
import {
  Button,
  Chip,
  ErrorNotice,
  Field,
  Loading,
  Screen,
  SectionTitle,
  Touchable,
} from '../../../../ui/components';
import { colors, fonts, radius, spacing, type } from '../../../../ui/theme';

export default function NewExpenseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const router = useRouter();
  const { data, loading, error } = useGroup(id);

  const [description, setDescription] = useState('');
  const [amountText, setAmountText] = useState('');
  const [payerId, setPayerId] = useState<string | null>(null);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Dibuat sekali saat form dibuka, lalu dipakai untuk dua hal yang harus cocok:
  // seed pratinjau pembagian di bawah, dan id pengeluaran yang disimpan. Kalau
  // keduanya berbeda, angka yang dilihat pengguna bisa berbeda dari yang tercatat.
  const [expenseId] = useState(newId);

  const members = data ? activeMembers(data.state) : [];
  const amount = parseRupiah(amountText);

  // Pembayar dan peserta punya nilai awal yang masuk akal: kamu yang membayar,
  // semua orang ikut menanggung. Itu kasus yang paling sering terjadi, jadi
  // seringkali cukup mengetik keterangan dan nominal lalu simpan.
  const effectivePayerId = payerId ?? data?.myMemberId ?? members[0]?.id ?? null;
  const participants = members.map((m) => m.id).filter((mid) => !excluded.has(mid));

  const preview = useMemo(() => {
    if (amount === null || amount < 0 || participants.length === 0) return null;
    try {
      return computeShares(amount, participants, { kind: 'equal' }, expenseId);
    } catch {
      return null;
    }
  }, [amount, participants.join(','), expenseId]);

  if (loading) return <Loading />;
  if (error) {
    return (
      <Screen style={styles.padded}>
        <ErrorNotice error={error} />
      </Screen>
    );
  }
  if (!data) return null;

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
    participants.length > 0 &&
    effectivePayerId !== null &&
    !saving;

  async function save() {
    if (!canSave || amount === null || !effectivePayerId) return;
    setSaving(true);
    setSaveError(null);
    try {
      await addExpense(db, id, authorId ?? effectivePayerId, expenseId, {
        description: description.trim(),
        total: amount,
        payerId: effectivePayerId,
        participants,
        mode: { kind: 'equal' },
        occurredAt: Date.now(),
      });
      router.back();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  }

  function toggleParticipant(memberId: string) {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });
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

          <View style={styles.section}>
            <SectionTitle>dibagi ke</SectionTitle>
            <View style={styles.participantList}>
              {members.map((member, index) => {
                const included = !excluded.has(member.id);
                const share = preview?.find((s) => s.memberId === member.id);

                return (
                  <Touchable key={member.id} onPress={() => toggleParticipant(member.id)}>
                    <View
                      style={[
                        styles.participantRow,
                        index < members.length - 1 && styles.participantRowBorder,
                      ]}
                    >
                      <View style={[styles.checkbox, included && styles.checkboxOn]}>
                        {included ? <Text style={styles.checkboxMark}>✓</Text> : null}
                      </View>
                      <Text style={[styles.participantName, !included && styles.participantOff]}>
                        {member.displayName}
                      </Text>
                      <Text style={[styles.participantShare, !included && styles.participantOff]}>
                        {included && share ? formatRupiah(share.amount) : '—'}
                      </Text>
                    </View>
                  </Touchable>
                );
              })}
            </View>

            {preview && !isEvenlyDivisible(preview) ? (
              <Text style={styles.roundingNote}>
                Tidak habis dibagi rata. Sisa rupiahnya dibagikan supaya jumlahnya tetap persis{' '}
                {formatRupiah(amount ?? 0)} — tidak ada rupiah yang hilang.
              </Text>
            ) : null}

            {participants.length === 0 ? (
              <Text style={styles.warning}>Pilih minimal satu orang.</Text>
            ) : null}
          </View>

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

function isEvenlyDivisible(shares: Array<{ amount: number }>): boolean {
  return shares.every((s) => s.amount === shares[0]!.amount);
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  padded: { padding: spacing.lg },
  content: { padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xxl },
  section: { gap: spacing.md },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },

  /** Nominal adalah isian terpenting di layar ini, jadi hurufnya paling besar. */
  amountInput: { ...type.title, fontSize: 26, paddingVertical: spacing.lg },

  participantList: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
  },
  participantRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  participantRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkboxMark: { ...type.caption, color: colors.textOnAccent, fontFamily: fonts.bold },
  participantName: { ...type.body, color: colors.text, flex: 1 },
  participantShare: { ...type.bodyStrong, color: colors.textMuted },
  participantOff: { color: colors.textFaint },

  roundingNote: { ...type.caption, color: colors.textFaint },
  warning: { ...type.body, color: colors.negative },
});

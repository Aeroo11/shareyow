import { StyleSheet, Text, TextInput, View } from 'react-native';

import { formatRupiah } from '../core/money';
import type { Member } from '../core/ops';
import { SPLIT_KINDS } from '../core/splitDraft';
import type { SplitResult } from '../hooks/useSplitDraft';
import { Chip, SectionTitle, Touchable } from './components';
import { tapFeedback } from './motion';
import { colors, fonts, numeric, radius, spacing, type } from './theme';

/**
 * Editor pembagian, dipakai bersama oleh layar tambah dan layar ubah.
 *
 * Ia sengaja tidak menghitung apa pun: seluruh angka yang ditampilkan berasal
 * dari `split.shares`, yang datangnya dari `computeShares` — sumber yang sama
 * dengan yang nanti disimpan. Itulah yang menjamin apa yang dilihat pengguna
 * di sini sama persis dengan yang tercatat.
 */
export function SplitEditor({ members, split }: { members: Member[]; split: SplitResult }) {
  const { draft, shares, problem } = split;
  const activeKind = SPLIT_KINDS.find((k) => k.kind === draft.kind);

  return (
    <View style={{ gap: spacing.md }}>
      <SectionTitle>dibagi ke</SectionTitle>

      <View style={styles.kindRow}>
        {SPLIT_KINDS.map((k) => (
          <Chip
            key={k.kind}
            label={k.label}
            selected={draft.kind === k.kind}
            onPress={() => split.setKind(k.kind)}
          />
        ))}
      </View>
      {activeKind ? <Text style={styles.kindHint}>{activeKind.hint}</Text> : null}

      <View style={styles.list}>
        {members.map((member, index) => {
          const included = !draft.excluded.has(member.id);
          const share = shares?.find((s) => s.memberId === member.id);

          return (
            <View
              key={member.id}
              style={[styles.row, index < members.length - 1 && styles.rowBorder]}
            >
              <Touchable onPress={() => split.toggleMember(member.id)}>
                <View style={styles.rowHead}>
                  <View style={[styles.checkbox, included && styles.checkboxOn]}>
                    {included ? <Text style={styles.checkboxMark}>✓</Text> : null}
                  </View>
                  <Text style={[styles.name, !included && styles.off]} numberOfLines={1}>
                    {member.displayName}
                  </Text>

                  {/* Hasil pembagian selalu ditampilkan di kanan, apa pun modenya —
                      supaya pengguna tidak perlu menerjemahkan persen atau porsi
                      menjadi rupiah di kepalanya sendiri. */}
                  <Text style={[styles.share, !included && styles.off]}>
                    {included && share ? formatRupiah(share.amount) : '—'}
                  </Text>
                </View>
              </Touchable>

              {included && draft.kind !== 'equal' ? (
                <View style={styles.control}>
                  {draft.kind === 'exact' ? (
                    <TextInput
                      value={draft.exact[member.id] ?? ''}
                      onChangeText={(text) => split.setExact(member.id, text)}
                      placeholder="0"
                      placeholderTextColor={colors.textFaint}
                      selectionColor={colors.accent}
                      keyboardType="numeric"
                      style={styles.input}
                    />
                  ) : draft.kind === 'percent' ? (
                    <View style={styles.percentWrap}>
                      <TextInput
                        value={draft.percent[member.id] ?? ''}
                        onChangeText={(text) => split.setPercent(member.id, text)}
                        placeholder="0"
                        placeholderTextColor={colors.textFaint}
                        selectionColor={colors.accent}
                        keyboardType="numeric"
                        style={[styles.input, styles.percentInput]}
                      />
                      <Text style={styles.percentSign}>%</Text>
                    </View>
                  ) : (
                    <Stepper
                      value={draft.shares[member.id] ?? 1}
                      onChange={(v) => split.setShare(member.id, v)}
                    />
                  )}
                </View>
              ) : null}
            </View>
          );
        })}
      </View>

      {problem ? <Text style={styles.problem}>{problem}</Text> : null}

      {!problem && shares && draft.kind === 'equal' && !isEven(shares) ? (
        <Text style={styles.note}>
          Tidak habis dibagi rata. Sisa rupiahnya dibagikan supaya jumlahnya tetap persis — tidak
          ada rupiah yang hilang.
        </Text>
      ) : null}
    </View>
  );
}

function Stepper({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  return (
    <View style={styles.stepper}>
      <Touchable
        onPress={() => {
          tapFeedback('light');
          onChange(Math.max(0, value - 1));
        }}
      >
        <View style={styles.stepButton}>
          <Text style={styles.stepSign}>−</Text>
        </View>
      </Touchable>

      <Text style={styles.stepValue}>{value}</Text>

      <Touchable
        onPress={() => {
          tapFeedback('light');
          onChange(value + 1);
        }}
      >
        <View style={styles.stepButton}>
          <Text style={styles.stepSign}>+</Text>
        </View>
      </Touchable>
    </View>
  );
}

function isEven(shares: Array<{ amount: number }>): boolean {
  return shares.every((s) => s.amount === shares[0]!.amount);
}

const styles = StyleSheet.create({
  kindRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kindHint: { ...type.caption, color: colors.textFaint },

  list: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
  },
  row: { paddingVertical: spacing.md },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  rowHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.sm },

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
  name: { ...type.body, color: colors.text, flex: 1 },
  share: { ...type.bodyStrong, color: colors.textMuted, ...numeric },
  off: { color: colors.textFaint },

  control: { paddingLeft: 36, paddingBottom: spacing.sm },
  input: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    ...type.body,
    ...numeric,
    color: colors.text,
  },
  percentWrap: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  percentInput: { flex: 1 },
  percentSign: { ...type.body, color: colors.textMuted },

  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stepButton: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepSign: { ...type.heading, color: colors.text },
  stepValue: { ...type.bodyStrong, color: colors.text, minWidth: 24, textAlign: 'center', ...numeric },

  problem: { ...type.body, color: colors.negative },
  note: { ...type.caption, color: colors.textFaint },
});

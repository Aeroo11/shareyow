import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { perspectiveOf } from '../../../core/balance';
import { activeExpenses, activeMembers, type Expense, type GroupState } from '../../../core/ops';
import { balancesOf, displayName, totalSpend } from '../../../core/selectors';
import { deleteExpense } from '../../../db/actions';
import { useGroup } from '../../../hooks/useGroups';
import { Button, Card, EmptyState, ErrorNotice, Loading, Money, SectionTitle } from '../../../ui/components';
import { confirm } from '../../../ui/confirm';
import { colors, radius, spacing, type } from '../../../ui/theme';

export default function GroupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data, loading, error } = useGroup(id);

  if (loading) return <Loading />;
  if (error) {
    return (
      <View style={styles.padded}>
        <ErrorNotice error={error} />
      </View>
    );
  }
  if (!data) {
    return (
      <View style={styles.padded}>
        <EmptyState title="Grup tidak ditemukan" body="Mungkin sudah dihapus dari perangkat ini." />
      </View>
    );
  }

  const { state, myMemberId } = data;
  const expenses = activeExpenses(state);
  const balances = balancesOf(state);
  const me = myMemberId ? perspectiveOf(balances, myMemberId) : null;

  async function confirmDelete(expense: Expense) {
    if (!myMemberId) return;
    const yes = await confirm({
      title: 'Hapus pengeluaran?',
      message: `"${expense.description}" akan dihapus dari perhitungan.`,
      confirmLabel: 'Hapus',
      destructive: true,
    });
    if (yes) await deleteExpense(db, state.id, myMemberId, expense.id);
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: state.name }} />

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 96 }]}>
        <Card style={styles.headerCard}>
          <View>
            <Text style={styles.headerLabel}>Total pengeluaran grup</Text>
            <Money value={totalSpend(state)} size="display" />
          </View>

          {me && (me.owes > 0 || me.isOwed > 0) ? (
            <View style={me.owes > 0 ? styles.mePillNegative : styles.mePillPositive}>
              <Text style={me.owes > 0 ? styles.mePillTextNegative : styles.mePillTextPositive}>
                {me.owes > 0 ? 'Kamu berutang' : 'Kamu menagih'}
              </Text>
              <Money
                value={me.owes > 0 ? me.owes : me.isOwed}
                tone={me.owes > 0 ? 'negative' : 'positive'}
                size="title"
              />
            </View>
          ) : (
            <View style={styles.mePillNeutral}>
              <Text style={styles.mePillTextNeutral}>Posisimu sudah lunas</Text>
            </View>
          )}
        </Card>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <SectionTitle>Saldo tiap orang</SectionTitle>
            <Pressable
              onPress={() => router.push(`/group/${state.id}/members`)}
              hitSlop={8}
              style={({ pressed }) => pressed && { opacity: 0.6 }}
            >
              <Text style={styles.sectionAction}>Kelola</Text>
            </Pressable>
          </View>
          <Card style={{ gap: spacing.md }}>
            {activeMembers(state).map((member) => {
              const value = balances.get(member.id) ?? 0;
              return (
                <View key={member.id} style={styles.balanceRow}>
                  <Text style={styles.memberName} numberOfLines={1}>
                    {member.displayName}
                    {member.id === myMemberId ? ' (kamu)' : ''}
                  </Text>
                  <Money
                    value={value}
                    tone={value > 0 ? 'positive' : value < 0 ? 'negative' : 'muted'}
                  />
                </View>
              );
            })}
          </Card>
        </View>

        <View style={styles.section}>
          <SectionTitle>Pengeluaran</SectionTitle>
          {expenses.length === 0 ? (
            <Card>
              <EmptyState
                title="Belum ada catatan"
                body="Catat pengeluaran pertama — galon, wifi, makan bareng, apa saja."
              />
            </Card>
          ) : (
            <Card style={{ gap: 0, paddingVertical: spacing.xs }}>
              {expenses.map((expense, index) => (
                <ExpenseRow
                  key={expense.id}
                  state={state}
                  expense={expense}
                  isLast={index === expenses.length - 1}
                  onLongPress={() => void confirmDelete(expense)}
                />
              ))}
            </Card>
          )}
          {expenses.length > 0 ? (
            <Text style={styles.listHint}>Tekan lama sebuah catatan untuk menghapusnya.</Text>
          ) : null}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button
          label="Selesaikan"
          variant="secondary"
          style={styles.footerButton}
          onPress={() => router.push(`/group/${state.id}/settle`)}
        />
        <Button
          label="+ Pengeluaran"
          style={styles.footerButton}
          onPress={() => router.push(`/group/${state.id}/expense/new`)}
        />
      </View>
    </View>
  );
}

function ExpenseRow({
  state,
  expense,
  isLast,
  onLongPress,
}: {
  state: GroupState;
  expense: Expense;
  isLast: boolean;
  onLongPress: () => void;
}) {
  return (
    <Pressable
      onLongPress={onLongPress}
      style={({ pressed }) => [
        styles.expenseRow,
        !isLast && styles.expenseRowBorder,
        pressed && { opacity: 0.6 },
      ]}
    >
      <View style={styles.expenseMain}>
        <Text style={styles.expenseDescription} numberOfLines={1}>
          {expense.description}
        </Text>
        <Text style={styles.expenseMeta}>
          {displayName(state, expense.payerId)} menalangi · {formatDate(expense.occurredAt)} ·{' '}
          {expense.participants.length} orang
        </Text>
      </View>
      <Money value={expense.total} />
    </Pressable>
  );
}

function formatDate(epochMs: number): string {
  return new Date(epochMs).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
  });
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  padded: { padding: spacing.lg },
  content: { padding: spacing.lg, gap: spacing.xl },

  headerCard: { gap: spacing.lg },
  headerLabel: { ...type.caption, color: colors.textMuted, marginBottom: spacing.xs },
  mePillPositive: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.positiveSoft,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  mePillNegative: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.negativeSoft,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  mePillNeutral: {
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  mePillTextPositive: { ...type.label, color: colors.positive },
  mePillTextNegative: { ...type.label, color: colors.negative },
  mePillTextNeutral: { ...type.body, color: colors.textMuted },

  section: { gap: spacing.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionAction: { ...type.label, color: colors.accent },
  listHint: { ...type.caption, color: colors.textFaint, paddingHorizontal: spacing.xs },
  balanceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  memberName: { ...type.body, color: colors.text, flexShrink: 1 },

  expenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  expenseRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  expenseMain: { flexShrink: 1, gap: 2 },
  expenseDescription: { ...type.body, color: colors.text, fontWeight: '600' },
  expenseMeta: { ...type.caption, color: colors.textMuted },

  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  footerButton: { flex: 1 },
});

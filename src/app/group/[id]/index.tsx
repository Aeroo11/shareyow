import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { perspectiveOf } from '../../../core/balance';
import { activeExpenses, activeMembers, type Expense, type GroupState } from '../../../core/ops';
import { balancesOf, displayName, totalSpend } from '../../../core/selectors';
import { deleteExpense } from '../../../db/actions';
import { useGroup } from '../../../hooks/useGroups';
import {
  Button,
  Card,
  Divider,
  EmptyState,
  ErrorNotice,
  Loading,
  Money,
  Screen,
  SectionTitle,
  Touchable,
} from '../../../ui/components';
import { CategoryIcon } from '../../../ui/ExpenseMeta';
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
      <Screen style={styles.padded}>
        <ErrorNotice error={error} />
      </Screen>
    );
  }
  if (!data) {
    return (
      <Screen style={styles.padded}>
        <EmptyState
          title="grup tidak ditemukan"
          body="Mungkin sudah dihapus dari perangkat ini."
        />
      </Screen>
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
    <View style={styles.root}>
      <Stack.Screen options={{ title: state.name }} />

      <Screen>
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 108 }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headline}>
            <Text style={styles.headlineLabel}>
              {me && me.owes > 0 ? 'kamu berutang'
                : me && me.isOwed > 0 ? 'kamu menagih'
                : 'posisimu'}
            </Text>
            {me && (me.owes > 0 || me.isOwed > 0) ? (
              <Money
                value={me.owes > 0 ? me.owes : me.isOwed}
                tone={me.owes > 0 ? 'negative' : 'positive'}
                size="display"
                animate
              />
            ) : (
              <Text style={styles.settledBig}>lunas</Text>
            )}
            <Text style={styles.headlineSub}>
              Total pengeluaran grup {formatCompact(totalSpend(state))}
            </Text>
          </View>

          <View style={styles.section}>
            <SectionTitle
              action={
                <Text style={styles.action} onPress={() => router.push(`/group/${state.id}/members`)}>
                  kelola
                </Text>
              }
            >
              saldo tiap orang
            </SectionTitle>

            <Card style={{ gap: spacing.md }}>
              {activeMembers(state).map((member) => {
                const value = balances.get(member.id) ?? 0;
                return (
                  <View key={member.id} style={styles.balanceRow}>
                    <Text style={styles.memberName} numberOfLines={1}>
                      {member.displayName}
                      {member.id === myMemberId ? ' · kamu' : ''}
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
            <SectionTitle
              action={
                <Text
                  style={styles.action}
                  onPress={() => router.push(`/group/${state.id}/activity`)}
                >
                  riwayat
                </Text>
              }
            >
              pengeluaran
            </SectionTitle>

            {expenses.length === 0 ? (
              <Card>
                <EmptyState
                  glyph="0"
                  title="belum ada catatan"
                  body="Catat pengeluaran pertama — galon, wifi, makan bareng, apa saja."
                />
              </Card>
            ) : (
              <Card style={styles.listCard}>
                {expenses.map((expense, index) => (
                  <View key={expense.id}>
                    {index > 0 ? <Divider /> : null}
                    <Touchable
                      index={index}
                      onPress={() => router.push(`/group/${state.id}/expense/${expense.id}`)}
                      onLongPress={() => void confirmDelete(expense)}
                    >
                      <ExpenseRow state={state} expense={expense} />
                    </Touchable>
                  </View>
                ))}
              </Card>
            )}

            {expenses.length > 0 ? (
              <Text style={styles.listHint}>
                Ketuk untuk mengubah, tekan lama untuk menghapus.
              </Text>
            ) : null}
          </View>
        </ScrollView>
      </Screen>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Screen style={styles.footerRow}>
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
        </Screen>
      </View>
    </View>
  );
}

function ExpenseRow({ state, expense }: { state: GroupState; expense: Expense }) {
  return (
    <View style={styles.expenseRow}>
      <CategoryIcon id={expense.category} />
      <View style={styles.expenseMain}>
        <Text style={styles.expenseDescription} numberOfLines={1}>
          {expense.description}
        </Text>
        <Text style={styles.expenseMeta} numberOfLines={1}>
          {displayName(state, expense.payerId)} menalangi · {formatDate(expense.occurredAt)} ·{' '}
          {expense.participants.length} orang
        </Text>
      </View>
      <Money value={expense.total} />
    </View>
  );
}

function formatDate(epochMs: number): string {
  return new Date(epochMs).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

/** Nominal pendukung — sengaja tidak sebesar angka utama supaya hierarkinya jelas. */
function formatCompact(value: number): string {
  return `Rp${value.toLocaleString('id-ID')}`;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  padded: { padding: spacing.lg },
  content: { padding: spacing.lg, gap: spacing.xl },

  headline: { paddingTop: spacing.xs, paddingBottom: spacing.sm, gap: spacing.xs },
  headlineLabel: { ...type.label, color: colors.textMuted, textTransform: 'lowercase' },
  headlineSub: { ...type.caption, color: colors.textFaint, marginTop: spacing.xs },
  settledBig: { ...type.display, color: colors.accent },

  section: { gap: spacing.md },
  action: { ...type.label, color: colors.accent, textTransform: 'lowercase' },

  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  memberName: { ...type.body, color: colors.text, flexShrink: 1 },

  listCard: { paddingVertical: spacing.xs, paddingHorizontal: spacing.lg },
  expenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  expenseMain: { flexShrink: 1, gap: 3 },
  expenseDescription: { ...type.bodyStrong, color: colors.text },
  expenseMeta: { ...type.caption, color: colors.textFaint },
  listHint: { ...type.caption, color: colors.textFaint, paddingHorizontal: spacing.xs },

  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    backgroundColor: colors.bg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  footerRow: { flexDirection: 'row', gap: spacing.md, flex: 0 },
  footerButton: { flex: 1, paddingHorizontal: spacing.md, borderRadius: radius.md },
});

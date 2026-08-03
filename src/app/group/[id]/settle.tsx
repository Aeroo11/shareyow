import { useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { formatRupiah } from '../../../core/money';
import { activeExpenses, activeSettlements } from '../../../core/ops';
import { balancesOf, displayName, transfersOf } from '../../../core/selectors';
import { addSettlement } from '../../../db/actions';
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
} from '../../../ui/components';
import { confirm } from '../../../ui/confirm';
import { colors, spacing, type } from '../../../ui/theme';

export default function SettleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const { data, loading, error } = useGroup(id);

  if (loading) return <Loading />;
  if (error) {
    return (
      <Screen style={styles.padded}>
        <ErrorNotice error={error} />
      </Screen>
    );
  }
  if (!data) return null;

  const { state, myMemberId } = data;

  let transfers;
  try {
    transfers = transfersOf(state);
  } catch (e) {
    // settleUp gagal keras kalau saldo tidak berjumlah nol. Itu bug di hulu,
    // bukan kesalahan pengguna — jadi tampilkan apa adanya alih-alih menyajikan
    // daftar transfer yang salah.
    return (
      <Screen style={styles.padded}>
        <ErrorNotice error={e instanceof Error ? e : new Error(String(e))} />
      </Screen>
    );
  }

  const naive = countDirectRepayments(state);
  const settlements = activeSettlements(state);

  async function markPaid(fromId: string, toId: string, amount: number) {
    if (!myMemberId) return;
    const yes = await confirm({
      title: 'Tandai sudah dibayar?',
      message: `${displayName(state, fromId)} mengirim ${formatRupiah(amount)} ke ${displayName(state, toId)}.`,
      confirmLabel: 'Sudah dibayar',
    });
    if (yes) await addSettlement(db, state.id, myMemberId, { fromId, toId, amount });
  }

  return (
    <View style={styles.root}>
      <Screen>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {transfers.length === 0 ? (
            <Card>
              <EmptyState
                glyph="✓"
                title="semua sudah lunas"
                body="Tidak ada yang perlu ditransfer di grup ini."
              />
            </Card>
          ) : (
            <>
              <View style={styles.headline}>
                <Text style={styles.headlineLabel}>butuh</Text>
                <Text style={styles.headlineBig}>
                  {transfers.length} transfer
                </Text>
                <Text style={styles.headlineSub}>
                  {naive > transfers.length
                    ? `Kalau setiap orang membayar langsung kepada yang menalangi, butuh ${naive}. Utang yang searah dialihkan supaya cukup ${transfers.length}.`
                    : 'Tidak ada utang yang bisa dialihkan lagi — ini sudah paling ringkas.'}
                </Text>
              </View>

              <View style={styles.section}>
                <SectionTitle>yang perlu ditransfer</SectionTitle>
                {transfers.map((transfer) => (
                  <Card key={`${transfer.fromId}-${transfer.toId}`} style={styles.transferCard}>
                    <View style={styles.transferTop}>
                      <View style={styles.transferNames}>
                        <Text style={styles.transferName} numberOfLines={1}>
                          {displayName(state, transfer.fromId)}
                          {transfer.fromId === myMemberId ? ' · kamu' : ''}
                        </Text>
                        <Text style={styles.arrow}>kirim ke</Text>
                        <Text style={styles.transferName} numberOfLines={1}>
                          {displayName(state, transfer.toId)}
                          {transfer.toId === myMemberId ? ' · kamu' : ''}
                        </Text>
                      </View>
                      <Money value={transfer.amount} size="title" tone="positive" />
                    </View>

                    <Button
                      label="Tandai sudah dibayar"
                      variant="secondary"
                      haptic="success"
                      onPress={() =>
                        void markPaid(transfer.fromId, transfer.toId, transfer.amount)
                      }
                    />
                  </Card>
                ))}
              </View>
            </>
          )}

          {settlements.length > 0 ? (
            <View style={styles.section}>
              <SectionTitle>sudah dibayar</SectionTitle>
              <Card style={styles.listCard}>
                {settlements.map((settlement, index) => (
                  <View key={settlement.id}>
                    {index > 0 ? <Divider /> : null}
                    <View style={styles.historyRow}>
                      <Text style={styles.historyText} numberOfLines={1}>
                        {displayName(state, settlement.fromId)} → {displayName(state, settlement.toId)}
                      </Text>
                      <Money value={settlement.amount} tone="muted" />
                    </View>
                  </View>
                ))}
              </Card>
            </View>
          ) : null}
        </ScrollView>
      </Screen>
    </View>
  );
}

/**
 * Berapa transfer yang dibutuhkan kalau tidak ada penyederhanaan sama sekali:
 * setiap peserta membayar langsung kepada orang yang menalangi. Angka ini yang
 * dibandingkan dengan hasil penyederhanaan.
 */
function countDirectRepayments(state: Parameters<typeof balancesOf>[0]): number {
  const pairs = new Set<string>();
  for (const expense of activeExpenses(state)) {
    for (const participant of expense.participants) {
      if (participant !== expense.payerId) pairs.add(`${participant}→${expense.payerId}`);
    }
  }
  return pairs.size;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  padded: { padding: spacing.lg },
  content: { padding: spacing.lg, gap: spacing.xl, paddingBottom: spacing.xxl },

  headline: { paddingTop: spacing.xs, gap: spacing.xs },
  headlineLabel: { ...type.label, color: colors.textMuted, textTransform: 'lowercase' },
  headlineBig: { ...type.display, color: colors.accent },
  headlineSub: { ...type.body, color: colors.textMuted, marginTop: spacing.xs },

  section: { gap: spacing.md },

  transferCard: { gap: spacing.lg },
  transferTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  transferNames: { flexShrink: 1, gap: 2 },
  transferName: { ...type.bodyStrong, color: colors.text },
  arrow: { ...type.caption, color: colors.textFaint },

  listCard: { paddingVertical: spacing.xs, paddingHorizontal: spacing.lg },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  historyText: { ...type.body, color: colors.textMuted, flexShrink: 1 },
});

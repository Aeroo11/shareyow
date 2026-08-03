import { useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { activeExpenses, activeSettlements } from '../../../core/ops';
import { balancesOf, displayName, transfersOf } from '../../../core/selectors';
import { formatRupiah } from '../../../core/money';
import { addSettlement } from '../../../db/actions';
import { useGroup } from '../../../hooks/useGroups';
import { Button, Card, EmptyState, ErrorNotice, Loading, Money, SectionTitle } from '../../../ui/components';
import { confirm } from '../../../ui/confirm';
import { colors, spacing, type } from '../../../ui/theme';

export default function SettleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const { data, loading, error } = useGroup(id);

  if (loading) return <Loading />;
  if (error) {
    return (
      <View style={styles.padded}>
        <ErrorNotice error={error} />
      </View>
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
      <View style={styles.padded}>
        <ErrorNotice error={e instanceof Error ? e : new Error(String(e))} />
      </View>
    );
  }

  const naive = countDirectRepayments(state);

  async function markPaid(fromId: string, toId: string, amount: number) {
    if (!myMemberId) return;
    const yes = await confirm({
      title: 'Tandai sudah dibayar?',
      message: `${displayName(state, fromId)} mengirim ${formatRupiah(amount)} ke ${displayName(state, toId)}.`,
      confirmLabel: 'Sudah dibayar',
    });
    if (yes) await addSettlement(db, state.id, myMemberId, { fromId, toId, amount });
  }

  const settlements = activeSettlements(state);

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {transfers.length === 0 ? (
        <Card>
          <EmptyState
            title="Semua sudah lunas"
            body="Tidak ada yang perlu ditransfer di grup ini."
          />
        </Card>
      ) : (
        <>
          <Card style={styles.summaryCard}>
            <Text style={styles.summaryHeadline}>
              {transfers.length} transfer untuk melunaskan semua orang
            </Text>
            {naive > transfers.length ? (
              <Text style={styles.summaryBody}>
                Kalau setiap orang membayar langsung kepada yang menalangi, butuh {naive} transfer.
                Utang yang searah dialihkan supaya cukup {transfers.length}.
              </Text>
            ) : (
              <Text style={styles.summaryBody}>
                Tidak ada utang yang bisa dialihkan lagi — ini sudah paling ringkas.
              </Text>
            )}
          </Card>

          <View style={styles.section}>
            <SectionTitle>Yang perlu ditransfer</SectionTitle>
            {transfers.map((transfer) => (
              <Card key={`${transfer.fromId}-${transfer.toId}`} style={styles.transferCard}>
                <View style={styles.transferTop}>
                  <View style={styles.transferNames}>
                    <Text style={styles.transferFrom} numberOfLines={1}>
                      {displayName(state, transfer.fromId)}
                      {transfer.fromId === myMemberId ? ' (kamu)' : ''}
                    </Text>
                    <Text style={styles.arrow}>→</Text>
                    <Text style={styles.transferTo} numberOfLines={1}>
                      {displayName(state, transfer.toId)}
                      {transfer.toId === myMemberId ? ' (kamu)' : ''}
                    </Text>
                  </View>
                  <Money value={transfer.amount} size="title" />
                </View>

                <Button
                  label="Tandai sudah dibayar"
                  variant="secondary"
                  onPress={() => void markPaid(transfer.fromId, transfer.toId, transfer.amount)}
                />
              </Card>
            ))}
          </View>
        </>
      )}

      {settlements.length > 0 ? (
        <View style={styles.section}>
          <SectionTitle>Sudah dibayar</SectionTitle>
          <Card style={{ gap: spacing.md }}>
            {settlements.map((settlement) => (
              <View key={settlement.id} style={styles.historyRow}>
                <Text style={styles.historyText} numberOfLines={1}>
                  {displayName(state, settlement.fromId)} → {displayName(state, settlement.toId)}
                </Text>
                <Money value={settlement.amount} tone="muted" />
              </View>
            ))}
          </Card>
        </View>
      ) : null}
    </ScrollView>
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
  padded: { padding: spacing.lg },
  content: { padding: spacing.lg, gap: spacing.xl },
  section: { gap: spacing.sm },

  summaryCard: { backgroundColor: colors.accentSoft, borderColor: colors.accentSoft, gap: spacing.xs },
  summaryHeadline: { ...type.heading, color: colors.accent },
  summaryBody: { ...type.caption, color: colors.accent, lineHeight: 18 },

  transferCard: { gap: spacing.md },
  transferTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  transferNames: { flexShrink: 1, gap: 2 },
  transferFrom: { ...type.bodyStrong, color: colors.text },
  arrow: { ...type.caption, color: colors.textFaint },
  transferTo: { ...type.bodyStrong, color: colors.text },

  historyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  historyText: { ...type.body, color: colors.textMuted, flexShrink: 1 },
});

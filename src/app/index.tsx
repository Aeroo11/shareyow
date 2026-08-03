import { Link, useRouter } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card, EmptyState, ErrorNotice, Loading, Money } from '../ui/components';
import { colors, radius, spacing, type } from '../ui/theme';
import { useGroups, type GroupSummary } from '../hooks/useGroups';

export default function GroupListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: groups, loading, error } = useGroups();

  if (loading) return <Loading />;
  if (error) {
    return (
      <View style={styles.padded}>
        <ErrorNotice error={error} />
      </View>
    );
  }

  const owes = (groups ?? []).reduce((sum, g) => sum + g.owes, 0);
  const isOwed = (groups ?? []).reduce((sum, g) => sum + g.isOwed, 0);

  return (
    <View style={styles.container}>
      <FlatList
        data={groups ?? []}
        keyExtractor={(g) => g.state.id}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 96 }]}
        ListHeaderComponent={
          (groups ?? []).length > 0 ? <Totals owes={owes} isOwed={isOwed} /> : null
        }
        ListEmptyComponent={
          <EmptyState
            title="Belum ada grup"
            body={
              'Buat satu grup untuk kos atau kelompok tugas. Teman-temanmu tidak perlu ' +
              'memasang aplikasi ini — cukup catat nama mereka.'
            }
          />
        }
        renderItem={({ item }) => <GroupCard summary={item} />}
      />

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Button label="Grup baru" onPress={() => router.push('/group/new')} />
      </View>
    </View>
  );
}

function Totals({ owes, isOwed }: { owes: number; isOwed: number }) {
  if (owes === 0 && isOwed === 0) {
    return (
      <View style={styles.totalsSettled}>
        <Text style={styles.settledText}>Semua sudah lunas.</Text>
      </View>
    );
  }

  return (
    <View style={styles.totals}>
      <View style={styles.totalsHalf}>
        <Text style={styles.totalsLabel}>Kamu berutang</Text>
        <Money value={owes} tone={owes > 0 ? 'negative' : 'muted'} size="title" />
      </View>
      <View style={styles.totalsDivider} />
      <View style={styles.totalsHalf}>
        <Text style={styles.totalsLabel}>Kamu menagih</Text>
        <Money value={isOwed} tone={isOwed > 0 ? 'positive' : 'muted'} size="title" />
      </View>
    </View>
  );
}

function GroupCard({ summary }: { summary: GroupSummary }) {
  const { state, memberCount, expenseCount, owes, isOwed } = summary;

  return (
    <Link href={`/group/${state.id}`} asChild>
      <Pressable style={({ pressed }) => pressed && { opacity: 0.7 }}>
        <Card style={styles.groupCard}>
          <View style={styles.groupCardTop}>
            <Text style={styles.groupName} numberOfLines={1}>
              {state.name}
            </Text>
            <Text style={styles.groupMeta}>
              {memberCount} orang · {expenseCount} catatan
            </Text>
          </View>

          {owes > 0 ? (
            <View style={styles.badgeNegative}>
              <Text style={styles.badgeNegativeText}>kamu berutang</Text>
              <Money value={owes} tone="negative" />
            </View>
          ) : isOwed > 0 ? (
            <View style={styles.badgePositive}>
              <Text style={styles.badgePositiveText}>kamu menagih</Text>
              <Money value={isOwed} tone="positive" />
            </View>
          ) : (
            <Text style={styles.groupSettled}>lunas</Text>
          )}
        </Card>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  padded: { padding: spacing.lg },
  list: { padding: spacing.lg, gap: spacing.md },

  totals: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
    marginBottom: spacing.xs,
  },
  totalsHalf: { flex: 1, gap: spacing.xs },
  totalsDivider: { width: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  totalsLabel: { ...type.caption, color: colors.textMuted },
  totalsSettled: {
    backgroundColor: colors.positiveSoft,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.xs,
  },
  settledText: { ...type.body, color: colors.positive },

  groupCard: { gap: spacing.md },
  groupCardTop: { gap: 2 },
  groupName: { ...type.title, color: colors.text },
  groupMeta: { ...type.caption, color: colors.textMuted },
  groupSettled: { ...type.body, color: colors.textFaint },

  badgePositive: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.positiveSoft,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  badgePositiveText: { ...type.caption, color: colors.positive },
  badgeNegative: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.negativeSoft,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  badgeNegativeText: { ...type.caption, color: colors.negative },

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
});

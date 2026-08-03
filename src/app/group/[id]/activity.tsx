import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { describeOps, timeAgo, type ActivityEntry } from '../../../core/activity';
import { fold } from '../../../core/ops';
import { useDbQuery } from '../../../db/live';
import { loadOps } from '../../../db/repository';
import {
  Card,
  Divider,
  EmptyState,
  ErrorNotice,
  Loading,
  Money,
  Screen,
} from '../../../ui/components';
import { colors, radius, spacing, type } from '../../../ui/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

export default function ActivityScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data, loading, error } = useDbQuery(
    async (db) => {
      if (!id) return null;
      const ops = await loadOps(db, id);
      if (ops.length === 0) return null;
      // State dibutuhkan untuk menerjemahkan id menjadi nama. Dilipat dari
      // operasi yang sama, jadi tidak ada kueri tambahan.
      return { entries: describeOps(fold(id, ops), ops), now: Date.now() };
    },
    [id],
  );

  if (loading) return <Loading />;
  if (error) {
    return (
      <Screen style={styles.padded}>
        <ErrorNotice error={error} />
      </Screen>
    );
  }
  if (!data || data.entries.length === 0) {
    return (
      <Screen style={styles.padded}>
        <EmptyState title="belum ada aktivitas" body="Riwayat akan muncul begitu ada yang dicatat." />
      </Screen>
    );
  }

  return (
    <View style={styles.root}>
      <Screen>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.intro}>
            Setiap perubahan tercatat sebagai satu operasi yang tidak pernah diubah lagi. Daftar ini
            membaca catatan itu langsung — bukan salinan terpisah yang bisa melenceng.
          </Text>

          <Card style={styles.listCard}>
            {data.entries.map((entry, index) => (
              <View key={entry.id}>
                {index > 0 ? <Divider /> : null}
                <Row entry={entry} now={data.now} />
              </View>
            ))}
          </Card>
        </ScrollView>
      </Screen>
    </View>
  );
}

function Row({ entry, now }: { entry: ActivityEntry; now: number }) {
  return (
    <View style={styles.row}>
      <View style={styles.iconRing}>
        <Ionicons name={entry.icon as IoniconName} size={16} color={colors.accent} />
      </View>

      <View style={styles.main}>
        <Text style={styles.text}>
          <Text style={styles.actor}>{entry.actor} </Text>
          {entry.text}
        </Text>
        <View style={styles.metaRow}>
          <Text style={styles.meta}>{timeAgo(entry.at, now)}</Text>
          {entry.pending ? (
            <View style={styles.pendingTag}>
              <Text style={styles.pendingText}>belum tersinkron</Text>
            </View>
          ) : null}
        </View>
      </View>

      {entry.amount !== undefined ? <Money value={entry.amount} tone="muted" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  padded: { padding: spacing.lg },
  content: { padding: spacing.lg, gap: spacing.lg, paddingBottom: spacing.xxl },
  intro: { ...type.caption, color: colors.textFaint },

  listCard: { paddingVertical: spacing.xs, paddingHorizontal: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg },
  iconRing: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  main: { flex: 1, gap: 3 },
  text: { ...type.body, color: colors.textMuted },
  actor: { ...type.bodyStrong, color: colors.text },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  meta: { ...type.caption, color: colors.textFaint },
  pendingTag: {
    backgroundColor: colors.warningSoft,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  pendingText: { ...type.caption, color: colors.warningText, fontSize: 11 },
});

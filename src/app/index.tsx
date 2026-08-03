import { useRouter } from 'expo-router';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Button,
  Card,
  EmptyState,
  ErrorNotice,
  Loading,
  Money,
  Screen,
  Touchable,
} from '../ui/components';
import { formatRupiah } from '../core/money';
import { colors, radius, spacing, type } from '../ui/theme';
import { useGroups, type GroupSummary } from '../hooks/useGroups';
import { useSync } from '../hooks/useSync';

export default function GroupListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: groups, loading, error } = useGroups();
  const sync = useSync();

  if (loading) return <Loading />;
  if (error) {
    return (
      <Screen style={styles.padded}>
        <ErrorNotice error={error} />
      </Screen>
    );
  }

  const list = groups ?? [];
  const owes = list.reduce((sum, g) => sum + g.owes, 0);
  const isOwed = list.reduce((sum, g) => sum + g.isOwed, 0);

  return (
    <View style={styles.root}>
      <Screen>
        <FlatList
          data={list}
          keyExtractor={(g) => g.state.id}
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 108 }]}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <>
              <SyncBar sync={sync} onOpenAccount={() => router.push('/account')} />
              {list.length > 0 ? <Headline owes={owes} isOwed={isOwed} /> : null}
            </>
          }
          ListEmptyComponent={<Welcome />}
          renderItem={({ item, index }) => <GroupCard summary={item} index={index} />}
        />
      </Screen>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Screen style={styles.footerRow}>
          <Button
            label="Gabung"
            variant="secondary"
            style={styles.footerJoin}
            onPress={() => router.push('/join')}
          />
          <Button
            label="Grup baru"
            style={styles.footerNew}
            onPress={() => router.push('/group/new')}
          />
        </Screen>
      </View>
    </View>
  );
}

/**
 * Baris status sinkronisasi.
 *
 * Ia hanya muncul kalau ada yang perlu diketahui. Aplikasi ini berjalan penuh
 * tanpa akun, jadi menampilkan "belum masuk" secara permanen akan terasa seperti
 * teguran atas sesuatu yang bukan kesalahan.
 */
function SyncBar({ sync, onOpenAccount }: { sync: SyncStateView; onOpenAccount: () => void }) {
  const label =
    sync.running ? 'menyinkron…'
    : sync.lastError ? 'gagal menyinkron'
    : sync.pending > 0 ? `${sync.pending} belum terkirim`
    : sync.canSync ? 'tersinkron'
    : 'hanya di HP ini';

  const tone =
    sync.lastError ? colors.negative
    : sync.pending > 0 ? colors.warningText
    : sync.canSync ? colors.accent
    : colors.textFaint;

  return (
    <Touchable onPress={onOpenAccount}>
      <View style={styles.syncBar}>
        <View style={[styles.syncDot, { backgroundColor: tone }]} />
        <Text style={[styles.syncText, { color: tone }]}>{label}</Text>
        <Text style={styles.syncAction}>{sync.canSync ? 'akun' : 'aktifkan'}</Text>
      </View>
    </Touchable>
  );
}

type SyncStateView = ReturnType<typeof useSync>;

/**
 * Sambutan pertama kali.
 *
 * Sengaja BUKAN layar tersendiri. Layar sambutan terpisah menuntut satu penanda
 * "sudah pernah dilihat" yang harus disimpan, dan penanda semacam itu selalu bisa
 * melenceng dari kenyataan — tersimpan padahal grupnya sudah dihapus, atau
 * sebaliknya. Kondisi "belum punya grup" adalah kebenaran yang sudah kita punya
 * dan tidak perlu dijaga: ia muncul sendiri untuk orang baru, dan hilang sendiri
 * begitu grup pertama dibuat.
 */
function Welcome() {
  return (
    <View style={styles.welcome}>
      <Text style={styles.wordmark}>share.yow</Text>
      <Text style={styles.tagline}>Patungan tanpa drama.</Text>

      <View style={styles.points}>
        {[
          'Catat siapa menalangi apa, kapan saja — tanpa sinyal sekalipun.',
          'Teman-temanmu tidak perlu memasang aplikasi ini. Cukup catat namanya.',
          'Nanti tinggal lihat siapa transfer ke siapa, dengan transfer sesedikit mungkin.',
        ].map((point) => (
          <View key={point} style={styles.pointRow}>
            <View style={styles.dot} />
            <Text style={styles.pointText}>{point}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

/**
 * Angka pertama yang dilihat setiap kali aplikasi dibuka. Ia menjawab satu
 * pertanyaan yang membuat orang membuka aplikasi ini: apakah aku sedang berutang.
 */
function Headline({ owes, isOwed }: { owes: number; isOwed: number }) {
  if (owes === 0 && isOwed === 0) {
    return (
      <View style={styles.headline}>
        <Text style={styles.headlineLabel}>semuanya</Text>
        <Text style={styles.settledBig}>lunas</Text>
      </View>
    );
  }

  // Kalau kamu berutang, itu yang ditampilkan besar — utang lebih mendesak
  // daripada tagihan, dan menampilkan keduanya sama besar membuat keduanya
  // sama-sama terabaikan.
  const owing = owes > 0;

  return (
    <View style={styles.headline}>
      <Text style={styles.headlineLabel}>{owing ? 'kamu berutang' : 'kamu menagih'}</Text>
      <Money value={owing ? owes : isOwed} tone={owing ? 'negative' : 'positive'} size="display" animate />
      {owing && isOwed > 0 ? (
        <Text style={styles.headlineSub}>
          Sementara itu {formatRupiah(isOwed)} masih ditagihkan ke orang lain.
        </Text>
      ) : null}
    </View>
  );
}

function GroupCard({ summary, index }: { summary: GroupSummary; index: number }) {
  const router = useRouter();
  const { state, memberCount, expenseCount, owes, isOwed } = summary;

  return (
    <Touchable index={index} onPress={() => router.push(`/group/${state.id}`)}>
      <Card style={styles.groupCard}>
        <View style={styles.groupTop}>
          <View style={styles.groupNameWrap}>
            <Text style={styles.groupName} numberOfLines={1}>
              {state.name}
            </Text>
            <Text style={styles.groupMeta}>
              {memberCount} orang · {expenseCount} catatan
            </Text>
          </View>

          {owes > 0 ? (
            <View style={styles.amountRight}>
              <Money value={-owes} tone="negative" />
            </View>
          ) : isOwed > 0 ? (
            <View style={styles.amountRight}>
              <Money value={isOwed} tone="positive" />
            </View>
          ) : (
            <Text style={styles.groupSettled}>lunas</Text>
          )}
        </View>
      </Card>
    </Touchable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  padded: { padding: spacing.lg },
  list: { padding: spacing.lg, gap: spacing.md },

  syncBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  syncDot: { width: 6, height: 6, borderRadius: 3 },
  syncText: { ...type.caption, flex: 1 },
  syncAction: { ...type.label, color: colors.textFaint, textTransform: 'lowercase' },

  welcome: { paddingTop: spacing.xl, gap: spacing.sm },
  wordmark: { ...type.display, fontSize: 40, lineHeight: 44, color: colors.accent },
  tagline: { ...type.heading, color: colors.textMuted },
  points: { gap: spacing.lg, marginTop: spacing.xl },
  pointRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.accent,
    marginTop: 8,
  },
  pointText: { ...type.body, color: colors.textMuted, flex: 1 },

  headline: { paddingVertical: spacing.lg, gap: spacing.xs },
  headlineLabel: { ...type.label, color: colors.textMuted, textTransform: 'lowercase' },
  headlineSub: { ...type.caption, color: colors.textFaint, marginTop: spacing.xs },
  settledBig: { ...type.display, color: colors.accent },

  groupCard: { gap: 0 },
  groupTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  groupNameWrap: { flexShrink: 1, gap: 2 },
  groupName: { ...type.heading, color: colors.text },
  groupMeta: { ...type.caption, color: colors.textFaint },
  groupSettled: { ...type.body, color: colors.textFaint },
  amountRight: { alignItems: 'flex-end' },

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
  footerJoin: { paddingHorizontal: spacing.lg, borderRadius: radius.md },
  footerNew: { flex: 1, borderRadius: radius.md },
});

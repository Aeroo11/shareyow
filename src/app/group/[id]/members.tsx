import { useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { formatRupiah } from '../../../core/money';
import { activeMembers } from '../../../core/ops';
import { balancesOf } from '../../../core/selectors';
import { addMember, renameMember } from '../../../db/actions';
import { useGroup } from '../../../hooks/useGroups';
import {
  Button,
  Card,
  Divider,
  ErrorNotice,
  Field,
  Loading,
  Screen,
  SectionTitle,
  Touchable,
} from '../../../ui/components';
import { colors, radius, spacing, type } from '../../../ui/theme';

export default function MembersScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const { data, loading, error } = useGroup(id);

  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [busy, setBusy] = useState(false);

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
  const members = activeMembers(state);
  const balances = balancesOf(state);
  const author = myMemberId ?? members[0]?.id ?? null;

  async function add() {
    if (!author || newName.trim().length === 0 || busy) return;
    setBusy(true);
    try {
      await addMember(db, state.id, author, newName);
      setNewName('');
    } finally {
      setBusy(false);
    }
  }

  async function commitRename() {
    if (!author || !editingId || editingName.trim().length === 0) {
      setEditingId(null);
      return;
    }
    await renameMember(db, state.id, author, editingId, editingName);
    setEditingId(null);
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
          <View style={styles.section}>
            <SectionTitle>anggota grup</SectionTitle>

            <Card style={styles.listCard}>
              {members.map((member, index) => {
                const balance = balances.get(member.id) ?? 0;
                const isEditing = editingId === member.id;

                return (
                  <View key={member.id}>
                    {index > 0 ? <Divider /> : null}
                    {isEditing ? (
                      <View style={styles.editWrap}>
                        <Field
                          label="nama"
                          value={editingName}
                          onChangeText={setEditingName}
                          onBlur={commitRename}
                          onSubmitEditing={commitRename}
                          returnKeyType="done"
                          autoFocus
                        />
                      </View>
                    ) : (
                      <Touchable
                        index={index}
                        onPress={() => {
                          setEditingId(member.id);
                          setEditingName(member.displayName);
                        }}
                      >
                        <View style={styles.row}>
                          <View style={styles.nameWrap}>
                            <Text style={styles.name} numberOfLines={1}>
                              {member.displayName}
                              {member.id === myMemberId ? ' · kamu' : ''}
                            </Text>
                            <Text
                              style={[
                                styles.balance,
                                balance > 0 && { color: colors.positive },
                                balance < 0 && { color: colors.negative },
                              ]}
                            >
                              {balance === 0
                                ? 'lunas'
                                : balance > 0
                                  ? `menagih ${formatRupiah(balance)}`
                                  : `berutang ${formatRupiah(-balance)}`}
                            </Text>
                          </View>
                          <Text style={styles.editHint}>ubah</Text>
                        </View>
                      </Touchable>
                    )}
                  </View>
                );
              })}
            </Card>
          </View>

          <View style={styles.section}>
            <SectionTitle>tambah orang</SectionTitle>
            <Field
              label="nama"
              placeholder="Dika"
              value={newName}
              onChangeText={setNewName}
              onSubmitEditing={add}
              returnKeyType="done"
              hint="Dia tidak perlu memasang aplikasi ini."
            />
            <Button
              label={busy ? 'Menambahkan…' : 'Tambahkan'}
              onPress={add}
              disabled={newName.trim().length === 0 || busy}
              haptic="success"
            />
          </View>

          <View style={styles.noteBox}>
            <Text style={styles.noteText}>
              Menghapus anggota belum bisa dilakukan. Orang yang saldonya belum nol akan hilang
              dari daftar tapi utangnya tetap ikut dihitung — jadi fitur itu ditunda sampai
              penanganannya benar, bukan dibuat setengah jalan.
            </Text>
          </View>
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

  listCard: { paddingVertical: spacing.xs, paddingHorizontal: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    paddingVertical: spacing.lg,
  },
  nameWrap: { flexShrink: 1, gap: 3 },
  editWrap: { paddingVertical: spacing.md },
  name: { ...type.bodyStrong, color: colors.text },
  balance: { ...type.caption, color: colors.textFaint },
  editHint: { ...type.caption, color: colors.textFaint },

  noteBox: { backgroundColor: colors.warningSoft, borderRadius: radius.sm, padding: spacing.lg },
  noteText: { ...type.caption, color: colors.warningText },
});

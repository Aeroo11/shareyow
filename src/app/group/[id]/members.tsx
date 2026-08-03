import { useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { formatRupiah } from '../../../core/money';
import { activeMembers } from '../../../core/ops';
import { balancesOf } from '../../../core/selectors';
import { addMember, renameMember } from '../../../db/actions';
import { useGroup } from '../../../hooks/useGroups';
import { Button, Card, ErrorNotice, Field, Loading, SectionTitle } from '../../../ui/components';
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
      <View style={styles.padded}>
        <ErrorNotice error={error} />
      </View>
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
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      automaticallyAdjustKeyboardInsets
    >
      <View style={styles.section}>
        <SectionTitle>Anggota grup</SectionTitle>
        <Card style={{ gap: 0, paddingVertical: spacing.xs }}>
          {members.map((member, index) => {
            const balance = balances.get(member.id) ?? 0;
            const isEditing = editingId === member.id;

            return (
              <View
                key={member.id}
                style={[styles.row, index < members.length - 1 && styles.rowBorder]}
              >
                {isEditing ? (
                  <View style={styles.editWrap}>
                    <Field
                      label="Nama"
                      value={editingName}
                      onChangeText={setEditingName}
                      onBlur={commitRename}
                      onSubmitEditing={commitRename}
                      returnKeyType="done"
                      autoFocus
                    />
                  </View>
                ) : (
                  <Pressable
                    onPress={() => {
                      setEditingId(member.id);
                      setEditingName(member.displayName);
                    }}
                    style={({ pressed }) => [styles.nameWrap, pressed && { opacity: 0.6 }]}
                  >
                    <Text style={styles.name} numberOfLines={1}>
                      {member.displayName}
                      {member.id === myMemberId ? ' (kamu)' : ''}
                    </Text>
                    <Text style={styles.balance}>
                      {balance === 0
                        ? 'lunas'
                        : balance > 0
                          ? `menagih ${formatRupiah(balance)}`
                          : `berutang ${formatRupiah(-balance)}`}
                    </Text>
                  </Pressable>
                )}
              </View>
            );
          })}
        </Card>
        <Text style={styles.hint}>Ketuk sebuah nama untuk mengubahnya.</Text>
      </View>

      <View style={styles.section}>
        <SectionTitle>Tambah orang</SectionTitle>
        <Field
          label="Nama"
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
        />
      </View>

      <View style={styles.noteBox}>
        <Text style={styles.noteText}>
          Menghapus anggota belum bisa dilakukan. Orang yang saldonya belum nol akan hilang dari
          daftar tapi utangnya tetap ikut dihitung — jadi fitur itu ditunda sampai penanganannya
          benar, bukan dibuat setengah jalan.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.bg },
  padded: { padding: spacing.lg },
  content: { padding: spacing.lg, gap: spacing.xl },
  section: { gap: spacing.sm },

  row: { paddingVertical: spacing.sm },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  nameWrap: { paddingVertical: spacing.xs, gap: 2 },
  editWrap: { paddingVertical: spacing.xs },
  name: { ...type.bodyStrong, color: colors.text },
  balance: { ...type.caption, color: colors.textMuted },
  hint: { ...type.caption, color: colors.textFaint },

  noteBox: { backgroundColor: colors.warningSoft, borderRadius: radius.md, padding: spacing.md },
  noteText: { ...type.caption, color: colors.warningText, lineHeight: 18 },
});

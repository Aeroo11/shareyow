import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { CATEGORIES, categoryOf } from '../core/categories';
import { Chip, SectionTitle, Touchable } from './components';
import { colors, numeric, radius, spacing, type } from './theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

/** Lingkaran berisi ikon kategori. Dipakai di daftar pengeluaran. */
export function CategoryIcon({ id, size = 36 }: { id: string | undefined; size?: number }) {
  const category = categoryOf(id);
  return (
    <View style={[styles.iconRing, { width: size, height: size }]}>
      <Ionicons name={category.icon as IoniconName} size={size * 0.5} color={colors.accent} />
    </View>
  );
}

export function CategoryPicker({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (id: string) => void;
}) {
  return (
    <View style={{ gap: spacing.md }}>
      <SectionTitle>kategori</SectionTitle>
      <View style={styles.chipRow}>
        {CATEGORIES.map((category) => (
          <Chip
            key={category.id}
            label={category.label}
            selected={value === category.id}
            onPress={() => onChange(category.id)}
          />
        ))}
      </View>
    </View>
  );
}

/**
 * Pemilih tanggal berbentuk penggeser satu hari.
 *
 * Sengaja tanpa pustaka pemilih tanggal. Yang tidak bisa dikerjakan tanpanya
 * adalah melompat ke tanggal yang jauh — dan pada aplikasi patungan anak kos itu
 * hampir tidak pernah terjadi: yang dicatat adalah pengeluaran hari ini, kadang
 * kemarin. Menambah dependensi yang punya perilaku berbeda di iOS, Android, dan
 * web demi kasus yang jarang bukan pertukaran yang baik.
 *
 * Batasnya jujur: melompat jauh ke belakang berarti mengetuk berkali-kali. Kalau
 * suatu saat itu benar-benar mengganggu, barulah pustaka pemilih tanggal punya
 * alasan untuk ada.
 */
export function DateStepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (epochMs: number) => void;
}) {
  const today = startOfDay(Date.now());
  const selected = startOfDay(value);
  const isToday = selected === today;
  // Tanggal di masa depan tidak masuk akal untuk catatan "siapa sudah membayar apa".
  const canGoForward = selected < today;

  const shift = (days: number) => {
    const next = new Date(selected);
    next.setDate(next.getDate() + days);
    onChange(next.getTime());
  };

  return (
    <View style={{ gap: spacing.md }}>
      <SectionTitle
        action={
          isToday ? null : (
            <Text style={styles.reset} onPress={() => onChange(Date.now())}>
              hari ini
            </Text>
          )
        }
      >
        tanggal
      </SectionTitle>

      <View style={styles.stepperRow}>
        <Touchable onPress={() => shift(-1)}>
          <View style={styles.stepButton}>
            <Ionicons name="chevron-back" size={18} color={colors.text} />
          </View>
        </Touchable>

        <View style={styles.dateWrap}>
          <Text style={styles.dateText}>{formatRelative(selected, today)}</Text>
          <Text style={styles.dateFull}>{formatFull(selected)}</Text>
        </View>

        <Touchable onPress={canGoForward ? () => shift(1) : undefined}>
          <View style={[styles.stepButton, !canGoForward && styles.stepButtonOff]}>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={canGoForward ? colors.text : colors.textFaint}
            />
          </View>
        </Touchable>
      </View>
    </View>
  );
}

function startOfDay(epochMs: number): number {
  const d = new Date(epochMs);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** "hari ini" lebih cepat dibaca daripada "3 Agustus 2026" untuk tanggal terdekat. */
function formatRelative(selected: number, today: number): string {
  const days = Math.round((today - selected) / 86_400_000);
  if (days === 0) return 'hari ini';
  if (days === 1) return 'kemarin';
  if (days < 7) return `${days} hari lalu`;
  return formatFull(selected);
}

function formatFull(epochMs: number): string {
  return new Date(epochMs).toLocaleDateString('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

const styles = StyleSheet.create({
  iconRing: {
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  reset: { ...type.label, color: colors.accent, textTransform: 'lowercase' },

  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.md,
  },
  stepButton: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepButtonOff: { opacity: 0.4 },
  dateWrap: { flex: 1, alignItems: 'center', gap: 2 },
  dateText: { ...type.bodyStrong, color: colors.text, ...numeric },
  dateFull: { ...type.caption, color: colors.textFaint },
});

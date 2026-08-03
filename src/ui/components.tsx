import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { formatRupiah, type Rupiah } from '../core/money';
import { tapFeedback, useEnter, usePressScale, usePulseOnChange } from './motion';
import { colors, layout, numeric, radius, spacing, type } from './theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/**
 * Pembungkus isi layar. Membatasi lebar dan menaruhnya di tengah — di HP tidak
 * berpengaruh apa-apa, tapi di browser inilah yang mencegah kartu melar jadi
 * batang selebar monitor dan membuat halaman terbaca kosong.
 */
export function Screen({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.screen, style]}>{children}</View>;
}

export function Card({
  children,
  style,
  raised,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  raised?: boolean;
}) {
  return <View style={[styles.card, raised && styles.cardRaised, style]}>{children}</View>;
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={styles.sectionTitle}>{children}</Text>
      {action}
    </View>
  );
}

export function Divider() {
  return <View style={styles.divider} />;
}

/**
 * Nominal. Angka adalah elemen terpenting di aplikasi ini, jadi ia punya
 * komponennya sendiri: memakai lebar digit tetap supaya tidak bergoyang saat
 * berubah, dan berdenyut sedikit setiap kali nilainya berganti.
 */
export function Money({
  value,
  tone = 'neutral',
  size = 'body',
  animate = false,
}: {
  value: Rupiah;
  tone?: 'neutral' | 'positive' | 'negative' | 'muted' | 'onAccent';
  size?: 'body' | 'title' | 'display';
  animate?: boolean;
}) {
  const pulse = usePulseOnChange(value);

  const color =
    tone === 'positive' ? colors.positive
    : tone === 'negative' ? colors.negative
    : tone === 'muted' ? colors.textMuted
    : tone === 'onAccent' ? colors.textOnAccent
    : colors.text;

  const textStyle = [
    size === 'display' ? type.display : size === 'title' ? type.title : type.bodyStrong,
    numeric,
    { color },
  ];

  if (!animate) return <Text style={textStyle}>{formatRupiah(value)}</Text>;

  return (
    <Animated.View style={pulse}>
      <Text style={textStyle}>{formatRupiah(value)}</Text>
    </Animated.View>
  );
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  style,
  haptic = 'light',
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  haptic?: 'light' | 'medium' | 'success' | 'none';
}) {
  const press = usePressScale();

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      onPress={() => {
        if (haptic !== 'none') tapFeedback(haptic);
        onPress();
      }}
      style={[
        styles.button,
        variant === 'primary' && styles.buttonPrimary,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'ghost' && styles.buttonGhost,
        variant === 'danger' && styles.buttonDanger,
        disabled && { opacity: 0.35 },
        press.style,
        style,
      ]}
    >
      <Text
        style={[
          styles.buttonLabel,
          variant === 'secondary' && { color: colors.text },
          variant === 'ghost' && { color: colors.accent },
          variant === 'danger' && { color: colors.negative },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </AnimatedPressable>
  );
}

/** Baris yang bisa disentuh, dengan skala tekan. Dipakai kartu dan baris daftar. */
export function Touchable({
  children,
  onPress,
  onLongPress,
  index,
  style,
}: {
  children: ReactNode;
  onPress?: () => void;
  onLongPress?: () => void;
  /** Urutan di dalam daftar — membuat baris muncul bergiliran. */
  index?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const press = usePressScale(0.985);
  const enter = useEnter(index ?? 0);

  return (
    <Animated.View style={index === undefined ? undefined : enter}>
      <AnimatedPressable
        accessibilityRole="button"
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        onPress={
          onPress &&
          (() => {
            tapFeedback('light');
            onPress();
          })
        }
        onLongPress={
          onLongPress &&
          (() => {
            tapFeedback('medium');
            onLongPress();
          })
        }
        style={[press.style, style]}
      >
        {children}
      </AnimatedPressable>
    </Animated.View>
  );
}

/** Lencana kecil berisi keterangan dan nominal. */
export function Pill({
  label,
  children,
  tone = 'neutral',
}: {
  label: string;
  children: ReactNode;
  tone?: 'positive' | 'negative' | 'neutral';
}) {
  return (
    <View
      style={[
        styles.pill,
        tone === 'positive' && { backgroundColor: colors.positiveSoft },
        tone === 'negative' && { backgroundColor: colors.negativeSoft },
      ]}
    >
      <Text
        style={[
          styles.pillLabel,
          tone === 'positive' && { color: colors.positive },
          tone === 'negative' && { color: colors.negative },
        ]}
      >
        {label}
      </Text>
      {children}
    </View>
  );
}

export function Field({
  label,
  hint,
  error,
  ...inputProps
}: TextInputProps & { label: string; hint?: string; error?: string | null }) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.textFaint}
        selectionColor={colors.accent}
        {...inputProps}
        style={[styles.input, !!error && { borderColor: colors.negative }, inputProps.style]}
      />
      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : hint ? (
        <Text style={styles.hintText}>{hint}</Text>
      ) : null}
    </View>
  );
}

export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const press = usePressScale();

  return (
    <AnimatedPressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
      onPress={() => {
        tapFeedback('light');
        onPress();
      }}
      style={[styles.chip, selected && styles.chipSelected, press.style]}
    >
      <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]} numberOfLines={1}>
        {label}
      </Text>
    </AnimatedPressable>
  );
}

export function EmptyState({
  glyph,
  title,
  body,
  action,
}: {
  /** Satu karakter besar sebagai jangkar visual — bukan ikon fungsional. */
  glyph?: string;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.empty}>
      {glyph ? (
        <View style={styles.emptyGlyphRing}>
          <Text style={styles.emptyGlyph}>{glyph}</Text>
        </View>
      ) : null}
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyBody}>{body}</Text>
      {action}
    </View>
  );
}

export function Loading() {
  return (
    <View style={styles.centered}>
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}

export function ErrorNotice({ error }: { error: Error }) {
  return (
    <View style={styles.errorBox}>
      <Text style={styles.errorBoxTitle}>Ada yang tidak beres</Text>
      <Text style={styles.errorBoxBody}>{error.message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: spacing.lg,
  },
  cardRaised: { backgroundColor: colors.surfaceRaised },

  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 20,
  },
  sectionTitle: {
    ...type.label,
    color: colors.textFaint,
    textTransform: 'lowercase',
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },

  button: {
    minHeight: layout.minTouchSize + 8,
    borderRadius: radius.md,
    paddingVertical: 15,
    paddingHorizontal: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPrimary: { backgroundColor: colors.accent },
  buttonSecondary: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  buttonGhost: { backgroundColor: 'transparent' },
  buttonDanger: { backgroundColor: colors.negativeSoft },
  buttonLabel: { ...type.heading, color: colors.textOnAccent },

  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  pillLabel: { ...type.label, color: colors.textMuted, textTransform: 'lowercase' },

  fieldLabel: { ...type.label, color: colors.textMuted, textTransform: 'lowercase' },
  input: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: 15,
    ...type.body,
    fontSize: 16,
    color: colors.text,
  },
  hintText: { ...type.caption, color: colors.textFaint },
  errorText: { ...type.caption, color: colors.negative },

  chip: {
    minHeight: layout.minTouchSize,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    maxWidth: 200,
  },
  chipSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipLabel: { ...type.body, color: colors.textMuted },
  chipLabelSelected: { ...type.bodyStrong, color: colors.textOnAccent },

  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl },
  emptyGlyphRing: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  emptyGlyph: { ...type.title, color: colors.accent },
  emptyTitle: { ...type.heading, color: colors.text },
  emptyBody: {
    ...type.body,
    color: colors.textMuted,
    textAlign: 'center',
    maxWidth: 320,
  },

  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.bg,
  },

  errorBox: {
    backgroundColor: colors.negativeSoft,
    borderRadius: radius.md,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  errorBoxTitle: { ...type.heading, color: colors.negative },
  errorBoxBody: { ...type.body, color: colors.negative },
});

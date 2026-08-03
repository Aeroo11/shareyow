/**
 * Satu sumber untuk warna, jarak, dan ukuran huruf.
 *
 * Warna dibatasi sengaja: satu aksen, dan dua warna makna (hijau untuk "kamu
 * menagih", merah untuk "kamu berutang"). Aplikasi uang harus bisa dibaca
 * sekilas sambil berdiri di depan kasir — bukan dinikmati.
 */

export const colors = {
  bg: '#F7F7F5',
  surface: '#FFFFFF',
  border: '#E6E4DF',
  text: '#1A1A18',
  textMuted: '#75736C',
  textFaint: '#A5A29A',

  accent: '#1F6F5C',
  accentSoft: '#E4F0EC',

  /** Kamu menagih — orang lain berutang padamu. */
  positive: '#1F6F5C',
  positiveSoft: '#E4F0EC',
  /** Kamu berutang. */
  negative: '#B3402F',
  negativeSoft: '#FAE9E6',

  warningSoft: '#FDF3E3',
  warningText: '#8A6114',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  pill: 999,
} as const;

export const type = {
  display: { fontSize: 30, fontWeight: '700' },
  title: { fontSize: 20, fontWeight: '700' },
  heading: { fontSize: 16, fontWeight: '600' },
  body: { fontSize: 15, fontWeight: '400' },
  label: { fontSize: 13, fontWeight: '600' },
  caption: { fontSize: 12, fontWeight: '400' },
} as const;

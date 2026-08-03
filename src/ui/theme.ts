/**
 * Token desain share.yow. Satu-satunya tempat warna, ukuran, dan huruf boleh
 * didefinisikan — tidak ada nilai mentah di berkas layar mana pun.
 *
 * ATURAN YANG PALING PENTING: hanya ada satu warna menyala.
 *
 * Yang membuat sebuah desain terlihat norak bukan warna terang, melainkan
 * banyak warna terang yang berebut perhatian. Satu lime di atas latar hampir
 * hitam, dengan segala sisanya abu-abu, justru terbaca mahal. Warna kedua yang
 * menyala (#FF6B5A) hanya boleh muncul untuk satu makna — "kamu berutang" —
 * dan tidak untuk apa pun yang lain. Tidak ada warna ketiga.
 */

export const colors = {
  /** Hampir hitam, bukan hitam murni: #000 terasa mati dan berlubang di layar OLED. */
  bg: '#0B0C0E',
  /** Kartu. */
  surface: '#16181C',
  /** Kartu di atas kartu, sheet, kolom masukan. */
  surfaceRaised: '#1E2126',
  border: '#26292F',
  /** Untuk lapisan gelap di atas konten, mis. di balik modal. */
  scrim: 'rgba(0,0,0,0.6)',

  text: '#F2F4F5',
  textMuted: '#9BA1A8',
  textFaint: '#6B7178',
  /** Teks di atas permukaan lime. Sengaja gelap — lime terlalu terang untuk teks putih. */
  textOnAccent: '#0B0C0E',

  accent: '#D3FF4E',
  accentPressed: '#A8CC3E',
  accentSoft: 'rgba(211,255,78,0.12)',

  /** "Kamu menagih" memakai warna merek — kondisi baik, jadi ia yang menyala. */
  positive: '#D3FF4E',
  positiveSoft: 'rgba(211,255,78,0.12)',

  /** "Kamu berutang". Satu-satunya warna menyala kedua di seluruh aplikasi. */
  negative: '#FF6B5A',
  negativeSoft: 'rgba(255,107,90,0.12)',

  warningSoft: 'rgba(255,196,84,0.12)',
  warningText: '#FFC454',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 12,
  md: 20,
  lg: 28,
  pill: 999,
} as const;

/**
 * Plus Jakarta Sans — dirancang desainer Indonesia, gratis, dan berjalan di
 * Expo Go. Nama keluarga di sini harus persis sama dengan kunci yang dipakai
 * saat memuat huruf di src/app/_layout.tsx.
 */
export const fonts = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
} as const;

/**
 * Angka selalu memakai `tabular-nums`: tanpa itu lebar tiap digit berbeda,
 * sehingga nominal yang berubah tampak bergoyang-goyang di tempatnya.
 */
export const numeric = { fontVariant: ['tabular-nums' as const] };

export const type = {
  /** Angka utama — elemen terbesar di layar, dan memang harus begitu. */
  display: { fontFamily: fonts.extrabold, fontSize: 48, lineHeight: 52, letterSpacing: -1.2 },
  title: { fontFamily: fonts.bold, fontSize: 28, lineHeight: 34, letterSpacing: -0.8 },
  heading: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 24, letterSpacing: -0.2 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 22 },
  /** Label bagian: huruf kecil semua, jarak dilebarkan. */
  label: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18, letterSpacing: 0.4 },
  caption: { fontFamily: fonts.regular, fontSize: 12, lineHeight: 17 },
} as const;

/**
 * Gerak. Pegas dipakai untuk apa pun yang berhubungan dengan angka — terasa
 * hidup tanpa terasa main-main. Durasi tetap dipakai untuk pudar dan geser.
 */
export const motion = {
  spring: { damping: 18, stiffness: 220, mass: 0.7 },
  fast: 160,
  normal: 240,
  /** Skala tombol saat ditekan. Cukup terasa, tidak sampai terlihat. */
  pressScale: 0.97,
} as const;

/** Lebar isi maksimum di layar lebar, supaya web tidak jadi batang selebar monitor. */
export const layout = {
  maxContentWidth: 560,
  /** Ukuran sentuh minimum yang direkomendasikan pedoman aksesibilitas. */
  minTouchSize: 44,
} as const;

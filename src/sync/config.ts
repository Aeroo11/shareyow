/**
 * Pengaturan sinkronisasi.
 *
 * Aturan yang tidak boleh dilanggar: **aplikasi harus berjalan penuh tanpa satu
 * pun nilai di sini terisi.** Itu bukan kelonggaran, melainkan sifat produk yang
 * paling menentukan — share.yow berguna sejak menit pertama, tanpa akun, tanpa
 * internet, tanpa siapa pun ikut memasang. Sinkronisasi adalah tambahan di
 * atasnya, bukan syarat untuk memulainya.
 *
 * Karena itu tidak ada yang melempar error di berkas ini. Kalau belum diatur,
 * `isSyncConfigured` bernilai false dan seluruh lapisan sinkronisasi diam.
 */

/** Diisi Expo dari .env saat bundling. Awalan EXPO_PUBLIC_ wajib agar ikut terbawa. */
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const isSyncConfigured = SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;

/**
 * Kunci yang dipakai adalah **publishable key** (dulu bernama `anon`). Ia memang
 * dirancang untuk ditanam di aplikasi klien dan terlihat siapa pun — yang menjaga
 * data bukan kerahasiaannya, melainkan Row Level Security di sisi basis data.
 *
 * Yang tidak boleh masuk ke sini, ke .env, atau ke mana pun dekat kode klien
 * adalah **secret key** (dulu `service_role`): ia melewati seluruh RLS, dan
 * membundelnya ke aplikasi berarti menyerahkan data seluruh pengguna kepada siapa
 * pun yang membongkar bundel itu.
 */
export const CONFIG_HELP =
  'Salin .env.example menjadi .env, lalu isi EXPO_PUBLIC_SUPABASE_ANON_KEY dengan ' +
  'publishable key dari Project Settings → API Keys. Jangan pakai secret key.';

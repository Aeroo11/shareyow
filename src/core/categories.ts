/**
 * Kategori pengeluaran.
 *
 * `id` disimpan di dalam operasi dan karena itu **permanen** — log bersifat
 * append-only, jadi id yang pernah tertulis akan terus ada selamanya. Label dan
 * ikon boleh berubah kapan saja; id tidak boleh.
 *
 * Nama ikon disimpan sebagai teks biasa supaya berkas ini tetap murni dan tidak
 * mengimpor apa pun dari lapisan tampilan. Pemetaannya ke Ionicons terjadi di UI.
 */

export interface Category {
  id: string;
  label: string;
  icon: string;
}

export const CATEGORIES: Category[] = [
  { id: 'makan', label: 'makan', icon: 'fast-food-outline' },
  { id: 'belanja', label: 'belanja', icon: 'bag-handle-outline' },
  { id: 'transport', label: 'transport', icon: 'car-outline' },
  { id: 'tagihan', label: 'tagihan', icon: 'flash-outline' },
  { id: 'kos', label: 'kos', icon: 'home-outline' },
  { id: 'hiburan', label: 'hiburan', icon: 'game-controller-outline' },
  { id: 'lainnya', label: 'lainnya', icon: 'ellipsis-horizontal' },
];

const BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));

/**
 * Kategori yang tidak dikenal tetap mendapat tampilan yang wajar. Ini bukan
 * kehati-hatian berlebihan: begitu sinkronisasi berjalan, sebuah HP bisa
 * menerima operasi dari versi aplikasi yang lebih baru dan berisi kategori yang
 * belum ia kenal.
 */
export function categoryOf(id: string | undefined): Category {
  if (!id) return { id: 'lainnya', label: 'lainnya', icon: 'ellipsis-horizontal' };
  return BY_ID.get(id) ?? { id, label: id, icon: 'pricetag-outline' };
}

/**
 * Uang selalu berupa bilangan bulat rupiah. Tidak pernah float.
 *
 * Alasannya bukan sekadar kerapian: 0.1 + 0.2 !== 0.3 dalam IEEE-754, dan pada
 * aplikasi patungan kesalahan sekecil itu menumpuk lewat ratusan pembagian
 * sampai saldo tidak lagi berjumlah nol. Seluruh kode inti bekerja pada integer,
 * dan konversi ke teks hanya terjadi di lapisan tampilan.
 */

/** Rupiah bulat. Boleh negatif (mis. saldo seseorang yang berutang). */
export type Rupiah = number;

export function isValidAmount(value: number): boolean {
  return Number.isSafeInteger(value);
}

export function assertAmount(value: number, label = 'nilai'): asserts value is Rupiah {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${label} harus bilangan bulat rupiah, diterima: ${value}`);
  }
}

/** "Rp 12.500" — pemisah ribuan titik, sesuai kebiasaan Indonesia. */
export function formatRupiah(value: Rupiah, opts: { withPrefix?: boolean } = {}): string {
  const { withPrefix = true } = opts;
  const negative = value < 0;
  const digits = Math.abs(Math.trunc(value)).toString();

  let grouped = '';
  for (let i = 0; i < digits.length; i++) {
    const fromRight = digits.length - i;
    grouped += digits[i];
    if (fromRight > 1 && fromRight % 3 === 1) grouped += '.';
  }

  return `${negative ? '-' : ''}${withPrefix ? 'Rp ' : ''}${grouped}`;
}

/**
 * Membaca angka yang diketik pengguna: "12.500", "12500", "Rp 12.500", "12,5rb".
 * Mengembalikan null kalau tidak bisa dibaca — pemanggil yang memutuskan cara
 * menampilkan kesalahannya.
 */
export function parseRupiah(input: string): Rupiah | null {
  const cleaned = input.trim().toLowerCase().replace(/^rp\s*/, '');
  if (cleaned === '') return null;

  const suffix = /(rb|ribu|k|jt|juta)$/.exec(cleaned);
  const multiplier = suffix ? (suffix[1]!.startsWith('j') ? 1_000_000 : 1_000) : 1;
  const body = suffix ? cleaned.slice(0, -suffix[1]!.length).trim() : cleaned;

  // Titik dipakai sebagai pemisah ribuan, koma sebagai desimal.
  const normalised = body.replace(/\./g, '').replace(',', '.');
  if (!/^\d*(\.\d+)?$/.test(normalised) || normalised === '' || normalised === '.') return null;

  const value = Number(normalised) * multiplier;
  if (!Number.isFinite(value)) return null;

  return Math.round(value);
}

import * as Crypto from 'expo-crypto';

/**
 * Id dibuat di HP, bukan di server.
 *
 * Ini syarat agar aplikasi bisa dipakai tanpa sinyal: sebuah pengeluaran harus
 * punya id begitu tombol simpan ditekan, bukan nanti ketika server sempat
 * menjawab. Id yang dibuat di HP juga yang membuat pengiriman ulang aman —
 * operasi dengan id sama hanya berlaku sekali, berapa kali pun ia terkirim.
 */
export function newId(): string {
  return Crypto.randomUUID();
}

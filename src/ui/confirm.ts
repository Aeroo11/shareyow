/**
 * Dialog konfirmasi untuk HP.
 *
 * Ada berkas kembarannya, `confirm.web.ts`, yang dipakai Metro saat membangun
 * untuk browser. Pemisahan ini bukan gaya-gayaan: React Native Web tidak pernah
 * mengimplementasikan `Alert`, jadi di browser `Alert` bernilai undefined dan
 * `Alert.alert(...)` melempar TypeError — bukan sekadar diam tidak melakukan
 * apa-apa. Memanggilnya langsung dari layar akan membuat tombol Hapus dan
 * "Tandai sudah dibayar" mematikan aplikasi begitu ditekan di web.
 *
 * Bentuk Promise dipilih supaya pemanggil menuliskannya lurus dari atas ke
 * bawah, bukan lewat callback bersarang.
 */

import { Alert } from 'react-native';
import type { ConfirmOptions } from './confirm.types';

export function confirm(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      options.title,
      options.message,
      [
        {
          text: options.cancelLabel ?? 'Batal',
          style: 'cancel',
          onPress: () => resolve(false),
        },
        {
          text: options.confirmLabel ?? 'Lanjutkan',
          style: options.destructive ? 'destructive' : 'default',
          onPress: () => resolve(true),
        },
      ],
      // Menutup dialog dengan mengetuk di luar juga berarti membatalkan. Tanpa
      // ini, Promise-nya menggantung selamanya dan aksi berikutnya ikut macet.
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

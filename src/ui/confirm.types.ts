export interface ConfirmOptions {
  title: string;
  message?: string;
  /** Teks tombol yang meneruskan aksi. */
  confirmLabel?: string;
  cancelLabel?: string;
  /** Menandai aksi yang tidak bisa dibatalkan — iOS mewarnainya merah. */
  destructive?: boolean;
}

/** Mengembalikan true kalau pengguna meneruskan, false kalau membatalkan. */
export type Confirm = (options: ConfirmOptions) => Promise<boolean>;

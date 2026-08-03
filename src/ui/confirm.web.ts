/**
 * Versi browser dari confirm(). Metro memilih berkas ini secara otomatis untuk
 * platform web karena akhiran `.web.ts`; layar yang memanggilnya tidak perlu
 * tahu sedang berjalan di mana.
 */

import type { ConfirmOptions } from './confirm.types';

export function confirm(options: ConfirmOptions): Promise<boolean> {
  const text = options.message ? `${options.title}\n\n${options.message}` : options.title;
  return Promise.resolve(window.confirm(text));
}

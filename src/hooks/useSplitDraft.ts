/**
 * Keadaan sementara editor pembagian, sebelum ia menjadi sebuah operasi.
 *
 * Berkas ini sengaja tipis. Seluruh aturan pembagian ada di `core/split.ts`, dan
 * penerjemahan "apa yang sedang diketik" menjadi pembagian yang sah ada di
 * `core/splitDraft.ts` — keduanya murni dan bisa diuji tanpa merender apa pun.
 * Yang tersisa di sini hanya urusan React: menyimpan draf dan menghitung ulang
 * saat draf berubah.
 */

import { useMemo, useState } from 'react';

import type { Rupiah } from '../core/money';
import { computeShares, type MemberId, type Share, type SplitMode } from '../core/split';
import { buildMode, emptyDraft, type SplitDraft, type SplitKind } from '../core/splitDraft';

export { SPLIT_KINDS, draftFrom, emptyDraft } from '../core/splitDraft';
export type { SplitDraft, SplitKind } from '../core/splitDraft';

export interface SplitResult {
  draft: SplitDraft;
  participants: MemberId[];
  /** Terisi hanya kalau draf sudah bisa diterjemahkan menjadi pembagian yang sah. */
  mode: SplitMode | null;
  shares: Share[] | null;
  /** Panduan mengisi untuk pengguna — bukan pesan kesalahan program. */
  problem: string | null;

  setKind: (kind: SplitKind) => void;
  toggleMember: (id: MemberId) => void;
  setExact: (id: MemberId, text: string) => void;
  setPercent: (id: MemberId, text: string) => void;
  setShare: (id: MemberId, value: number) => void;
}

export function useSplitDraft(
  allMemberIds: MemberId[],
  total: Rupiah | null,
  /** Id pengeluaran — menentukan siapa kebagian sisa rupiah. Wajib sama dengan yang disimpan. */
  seed: string,
  initial?: SplitDraft,
): SplitResult {
  const [draft, setDraft] = useState<SplitDraft>(() => initial ?? emptyDraft());

  const participants = useMemo(
    () => allMemberIds.filter((id) => !draft.excluded.has(id)),
    [allMemberIds, draft.excluded],
  );

  const { mode, shares, problem } = useMemo(() => {
    if (participants.length === 0) {
      return { mode: null, shares: null, problem: 'Pilih minimal satu orang.' };
    }
    // Nominal belum diisi bukan kesalahan — jangan menegur orang yang baru mulai.
    if (total === null || total <= 0) {
      return { mode: null, shares: null, problem: null };
    }

    const built = buildMode(draft, participants, total);
    if ('problem' in built) return { mode: null, shares: null, problem: built.problem };

    try {
      return {
        mode: built.mode,
        shares: computeShares(total, participants, built.mode, seed),
        problem: null,
      };
    } catch (e) {
      // Jaring pengaman. Kalau ini pernah muncul, ada kasus yang lolos dari
      // buildMode dan pesannya perlu dibuat lebih manusiawi di sana.
      return { mode: null, shares: null, problem: e instanceof Error ? e.message : String(e) };
    }
  }, [draft, participants, total, seed]);

  return {
    draft,
    participants,
    mode,
    shares,
    problem,
    setKind: (kind) => setDraft((d) => ({ ...d, kind })),
    toggleMember: (id) =>
      setDraft((d) => {
        const excluded = new Set(d.excluded);
        if (excluded.has(id)) excluded.delete(id);
        else excluded.add(id);
        return { ...d, excluded };
      }),
    setExact: (id, text) => setDraft((d) => ({ ...d, exact: { ...d.exact, [id]: text } })),
    setPercent: (id, text) => setDraft((d) => ({ ...d, percent: { ...d.percent, [id]: text } })),
    setShare: (id, value) =>
      setDraft((d) => ({ ...d, shares: { ...d.shares, [id]: Math.max(0, value) } })),
  };
}

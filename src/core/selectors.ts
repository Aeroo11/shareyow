/**
 * Turunan dari GroupState yang dipakai layar. Semuanya fungsi murni, sehingga
 * angka di layar tidak pernah berasal dari tempat lain selain log operasi.
 */

import { computeBalances, type Balances } from './balance';
import type { Rupiah } from './money';
import { activeExpenses, activeMembers, activeSettlements, type GroupState } from './ops';
import { settleUp, type Transfer } from './settle';
import type { MemberId } from './split';

export function balancesOf(state: GroupState): Balances {
  return computeBalances(
    activeMembers(state).map((m) => m.id),
    activeExpenses(state),
    activeSettlements(state),
  );
}

export function transfersOf(state: GroupState): Transfer[] {
  return settleUp(balancesOf(state));
}

export function totalSpend(state: GroupState): Rupiah {
  return activeExpenses(state).reduce((sum, e) => sum + e.total, 0);
}

export function displayName(state: GroupState, memberId: MemberId): string {
  return state.members.get(memberId)?.displayName ?? 'Anggota tak dikenal';
}

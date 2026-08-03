import { perspectiveOf } from '../core/balance';
import type { Rupiah } from '../core/money';
import type { GroupState } from '../core/ops';
import { activeMembers } from '../core/ops';
import { balancesOf, totalSpend } from '../core/selectors';
import { useDbQuery } from '../db/live';
import { getAllIdentities, loadAllGroups, loadGroup, getIdentity } from '../db/repository';

export interface GroupSummary {
  state: GroupState;
  myMemberId: string | null;
  memberCount: number;
  total: Rupiah;
  /** Dari sudut pandangmu: berapa yang kamu tagih dan berapa yang kamu utang. */
  owes: Rupiah;
  isOwed: Rupiah;
}

export function useGroups() {
  return useDbQuery<GroupSummary[]>(async (db) => {
    const [groups, identities] = await Promise.all([loadAllGroups(db), getAllIdentities(db)]);

    return groups.map((state) => {
      const myMemberId = identities.get(state.id) ?? null;
      const perspective = myMemberId
        ? perspectiveOf(balancesOf(state), myMemberId)
        : { owes: 0, isOwed: 0, net: 0 };

      return {
        state,
        myMemberId,
        memberCount: activeMembers(state).length,
        total: totalSpend(state),
        owes: perspective.owes,
        isOwed: perspective.isOwed,
      };
    });
  }, []);
}

export interface LoadedGroup {
  state: GroupState;
  myMemberId: string | null;
}

export function useGroup(groupId: string) {
  return useDbQuery<LoadedGroup | null>(
    async (db) => {
      const state = await loadGroup(db, groupId);
      if (!state) return null;
      return { state, myMemberId: await getIdentity(db, groupId) };
    },
    [groupId],
  );
}

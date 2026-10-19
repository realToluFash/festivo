/** The chips on Settings > Members (sc-67). `invited` lists invitations, which are not memberships. */
export type MemberFilter = 'all' | 'active' | 'invited' | 'waiting' | 'suspended' | 'former';

export type MemberState = 'pending_approval' | 'active' | 'suspended' | 'left_or_removed';

export type JoinChannel =
  'invitation' | 'self_created' | 'join_code' | 'domain' | 'request' | 'directory' | 'settings';

/** Whether a membership in `status` is listed under `filter`; former members are only under Former. */
export function memberIsShown(status: MemberState, filter: MemberFilter): boolean {
  switch (filter) {
    case 'all':
      return status !== 'left_or_removed';
    case 'active':
      return status === 'active';
    case 'waiting':
      return status === 'pending_approval';
    case 'suspended':
      return status === 'suspended';
    case 'former':
      return status === 'left_or_removed';
    case 'invited':
      return false;
  }
}

export interface HistoryStep {
  from: MemberState | null;
  to: MemberState;
  channel: JoinChannel;
  /** The user id of whoever caused it, or null once that account is gone. */
  by: string | null;
}

/** Leaving and being removed share a state: the member causing it is what makes it Left. */
export function historyLine(step: HistoryStep, member: string): { key: string; named: boolean } {
  if (step.to === 'left_or_removed') {
    return step.by === member ? { key: 'left', named: false } : { key: 'removed', named: true };
  }

  if (step.to === 'suspended') return { key: 'suspended', named: true };
  if (step.from === 'suspended') return { key: 'restored', named: true };
  if (step.from === 'pending_approval') return { key: 'approved', named: true };
  if (step.to === 'pending_approval') return { key: `asked.${step.channel}`, named: false };

  return { key: `joined.${step.channel}`, named: false };
}

/** What a member's page offers: sc-68's rules, read from the list the screen loaded, and checked again by the API. */
export type MemberStanding = 'self' | 'onlyOwner' | 'ownerOnly' | 'readOnly' | 'manageable';

interface StandingMember {
  self: boolean;
  status: MemberState;
  role: { seededAs: string | null };
}

export function memberStanding(
  member: StandingMember,
  members: readonly StandingMember[],
  caller: { owns: boolean; manages: boolean },
): MemberStanding {
  const owner = member.role.seededAs === 'owner';
  const activeOwners = members.filter(
    (one) => one.status === 'active' && one.role.seededAs === 'owner',
  ).length;

  if (member.self) return 'self';
  if (owner && member.status === 'active' && activeOwners === 1) return 'onlyOwner';
  if (!caller.manages) return 'readOnly';
  if (owner && !caller.owns) return 'ownerOnly';

  return 'manageable';
}

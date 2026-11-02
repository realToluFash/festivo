import { roleName } from './organisations.ts';

/** The chips on Settings > Members (sc-67). `invited` lists invitations, which are not memberships. */
export type MemberFilter = 'all' | 'active' | 'invited' | 'waiting' | 'suspended' | 'former';

export type MemberState = 'pending_approval' | 'active' | 'suspended' | 'left_or_removed';

export type JoinChannel =
  'invitation' | 'self_created' | 'join_code' | 'domain' | 'request' | 'directory' | 'settings';

/** Whether `status` is listed under `filter`: former members only under Former, and nobody awaiting approval under All (sc-392). */
export function memberIsShown(status: MemberState, filter: MemberFilter): boolean {
  switch (filter) {
    case 'all':
      return status === 'active' || status === 'suspended';
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
    if (step.by === member) return { key: 'left', named: false };
    if (step.from === 'pending_approval') {
      return step.by == null
        ? { key: 'requestExpired', named: false }
        : { key: 'turnedDown', named: true };
    }

    return { key: 'removed', named: true };
  }

  // Decided 23 Oct (sc-564): nobody performs a domain suspension, whatever triggered it.
  if (step.to === 'suspended') {
    return step.channel === 'domain'
      ? { key: 'suspendedAddressGone', named: false }
      : { key: 'suspended', named: true };
  }
  if (step.from === 'suspended') return { key: 'restored', named: true };
  if (step.from === 'pending_approval' && step.channel !== 'invitation') {
    return { key: 'approved', named: true };
  }
  if (step.to === 'pending_approval') return { key: `asked.${step.channel}`, named: false };

  return { key: `joined.${step.channel}`, named: false };
}

/** What a member's page offers: sc-68's rules, read from the list the screen loaded, and checked again by the API. */
export type MemberStanding =
  | 'self'
  | 'selfOwner'
  | 'onlyOwner'
  | 'suspendedOnlyOwner'
  | 'ownerOnly'
  | 'beyondGrant'
  | 'readOnly'
  | 'manageable';

/** sc-13631: on your own page, only an owner is pointed on to hand ownership over. */
export function ownRoleLine(standing: 'self' | 'selfOwner'): {
  key: 'ownRole' | 'ownRoleOwnerCan';
  handsOn: boolean;
} {
  return standing === 'selfOwner'
    ? { key: 'ownRole', handsOn: true }
    : { key: 'ownRoleOwnerCan', handsOn: false };
}

interface StandingMember {
  self: boolean;
  status: MemberState;
  role: { id: string; seededAs: string | null };
  suspension?: { onlyOwner: boolean } | null;
}

export function memberStanding(
  member: StandingMember,
  members: readonly StandingMember[],
  caller: { owns: boolean; manages: boolean; withholds: readonly { id: string }[] },
): MemberStanding {
  const owner = member.role.seededAs === 'owner';
  const activeOwners = members.filter(
    (one) => one.status === 'active' && one.role.seededAs === 'owner',
  ).length;

  if (member.self) return owner ? 'selfOwner' : 'self';
  if (member.status === 'left_or_removed') return 'readOnly';
  if (owner && member.status === 'active' && activeOwners === 1) return 'onlyOwner';
  if (!caller.manages) return 'readOnly';
  // Decided 23 Oct (sc-564): nobody else could restore them, so members.manage may.
  if (owner && member.suspension?.onlyOwner === true) return 'suspendedOnlyOwner';
  if (owner && !caller.owns) return 'ownerOnly';
  // sc-11160: the rule the role choices follow (sc-392). A role the loaded catalogue lacks falls to the picker and the API's answer.
  if (
    !caller.owns &&
    member.status !== 'pending_approval' &&
    caller.withholds.some((role) => role.id === member.role.id)
  )
    return 'beyondGrant';

  return 'manageable';
}

type Word = (key: string, values: Record<string, string>) => string;

/** What a member's row says, on the web and in the app alike. */
interface RowMember {
  status: MemberState;
  former: 'left' | 'removed' | null;
  channel: JoinChannel | null;
  since: string | null;
  invitedBy: { name: string } | null;
  self: boolean;
  role: { seededAs: string | null; name: string | null };
  suspension?: { reason: string } | null;
  history: readonly { from: MemberState | null; to: MemberState }[];
}

/** Awaiting approval, or turned down, withdrawn or expired while awaiting it: Read-only is only where a request is parked (sc-7217). */
export function memberHeldNoRole(member: Pick<RowMember, 'status' | 'history'>): boolean {
  if (member.status === 'pending_approval') return true;
  const last = member.history.at(-1);

  return (
    member.status === 'left_or_removed' &&
    last?.from === 'pending_approval' &&
    last.to === 'left_or_removed'
  );
}

export function memberStatusWord(word: Word, member: RowMember): string {
  if (member.status === 'left_or_removed')
    return word(`membersScreen.state.${member.former ?? 'removed'}`, {});

  if (
    member.status === 'suspended' &&
    member.suspension != null &&
    member.suspension.reason !== 'manual'
  )
    return word('membersScreen.state.domainSuspended', {});

  return word(`membersScreen.state.${member.status}`, {});
}

export function memberChannelWords(word: Word, member: RowMember, organisation: string): string {
  if (member.channel === 'invitation' && member.invitedBy != null) {
    return word('membersScreen.how.invitationFrom', { inviter: member.invitedBy.name });
  }

  return word(`membersScreen.how.${member.channel ?? 'invitation'}`, { organisation });
}

export type MemberRowVerb = 'since' | 'asked' | 'suspended' | 'left' | 'removed';

export function memberRowVerb(member: RowMember): MemberRowVerb {
  switch (member.status) {
    case 'pending_approval':
      return 'asked';
    case 'suspended':
      return 'suspended';
    case 'left_or_removed':
      return member.former ?? 'removed';
    case 'active':
      return 'since';
  }
}

export function memberRowLine(
  word: Word,
  member: RowMember,
  organisation: string,
  day: (at: string) => string,
): string {
  return [
    memberHeldNoRole(member)
      ? word('membersScreen.noRoleYet', {})
      : roleName((key) => word(key, {}), member.role),
    ...(member.self ? [word('membersScreen.you', {})] : []),
    memberChannelWords(word, member, organisation),
    word(`membersScreen.when.${memberRowVerb(member)}`, {
      date: member.since == null ? '' : day(member.since),
    }),
  ].join(' · ');
}

/** The roles somebody awaiting approval can be approved into: never Owner (sc-68), and Read-only first, least privilege. */
export function approvalRoles<Role extends { seededAs: string | null }>(
  roles: readonly Role[],
): Role[] {
  const offered = roles.filter((role) => role.seededAs !== 'owner');

  return [
    ...offered.filter((role) => role.seededAs === 'read_only'),
    ...offered.filter((role) => role.seededAs !== 'read_only'),
  ];
}

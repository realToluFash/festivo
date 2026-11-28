import {
  MEMBERS_SHOWN,
  type MemberRole,
  type MembersList,
  type OrganisationMember,
} from '@soirely/api-client';
import { memberIsShown } from '@soirely/domain';

/** The list after a write that landed: read again, or, when that read fails, the write applied to the rows and counts held. */
export async function membersAfterWrite(
  read: () => Promise<MembersList>,
  list: MembersList,
  landed: (member: OrganisationMember) => OrganisationMember,
): Promise<MembersList> {
  try {
    return await read();
  } catch {
    return landedIn(list, landed);
  }
}

function landedIn(
  list: MembersList,
  landed: (member: OrganisationMember) => OrganisationMember,
): MembersList {
  const before = [...list.members, ...list.waiting, ...list.faces].find(
    (one) => landed(one) !== one,
  );
  if (before == null) return list;
  const after = landed(before);
  const counts = { ...list.counts };
  for (const show of MEMBERS_SHOWN) {
    counts[show] +=
      Number(memberIsShown(after.status, show)) - Number(memberIsShown(before.status, show));
  }
  const owns = (one: OrganisationMember) =>
    one.status === 'active' && one.role.seededAs === 'owner';

  return {
    ...list,
    members: list.members.map(landed),
    faces: list.faces.map(landed),
    waiting: list.waiting.map(landed).filter((one) => one.status === 'pending_approval'),
    counts,
    owners: list.owners + Number(owns(after)) - Number(owns(before)),
  };
}

export function withRole(memberId: string, role: MemberRole) {
  return (member: OrganisationMember): OrganisationMember =>
    member.id === memberId
      ? { ...member, role: { id: role.id, seededAs: role.seededAs, name: role.name } }
      : member;
}

export function withRemoved(memberId: string) {
  return (member: OrganisationMember): OrganisationMember =>
    member.id === memberId ? { ...member, status: 'left_or_removed', former: 'removed' } : member;
}

export function withRestored(memberId: string) {
  return (member: OrganisationMember): OrganisationMember =>
    member.id === memberId ? { ...member, status: 'active', suspension: null } : member;
}

/** Somebody awaiting approval (sc-392), approved into a role or turned down, while the list could not be read again. */
export function withApproved(memberId: string, role: MemberRole) {
  return (member: OrganisationMember): OrganisationMember =>
    member.id === memberId
      ? { ...withRole(memberId, role)(member), status: 'active', removesAt: null }
      : member;
}

export function withTurnedDown(memberId: string) {
  return (member: OrganisationMember): OrganisationMember =>
    member.id === memberId ? { ...withRemoved(memberId)(member), removesAt: null } : member;
}

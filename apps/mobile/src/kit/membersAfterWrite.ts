import type { MemberRole, MembersList, OrganisationMember } from '@soirely/api-client';

/** The list after a write that landed: read again, or, when that read fails, the write applied to the list held. */
export async function membersAfterWrite(
  read: () => Promise<MembersList>,
  list: MembersList,
  landed: (member: OrganisationMember) => OrganisationMember,
): Promise<MembersList> {
  try {
    return await read();
  } catch {
    return { ...list, members: list.members.map(landed) };
  }
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

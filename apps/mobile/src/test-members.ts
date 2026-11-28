import {
  MEMBERS_SHOWN,
  type MembersList,
  type MembersShow,
  type OrganisationMember,
} from '@soirely/api-client';
import { memberIsShown } from '@soirely/domain';

/** A whole organisation's members as a test writes them, read as MembersController answers under `show`, every row on one page (sc-49170). */
export function membersListOf(
  people: readonly OrganisationMember[],
  show: MembersShow = 'all',
): MembersList {
  const under = (option: MembersShow) => people.filter((one) => memberIsShown(one.status, option));

  return {
    members: under(show),
    next: null,
    counts: Object.fromEntries(
      MEMBERS_SHOWN.map((option) => [option, under(option).length]),
    ) as Record<MembersShow, number>,
    owners: under('active').filter((one) => one.role.seededAs === 'owner').length,
    faces: under('all').slice(0, 5),
    waiting: under('waiting'),
    invitations: [],
  };
}

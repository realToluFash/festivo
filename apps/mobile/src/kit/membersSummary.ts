import type { OrganisationMember, OwnerClaimBanner } from '@soirely/api-client';
import {
  initials,
  type MemberFilter,
  memberHeldNoRole,
  memberIsShown,
  memberStatusWord,
  ownerClaimView,
  roleName,
} from '@soirely/domain';
import type { TFunction } from 'i18next';

import type { MarkKind } from '../components/StatusMark.tsx';
import { toneOf } from './personFace.ts';

/** The app lists memberships and does not invite, so it has no Invited and no Waiting filter. */
export type MembersFilter = Extract<MemberFilter, 'all' | 'active' | 'suspended' | 'former'>;

export const MEMBERS_FILTERS: readonly MembersFilter[] = ['all', 'active', 'suspended', 'former'];

export function membersShown(
  members: readonly OrganisationMember[],
  filter: MembersFilter,
): OrganisationMember[] {
  return members.filter((member) => memberIsShown(member.status, filter));
}

export function membersCounts(
  members: readonly OrganisationMember[],
): Record<MembersFilter, number> {
  const count = (filter: MembersFilter) => membersShown(members, filter).length;

  return {
    all: count('all'),
    active: count('active'),
    suspended: count('suspended'),
    former: count('former'),
  };
}

export function waitingToJoin(members: readonly OrganisationMember[]): OrganisationMember[] {
  return members.filter((member) => member.status === 'pending_approval');
}

export interface MemberFace {
  initials: string;
  tone: number;
}

export function faceOf(member: OrganisationMember): MemberFace {
  return { initials: initials(member.user.name), tone: toneOf(member.user.id) };
}

export function memberRole(t: TFunction, member: OrganisationMember): string {
  return memberHeldNoRole(member) ? t('membersScreen.noRoleYet') : roleName(t, member.role);
}

const MARKS: Record<OrganisationMember['status'], MarkKind> = {
  active: 'yes',
  pending_approval: 'waiting',
  suspended: 'paused',
  left_or_removed: 'ended',
};

export function memberMark(member: OrganisationMember): MarkKind {
  return MARKS[member.status];
}

/** A tag only where a state is not the rule: an active member has none. */
export function memberTag(
  t: TFunction,
  member: OrganisationMember,
): { kind: MarkKind; word: string } | null {
  return member.status === 'active'
    ? null
    : { kind: memberMark(member), word: memberStatusWord(t, member) };
}

export function memberLine(t: TFunction, member: OrganisationMember): string {
  return [memberRole(t, member), ...(member.self ? [t('membersScreen.you')] : [])].join(' · ');
}

export function waitingLine(
  t: TFunction,
  member: OrganisationMember,
  day: (at: string) => string,
): string {
  return t('membersScreen.waitingLine', {
    email: member.user.email ?? '',
    date: member.since == null ? '' : day(member.since),
  });
}

/** What a row's date means on a person's page: when they joined, asked, were suspended or left. */
export function whenKey(member: OrganisationMember): string {
  switch (member.status) {
    case 'active':
      return 'membersScreen.whenWord.since';
    case 'pending_approval':
      return 'membersScreen.whenWord.asked';
    case 'suspended':
      return 'membersScreen.whenWord.suspended';
    case 'left_or_removed':
      return `membersScreen.whenWord.${member.former ?? 'removed'}`;
  }
}

/** What the page did last, kept on the card until the person moves on. */
export type MembersSaid =
  | { kind: 'approved'; member: string; name: string; role: string }
  | { kind: 'turnedDown'; name: string }
  | { kind: 'removed'; name: string }
  | { kind: 'withdrew'; told: boolean };

export type MembersStep =
  | { does: 'answer'; member: string }
  | { does: 'seePerson'; member: string }
  | { does: 'seeFormer' }
  | { does: 'becomeOwner' }
  | { does: 'checkRecord' };

export interface MembersCard {
  says: string;
  line: string | null;
  step: { label: string; does: MembersStep } | null;
  faces: MemberFace[];
  more: number;
  /** Said as it changes: an answer, a removal or a withdrawn claim, never the plain count. */
  readsOut: boolean;
}

/** The card's one step at rest: the oldest request to join the viewer can answer. */
function answerStep(t: TFunction, waiting: readonly OrganisationMember[]): MembersCard['step'] {
  const first = waiting[0];

  return first == null
    ? null
    : {
        label: t('membersScreen.card.answer', { name: first.user.name }),
        does: { does: 'answer', member: first.id },
      };
}

/** The card while no owner is active, in the words of the demo's claim states (sc-37693). */
function claimCard(
  t: TFunction,
  banner: OwnerClaimBanner,
  organisation: string,
  become: MembersCard['step'],
): Pick<MembersCard, 'says' | 'line' | 'step'> {
  const { claim, stopped, lapsed } = banner;
  const keepsWorking = t('ownerClaim.keepsWorking');

  if (banner.state === 'closed')
    return stopped?.mine === true
      ? {
          says: t('ownerClaim.stoppedTitle', { claimant: stopped.claimant }),
          line: t('ownerClaim.stoppedLine', { organisation }),
          step: null,
        }
      : {
          says: t('ownerClaim.noOwner', { organisation }),
          line: `${t('ownerClaim.closedLine')} ${keepsWorking}`,
          step: null,
        };

  if (claim == null) {
    const why =
      lapsed == null
        ? []
        : [
            lapsed.outcome === 'record_removed'
              ? t('ownerClaim.recordRemoved')
              : t('ownerClaim.lapsed', { when: lapsed.at.written }),
          ];

    return {
      says: t('ownerClaim.noOwner', { organisation }),
      line: [...why, keepsWorking].join(' '),
      step: become,
    };
  }

  const claimant = claim.claimant.name;
  if (!claim.mine)
    return {
      says: t('ownerClaim.becomingTitle', { claimant }),
      line:
        claim.passesAt == null
          ? t('ownerClaim.theirsUnfound', { when: claim.lapsesAt.written })
          : t('ownerClaim.theirsFound', { when: claim.passesAt.written }),
      step: null,
    };

  return claim.passesAt == null
    ? {
        says: t('ownerClaim.claimOpen'),
        line: t('ownerClaim.checkEvery', { when: claim.lapsesAt.written }),
        step: { label: t('ownerClaim.check'), does: { does: 'checkRecord' } },
      }
    : {
        says: t('ownerClaim.found'),
        line: t('ownerClaim.passesToYou', { when: claim.passesAt.written }),
        step: null,
      };
}

/** How Members stands, summary first (sc-29710): an answer or a removal just made, an owner claim, or the headcount. */
export function membersCard({
  t,
  members,
  manages,
  organisation,
  said,
  claim,
}: {
  t: TFunction;
  members: readonly OrganisationMember[];
  manages: boolean;
  organisation: string;
  said: MembersSaid | null;
  claim: OwnerClaimBanner | null;
}): MembersCard {
  const quiet = { line: null, faces: [], more: 0, readsOut: true };
  const waiting = manages ? waitingToJoin(members) : [];
  const answer = answerStep(t, waiting);
  const seeFormer = {
    label: t('membersScreen.awaiting.turnedDownNext'),
    does: { does: 'seeFormer' },
  } as const;
  const become = {
    label: t('ownerClaim.become'),
    does: { does: 'becomeOwner' },
  } as const;

  if (said?.kind === 'approved')
    return {
      ...quiet,
      says: t('membersScreen.card.joined', { name: said.name, role: said.role }),
      step: {
        label: t('membersScreen.awaiting.approvedNext', { name: said.name }),
        does: { does: 'seePerson', member: said.member },
      },
    };
  if (said?.kind === 'turnedDown')
    return {
      ...quiet,
      says: t('membersScreen.card.turnedDown', { name: said.name }),
      line: t('membersScreen.card.turnedDownLine'),
      step: seeFormer,
    };
  if (said?.kind === 'removed')
    return {
      ...quiet,
      says: t('membersScreen.card.removed', { name: said.name }),
      line: t('membersScreen.card.removedLine', { organisation }),
      step: answer ?? seeFormer,
    };
  if (said?.kind === 'withdrew')
    return {
      ...quiet,
      says: t('ownerClaim.withdrewCard'),
      line: said.told ? t('ownerClaim.everybodyEmailed') : null,
      step: claim != null && ownerClaimView(claim, organisation).become ? become : null,
    };

  if (claim != null)
    return { ...quiet, ...claimCard(t, claim, organisation, become), readsOut: false };

  const all = membersShown(members, 'all');
  const faces = all.slice(0, 5).map(faceOf);
  const headcount = t('membersScreen.card.people', { count: all.length });

  return {
    says:
      waiting.length > 0
        ? t('membersScreen.card.peopleWaiting', {
            people: headcount,
            waiting: t('membersScreen.card.waiting', { count: waiting.length }),
          })
        : headcount,
    line: null,
    step: answer,
    faces,
    more: all.length - faces.length,
    readsOut: false,
  };
}

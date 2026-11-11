import type { TFunction } from 'i18next';
import type {
  MembersList,
  OrganisationMember,
  OwnerClaimBanner,
  RecoveryRequest,
} from '@soirely/api-client';
import {
  OWNER_CLAIM_KEEPS_WORKING,
  type OwnerClaimLine,
  memberIsShown,
  ownerClaimView,
} from '@soirely/domain';

type Word = TFunction;

export type RecoveryAnswer = 'approve' | 'turnDown';

/** The requests Members shows: those of this organisation's members, oldest first, as the API sends them (sc-30189). */
export function recoveriesIn(
  requests: readonly RecoveryRequest[],
  organisationId: string,
): RecoveryRequest[] {
  return requests.filter((request) => request.organisationIds.includes(organisationId));
}

/** What the last answer on Members came to, said on its card until something else happens. */
export type Notice =
  | { kind: 'sent'; email: string }
  | { kind: 'approved'; member: string; role: string }
  | { kind: 'turnedDown'; name: string }
  | { kind: 'removed'; name: string }
  | { kind: 'recovered'; name: string; answer: RecoveryAnswer };

export type CardStep =
  | { label: string; does: 'answer' | 'see'; member: string }
  | { label: string; does: 'recover'; request: string }
  | { label: string; does: 'former' | 'become' | 'check' };

/** The owner claim as Members holds it: the API's banner, and whether the viewer has just withdrawn theirs. */
export interface ClaimOnCard {
  banner: OwnerClaimBanner;
  withdrew: { told: boolean } | null;
}

export interface MembersCard {
  says: string;
  lines: string[];
  step: CardStep | null;
  faces: OrganisationMember[];
  more: number;
}

const FACES = 5;

export function waitingMembers(list: MembersList, manages: boolean): OrganisationMember[] {
  return manages ? list.members.filter((one) => one.status === 'pending_approval') : [];
}

/** The requests to get back in this viewer can answer: never their own (sc-30189). */
export function answerableRecoveries(recoveries: readonly RecoveryRequest[]): RecoveryRequest[] {
  return recoveries.filter((one) => !one.own);
}

/** The one thing to do next: the oldest request to get back in, since its asker is locked out, then the oldest request to join. */
function firstStep(
  list: MembersList,
  recoveries: readonly RecoveryRequest[],
  manages: boolean,
  t: Word,
): CardStep | null {
  const recovery = manages ? answerableRecoveries(recoveries)[0] : undefined;
  const asking = waitingMembers(list, manages)[0];

  if (recovery != null)
    return {
      label: t('membersScreen.card.answer', { name: recovery.name }),
      does: 'recover',
      request: recovery.id,
    };

  return asking == null
    ? null
    : {
        label: t('membersScreen.card.answer', { name: asking.user.name }),
        does: 'answer',
        member: asking.id,
      };
}

/** Members' summary card (sc-29708): how things stand, or what the last answer came to, and its one step. */
export function membersCard({
  list,
  recoveries = [],
  manages,
  notice,
  claim = null,
  organisation,
  t,
}: {
  list: MembersList;
  /** This organisation's requests to get back in, oldest first. */
  recoveries?: readonly RecoveryRequest[];
  manages: boolean;
  notice: Notice | null;
  claim?: ClaimOnCard | null;
  organisation: string;
  t: Word;
}): MembersCard {
  const quiet = { lines: [], step: null, faces: [], more: 0 };
  const seeFormer = { label: t('membersScreen.awaiting.turnedDownNext'), does: 'former' } as const;

  switch (notice?.kind) {
    case 'sent':
      return {
        ...quiet,
        says: t('membersScreen.card.sent', { email: notice.email }),
        lines: [t('membersScreen.invitationsNote')],
      };
    case 'approved': {
      const name = list.members.find((one) => one.id === notice.member)?.user.name ?? '';

      return {
        ...quiet,
        says: t('membersScreen.card.approved', { name, role: notice.role }),
        step: {
          label: t('membersScreen.awaiting.approvedNext', { name }),
          does: 'see',
          member: notice.member,
        },
      };
    }
    case 'turnedDown':
      return {
        ...quiet,
        says: t('membersScreen.card.turnedDown', { name: notice.name }),
        lines: [t('membersScreen.card.turnedDownLine')],
        step: seeFormer,
      };
    case 'removed':
      return {
        ...quiet,
        says: t('membersScreen.card.removed', { name: notice.name }),
        lines: [t('membersScreen.card.removedLine', { organisation })],
        step: firstStep(list, recoveries, manages, t) ?? seeFormer,
      };
    case 'recovered': {
      const approved = notice.answer === 'approve';

      return {
        ...quiet,
        says: t(approved ? 'recoveryRequests.approved' : 'recoveryRequests.turnedDown', {
          name: notice.name,
        }),
        lines: [t(approved ? 'recoveryRequests.approvedNext' : 'recoveryRequests.turnedDownNext')],
        step: firstStep(list, recoveries, manages, t),
      };
    }
    case undefined:
      break;
  }

  if (claim != null) return { ...quiet, ...claimCard(claim, organisation, t) };

  const all = list.members.filter((one) => memberIsShown(one.status, 'all'));
  const join = waitingMembers(list, manages).length;
  const back = manages ? answerableRecoveries(recoveries).length : 0;
  const waiting = back + join;
  const faces = all.slice(0, FACES);

  return {
    says: [
      t('membersScreen.card.people', { count: all.length }),
      ...(waiting > 0 ? [t('membersScreen.card.waiting', { count: waiting })] : []),
    ].join(' · '),
    lines:
      back > 0 && join > 0
        ? [
            t('membersScreen.card.waitingKinds', {
              back: t('membersScreen.card.toGetBackIn', { count: back }),
              join: t('membersScreen.card.toJoin', { count: join }),
            }),
          ]
        : [],
    step: firstStep(list, recoveries, manages, t),
    faces,
    more: all.length - faces.length,
  };
}

/** While no owner is active (sc-6640), the card says where the claim stands, and its step is the claimant's next one. */
function claimCard(
  { banner, withdrew }: ClaimOnCard,
  organisation: string,
  t: Word,
): Pick<MembersCard, 'says' | 'lines' | 'step'> {
  const view = ownerClaimView(banner, organisation);
  const words = (line: OwnerClaimLine) => t(line.key, line.values);
  const become = { label: t('ownerClaim.become'), does: 'become' } as const;

  if (withdrew != null && view.become)
    return {
      says: t('membersScreen.card.withdrew'),
      lines: withdrew.told ? [t('membersScreen.card.withdrewTold')] : [],
      step: become,
    };

  if (view.record && banner.claim != null)
    return {
      says: t('membersScreen.card.claimOpen'),
      lines: [t('ownerClaim.checkEvery', { when: banner.claim.lapsesAt.written })],
      step: { label: t('ownerClaim.check'), does: 'check' },
    };

  // How to become the owner is said in Become the owner's dialog, not on the card.
  const lines = view.lines.filter((line) => line.key !== 'ownerClaim.howTo').map(words);

  return {
    says: words(view.title),
    lines: view.withdraw ? lines : [...lines, words(OWNER_CLAIM_KEEPS_WORKING)],
    step: view.become ? become : null,
  };
}

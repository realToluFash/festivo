import type { OrganisationEvent } from '@soirely/api-client';
import {
  CHOICES,
  type Choice,
  type EventPhase,
  type ReplyWord,
  eventAllows,
  roleHolds,
} from '@soirely/domain';
import type { TFunction } from 'i18next';

import type { InvitationOffer } from '../components/GuestInvitation.tsx';
import type { MarkKind } from '../components/ReplyMark.tsx';
import { type CardTag, type Shown, cardTags } from './eventsList.ts';
import { draftRowOf } from './makeLive.ts';

const MARK: Record<ReplyWord, MarkKind> = {
  coming: 'coming',
  maybe: 'maybe',
  notComing: 'notcoming',
  noReply: 'noreply',
  held: 'held',
  notYetInvited: 'notyet',
  walkIn: 'walkin',
};

export function markOf(reply: ReplyWord): MarkKind {
  return MARK[reply];
}

/** Not yet invited is offered while anyone is, and stays while chosen so the list under the host's finger does not move (sc-46879). */
export function filterChoices(
  counts: Readonly<Record<Choice, number>>,
  chosen: Choice,
): readonly Choice[] {
  return CHOICES.filter(
    (key) => (key !== 'notYetInvited' && key !== 'walkIn') || counts[key] > 0 || key === chosen,
  );
}

export interface PhaseCard {
  tags: CardTag[];
  /** A Draft counts who is on the list, since nobody is invited yet. */
  onList: boolean;
  line: string;
  offersMakeLive: boolean;
}

/** Why nobody can be invited, on the card as the demo's draft, paused and finished draw it: the phase's chip, its line, and on a Draft Make live for someone with events.manage (sc-46879). */
export function phaseCardOf(
  t: TFunction,
  event: OrganisationEvent,
  shown: Shown | null,
  phase: EventPhase | null,
  now: Date,
): PhaseCard | null {
  if (shown == null) return null;
  const tags = cardTags(shown, now, t).filter((tag) => tag.mark != null);

  if (phase === 'draft') {
    const row = draftRowOf(event, now, roleHolds(event, 'events.manage'));

    return row == null
      ? null
      : {
          tags,
          onList: true,
          line: row.line === 'endPassed' ? t('eventLive.endPassed') : t('eventLive.guestsBlocked'),
          offersMakeLive: row.offersMakeLive,
        };
  }
  if (phase !== 'paused' && phase !== 'finished') return null;

  return {
    tags,
    onList: false,
    line: t(phase === 'paused' ? 'guestList.pausedLine' : 'guestList.finishedLine'),
    offersMakeLive: false,
  };
}

/** A guest's Invitation by phase (sc-55558): none on a Draft for those who can't manage guests, Replace link… alone on a Draft for those who can, and Paused's or Finished's reason above the rows. */
export function invitationOfferOf(
  phase: EventPhase | null,
  manages: boolean,
  t: TFunction,
): InvitationOffer | null {
  if (phase === 'draft' && !manages) return null;

  return {
    manages,
    invites: phase != null && eventAllows(phase, 'invite'),
    draft: phase === 'draft',
    notInviting:
      phase === 'paused'
        ? t('guestList.pausedLine')
        : phase === 'finished'
          ? t('guestList.finishedLine')
          : null,
  };
}

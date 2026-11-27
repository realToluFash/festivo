import type { Answer, Visit } from './guest.ts';
import { SAMPLE_PARTY, hasStep } from './guestCompanions.ts';
import type { DemoLink } from './settings.ts';

const EARLIER = '2026-10-20';
const TODAY = '2026-10-27';
const ALONE = { companionsComing: 0 } as const;

function picked(answer: Answer, rest: Partial<Visit> = {}): Partial<Visit> {
  return { view: { kind: 'link', picked: answer, busy: false }, want: 'linkHead', ...rest };
}

/** sc-1291: the guest's page as an answer link in the invitation opens it, the answer already chosen and nothing recorded yet. */
export const GUEST_LINK_STATES = {
  linkNotComing: {
    name: 'Not coming tapped: Confirm, From your message',
    starts: picked('notComing', ALONE),
  },
  linkNotSure: {
    name: 'Not sure yet tapped: Confirm',
    starts: picked('notSure', ALONE),
  },
  linkComingCarryOn: {
    name: 'Coming tapped: Carry on into Who’s coming, the kitchen and Check and send',
    starts: picked('coming', { party: SAMPLE_PARTY }),
  },
  linkComingConfirm: {
    name: 'Coming tapped, no Yes step applies: Confirm, and Yes with no chevron',
    starts: picked('coming', { ...ALONE, yesRecords: true }),
  },
  linkChanged: {
    name: 'Not coming over an earlier Coming: the earlier answer above, Confirm',
    starts: picked('notComing', { ...ALONE, recorded: { answer: 'coming', on: EARLIER } }),
  },
  linkSame: {
    name: 'The answer already given: already down as coming, nothing to confirm',
    starts: picked('coming', { ...ALONE, recorded: { answer: 'coming', on: EARLIER } }),
  },
  linkCompanions: {
    name: 'Not coming, with companions: they won’t be coming either, before Confirm',
    starts: picked('notComing'),
  },
  linkConfirmed: {
    name: 'Confirmed: You’re down as not coming',
    starts: {
      ...ALONE,
      recorded: { answer: 'notComing', on: TODAY },
      view: { kind: 'recorded', same: false, downAs: true },
      want: 'greeting',
    },
  },
  linkNoAnswer: {
    name: 'An answer link with no answer, or not one of the three: nothing chosen, no error',
    starts: {},
  },
} satisfies Record<string, { name: string; starts: Partial<Visit> }>;

export type GuestLinkState = keyof typeof GUEST_LINK_STATES;

export function isGuestLinkState(value: string | null): value is GuestLinkState {
  return value != null && Object.hasOwn(GUEST_LINK_STATES, value);
}

export function guestLinkStarts(state: GuestLinkState): Partial<Visit> {
  return GUEST_LINK_STATES[state].starts as Partial<Visit>;
}

/** The answer a link chose is the one already on the guest's own record: nothing to confirm. */
export function alreadyDown(visit: Pick<Visit, 'recorded'>, answer: Answer): boolean {
  return visit.recorded != null && visit.recorded.by == null && visit.recorded.answer === answer;
}

/** Coming goes on into sc-1439's Yes steps unless none applies; the other two answers record at once. */
export function carriesOn(visit: Pick<Visit, 'yesRecords'>, answer: Answer): boolean {
  return answer === 'coming' && !visit.yesRecords;
}

/** Not coming takes the guest's companions with it, said before Confirm to a guest who has any. */
export function warnsCompanions(
  visit: Pick<Visit, 'party' | 'companionsComing'>,
  answer: Answer,
): boolean {
  return answer === 'notComing' && (hasStep(visit.party) || visit.companionsComing > 0);
}

export const GUEST_LINK_PAGES: readonly { name: string; states: readonly DemoLink[] }[] = [
  {
    name: 'An answer link from the invitation (sc-1291)',
    states: (Object.keys(GUEST_LINK_STATES) as GuestLinkState[]).map((state) => ({
      to: `/demo/guest?state=${state}`,
      name: GUEST_LINK_STATES[state].name,
    })),
  },
];

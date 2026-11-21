import { figure } from './guestsWords.ts';
import { peopleOn, sampleGuests } from './guests.ts';

/** People per event on the demo's Free plan, and the ceiling no plan lifts (sc-3930). */
export const PLAN_PEOPLE = 100;
export const CEILING = 10_000;
const PLAN = 'Free';

/** The copy's refusal as the 403 problem gives it: the people the list would bring, never counted on the screen. */
export type CopyRefused =
  | { type: 'plan_limit_reached'; count: number; limit: number; plan: string }
  | { type: 'event_capacity_reached'; count: number; ceiling: number };

/** The guests the checkbox, the Copied line and the success line count: each once, companions not added (sc-3656). */
export function guestsToCopy(eventId: string): number {
  return sampleGuests(eventId).length;
}

/** What the duplicate endpoint answers a ticked copy with, counting each guest and every companion place (sc-3779). */
export function copyRefusal(eventId: string): CopyRefused | null {
  const count = peopleOn(eventId);

  if (count > CEILING) return { type: 'event_capacity_reached', count, ceiling: CEILING };
  if (count > PLAN_PEOPLE)
    return { type: 'plan_limit_reached', count, limit: PLAN_PEOPLE, plan: PLAN };

  return null;
}

/** State 10's original: walk-ins took it past the ceiling, 9,180 guests with 1,034 companion places. */
export const OVER_CEILING: CopyRefused = {
  type: 'event_capacity_reached',
  count: 10_214,
  ceiling: CEILING,
};

const one = (count: number, single: string, many: string): string => (count === 1 ? single : many);

/** sc-3656's Copy, 21 Oct (l10n), and sc-3930's Worded, 1 Nov, in English. */
export const DW = {
  box: (count: number) =>
    one(
      count,
      `Also copy the guest list (${figure(count)} guest)`,
      `Also copy the guest list (${figure(count)} guests)`,
    ),
  hint: 'Replies are not copied, and nobody is invited or contacted.',
  copiedGuests: (count: number) =>
    one(
      count,
      `${figure(count)} guest: name, contact details and companions`,
      `${figure(count)} guests: names, contact details and companions`,
    ),
  notCopiedGuests:
    'Replies, invitations, invitation links, check-ins, meal choices, seating, messages and history',
  copied: (count: number) =>
    one(
      count,
      `${figure(count)} guest copied. Nobody was invited or contacted.`,
      `${figure(count)} guests copied. Nobody was invited or contacted.`,
    ),
  creating: 'Creating the draft',
  planTitle: (limit: number) =>
    one(
      limit,
      `Your plan allows ${figure(limit)} person per event`,
      `Your plan allows ${figure(limit)} people per event`,
    ),
  ceilingTitle: (ceiling: number) => `An event can hold ${figure(ceiling)} people`,
  overPlan: (count: number, limit: number) =>
    one(
      count,
      `Not created. The guest list would bring ${figure(count)} person, and your plan has room for ${figure(limit)} in a new event.`,
      `Not created. The guest list would bring ${figure(count)} people, and your plan has room for ${figure(limit)} in a new event.`,
    ),
  overCeiling: (count: number, ceiling: number) =>
    `Not created. The guest list would bring ${figure(count)} people, more than the ${figure(ceiling)} an event can hold.`,
  figurePlan: (count: number, plan: string) =>
    `${figure(count)} people · companions count as people · ${plan} plan`,
  figureCeiling: (count: number) => `${figure(count)} people · companions count as people`,
  kept: 'The form is kept as you left it.',
  untick: 'To duplicate without guests, untick Also copy the guest list.',
  changePlan: 'Change plan',
  askOwner: 'Ask an owner',
  asked: 'The owners have been sent the link to Compare plans.',
  backToForm: 'Back to the form',
};

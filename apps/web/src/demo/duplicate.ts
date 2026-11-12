import { figure } from './guestsWords.ts';
import { peopleOn, sampleGuests } from './guests.ts';

export type DuplicateState =
  | 'duplicate'
  | 'duplicateTicked'
  | 'duplicateOne'
  | 'duplicateNoGuests'
  | 'duplicateViewer'
  | 'duplicateCreating'
  | 'duplicateCreated'
  | 'duplicateNotCreated'
  | 'duplicateOverLimit'
  | 'duplicateOverLimitAsk'
  | 'duplicateCeiling';

export type Refuse = 'plan' | 'ceiling';
export type DuplicatePhase = 'form' | 'creating' | 'created' | 'failed' | 'refused';

/** What the original brings: its guests not removed, each once and without companions, and the people sc-3779 counts for a refusal. */
export interface Brings {
  guests: number;
  people: number;
}

export interface DuplicateStart {
  /** Null when there is no checkbox: an original with no guests, or a reader without guests.manage. */
  brings: Brings | null;
  ticked: boolean;
  phase: DuplicatePhase;
  /** What the 403 says once Create draft is pressed with the tick, or null when the copy is made. */
  refuse: Refuse | null;
  billing: boolean;
  fails: boolean;
}

export const FREE_PEOPLE = 100;
export const CEILING_PEOPLE = 10_000;

/** sc-3930's event_capacity_reached is met only by an original that walk-ins took past the ceiling; no sample event has, so this is the 403's sample, the board's fixture. */
export const PAST_CEILING: Brings = { guests: 9180, people: 10_214 };

/** The sample list holds only the guests not removed: a removed guest leaves it. */
export function bringsOf(id: string): Brings | null {
  const guests = sampleGuests(id).length;

  return guests === 0 ? null : { guests, people: peopleOn(id) };
}

export function duplicateStateOf(value: string | null): DuplicateState | null {
  return value != null && value.startsWith('duplicate') ? (value as DuplicateState) : null;
}

export function duplicateStart(state: DuplicateState | null, id: string): DuplicateStart {
  const brings = bringsOf(id);
  const start: DuplicateStart = {
    brings,
    ticked: false,
    phase: 'form',
    refuse: null,
    billing: true,
    fails: false,
  };

  switch (state) {
    case 'duplicateTicked':
      return { ...start, ticked: true };
    case 'duplicateOne':
      return { ...start, brings: brings == null ? null : { guests: 1, people: 1 } };
    case 'duplicateViewer':
      return { ...start, brings: null };
    case 'duplicateCreating':
      return { ...start, ticked: true, phase: 'creating' };
    case 'duplicateCreated':
      return { ...start, ticked: true, phase: 'created' };
    case 'duplicateNotCreated':
      return { ...start, ticked: true, phase: 'failed' };
    case 'duplicateOverLimit':
      return { ...start, ticked: true, phase: 'refused', refuse: 'plan' };
    case 'duplicateOverLimitAsk':
      return { ...start, ticked: true, phase: 'refused', refuse: 'plan', billing: false };
    case 'duplicateCeiling':
      return { ...start, brings: PAST_CEILING, ticked: true, phase: 'refused', refuse: 'ceiling' };
    default:
      return start;
  }
}

/** sc-3656's Copy, 21 Oct (l10n), and sc-3930's copy bullet, Worded 1 Nov. */
export const DUPLICATE_WORDS = {
  label: (count: number) =>
    count === 1
      ? 'Also copy the guest list (1 guest)'
      : `Also copy the guest list (${figure(count)} guests)`,
  hint: 'Replies are not copied, and nobody is invited or contacted.',
  copiedLine: (count: number) =>
    count === 1
      ? '1 guest: name, contact details and companions'
      : `${figure(count)} guests: names, contact details and companions`,
  notCopiedLine:
    'Replies, invitations, invitation links, check-ins, meal choices, seating, messages and history',
  success: (count: number) =>
    count === 1
      ? '1 guest copied. Nobody was invited or contacted.'
      : `${figure(count)} guests copied. Nobody was invited or contacted.`,
  creating: 'Creating…',
  notCreated: 'Not created. Nothing was saved. Try again.',
  draft: 'Draft',
  notBuilt: 'AC, not yet built · sc-3930',
  planTitle: `Your plan allows ${figure(FREE_PEOPLE)} people per event`,
  ceilingTitle: `An event can have up to ${figure(CEILING_PEOPLE)} people`,
  planWhat: (people: number) =>
    `Not created. The guest list would bring ${people === 1 ? '1 person' : `${figure(people)} people`}, and your plan has room for ${figure(FREE_PEOPLE)} in a new event.`,
  ceilingWhat: (people: number) =>
    `Not created. The guest list would bring ${figure(people)} people, more than the ${figure(CEILING_PEOPLE)} an event can hold.`,
  planFigure: (people: number) =>
    `${figure(people)} people · companions count as people · Free plan`,
  ceilingFigure: (people: number) => `${figure(people)} people · companions count as people`,
  safe: 'The form is kept as you left it.',
  untick: 'To duplicate without guests, untick Also copy the guest list.',
  changePlan: 'Change plan',
  askOwner: 'Ask an owner',
  backToForm: 'Back to the form',
  elsewhere: (what: string) => `${what} is sc-3930’s, with its own design.`,
} as const;

const D = DUPLICATE_WORDS;
const LEAVE_WHEN_TICKED: readonly string[] = ['Guests', 'Replies'];

export function copiedOf(base: readonly string[], ticked: boolean, guests: number): string[] {
  return ticked ? [...base, D.copiedLine(guests)] : [...base];
}

export function notCopiedOf(base: readonly string[], ticked: boolean): string[] {
  if (!ticked) return [...base];

  const [hosts, ...rest] = base.filter((item) => !LEAVE_WHEN_TICKED.includes(item));

  return hosts == null ? [D.notCopiedLine, ...rest] : [hosts, D.notCopiedLine, ...rest];
}

export interface Refusal {
  title: string;
  what: string;
  figure: string;
  plan: boolean;
}

export function refusalOf(refuse: Refuse, people: number): Refusal {
  return refuse === 'ceiling'
    ? {
        title: D.ceilingTitle,
        what: D.ceilingWhat(people),
        figure: D.ceilingFigure(people),
        plan: false,
      }
    : { title: D.planTitle, what: D.planWhat(people), figure: D.planFigure(people), plan: true };
}

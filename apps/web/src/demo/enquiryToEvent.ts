import {
  COVER_MIDDLE,
  EVENT_NAME_MAXIMUM,
  type EventType,
  HOST_NAME_MAXIMUM,
  VENUE_NAME_MAXIMUM,
} from '@soirely/domain';

import { PEOPLE, type Person } from './enquiries.ts';
import { type SampleEvent, TYPE_WORDS } from './events.ts';
import { type NewEventState, type NewTyped, ORG_DEFAULTS } from './newEvent.ts';
import type { DemoLink } from './settings.ts';

/** UAX #29's common clusters, as `clusterLength` in @soirely/domain's visibleText.ts counts them for a runtime without Intl.Segmenter. */
const CLUSTER =
  /\r\n|\p{Regional_Indicator}{2}|[ᄀ-ᅟ]+[ᅠ-ᆧ]*[ᆨ-ᇿ]*|[^](?:[\p{M}‌\u{E0020}-\u{E007F}]|\p{Emoji_Modifier}|‍\p{Extended_Pictographic})*/gu;

export function clustersOf(
  text: string,
  segmenter: boolean = typeof Intl.Segmenter === 'function',
): string[] {
  if (segmenter) return Array.from(new Intl.Segmenter().segment(text), (one) => one.segment);

  return text.match(CLUSTER) ?? [];
}

/** The first `most` clusters, never splitting one, and no space left trailing where it was cut. */
export function cutVisible(
  text: string,
  most: number,
  segmenter: boolean = typeof Intl.Segmenter === 'function',
): string {
  const clusters = clustersOf(text, segmenter);

  return clusters.length <= most ? text : clusters.slice(0, most).join('').trimEnd();
}

export interface Budget {
  amount: number;
  currency: string;
}

export interface SourceEnquiry {
  id: string;
  client: string;
  type: EventType | null;
  date: string | null;
  where: string | null;
  budget: Budget | null;
  assignee: Person | null;
}

export type CurrencyFrom = 'budget' | 'organisation';

export type Filled = NewTyped & { lead: string | null; currencyFrom: CurrencyFrom };

/** New event's fields as an enquiry fills them (sc-31232): never its guests, budget amount, contact, source or notes. */
export function filledFrom(
  enquiry: SourceEnquiry,
  offered: readonly string[],
  defaults: { timeZone: string; currency: string },
): Filled {
  const named =
    enquiry.type == null ? enquiry.client : `${enquiry.client} · ${TYPE_WORDS[enquiry.type]}`;
  const day = { date: enquiry.date ?? '', time: '' };
  const fromBudget = enquiry.budget != null && offered.includes(enquiry.budget.currency);

  return {
    name: cutVisible(named, EVENT_NAME_MAXIMUM),
    type: enquiry.type ?? '',
    hosts: [cutVisible(enquiry.client, HOST_NAME_MAXIMUM)],
    photo: false,
    position: COVER_MIDDLE,
    described: '',
    start: day,
    end: { ...day },
    venueName: enquiry.where == null ? '' : cutVisible(enquiry.where, VENUE_NAME_MAXIMUM),
    venueAddress: '',
    note: '',
    timeZone: defaults.timeZone,
    currency: fromBudget && enquiry.budget != null ? enquiry.budget.currency : defaults.currency,
    lead: enquiry.assignee?.role === 'member' ? enquiry.assignee.name : null,
    currencyFrom: fromBudget ? 'budget' : 'organisation',
  };
}

/** 100 clusters, the 60th the one-cluster bride with a skin tone. */
export const LONG_CLIENT =
  'Oluwaseun Adebayo-Williams & Chiamaka Nwosu-Okonkwo, bride \u{1F470}\u{1F3FD}‍♀️ and groom, both families, Lagos & Enugu';

export const LONG_WHERE =
  'The Civic Centre, Ozumba Mbadiwe Avenue, Victoria Island, Lagos, the main hall and the garden behind it, with the marquee on the lawn by the water, parking on the north side, guests arrive by the gate';

export const SOURCES = {
  bisi: {
    id: 'enq-bisi-event',
    client: 'Bisi Adebayo',
    type: 'anniversary',
    date: '2027-02-14',
    where: 'Victoria Island, Lagos',
    budget: { amount: 15_000_000, currency: 'NGN' },
    assignee: PEOPLE.tunde,
  },
  chinedu: {
    id: 'enq-chinedu-event',
    client: 'Chinedu Eze',
    type: null,
    date: null,
    where: null,
    budget: null,
    assignee: null,
  },
  long: {
    id: 'enq-long-event',
    client: LONG_CLIENT,
    type: 'religious',
    date: '2027-05-22',
    where: LONG_WHERE,
    budget: null,
    assignee: PEOPLE.tunde,
  },
  kunle: {
    id: 'enq-kunle-event',
    client: 'Kunle Adeyemi',
    type: 'birthday',
    date: '2026-11-14',
    where: 'Ikoyi, Lagos',
    budget: null,
    assignee: PEOPLE.tunde,
  },
  ada: {
    id: 'enq-ada-event',
    client: 'Ada Okafor',
    type: 'wedding',
    date: '2027-06-12',
    where: 'Hampton Court, Surrey',
    budget: { amount: 30_000, currency: 'GBP' },
    assignee: PEOPLE.folake,
  },
  kenji: {
    id: 'enq-kenji-event',
    client: 'Kenji Sato',
    type: 'wedding',
    date: '2027-04-10',
    where: 'Lekki, Lagos',
    budget: { amount: 2_500_000, currency: 'JPY' },
    assignee: null,
  },
  lucia: {
    id: 'enq-lucia-event',
    client: 'Lucía Fernández',
    type: 'corporate',
    date: '2027-03-05',
    where: 'Madrid',
    budget: { amount: 12_000, currency: 'EUR' },
    assignee: PEOPLE.kemi,
  },
} as const satisfies Record<string, SourceEnquiry>;

export type SourceKey = keyof typeof SOURCES;

function sourceById(id: string | undefined): SourceEnquiry | undefined {
  return Object.values(SOURCES).find((one) => one.id === id);
}

export function sourceOf(id: string | undefined): SourceEnquiry {
  return sourceById(id) ?? SOURCES.bisi;
}

/** Only this story's own enquiries open its page, so a list state's ?state=won never takes over another enquiry. */
export function isSource(id: string | undefined): boolean {
  return sourceById(id) != null;
}

export const MEMBERS: readonly string[] = [PEOPLE.tunde.name, 'Chidi Nnamdi', 'Amaka Obi'];

export const ENQUIRY_EVENT_STATES = [
  'open-admin',
  'open-member',
  'won',
  'won-has-event',
  'event-deleted',
] as const;
export type EnquiryEventState = (typeof ENQUIRY_EVENT_STATES)[number];

export const FILLED_STATES = [
  'filled',
  'sparse',
  'long',
  'date-passed',
  'lead-member',
  'lead-removed',
  'lead-none',
  'currency-from-budget',
  'currency-not-offered',
  'refused',
  'saving',
  'not-open',
  'forbidden',
] as const;
export type FilledState = (typeof FILLED_STATES)[number];

export const MADE_STATES = ['from-enquiry', 'from-enquiry-hidden', 'free-plan'] as const;
export type MadeState = (typeof MADE_STATES)[number];

function oneOf<T extends string>(states: readonly T[], raw: string | null): T | null {
  return states.find((one) => one === raw) ?? null;
}

export const enquiryEventStateOf = (raw: string | null) => oneOf(ENQUIRY_EVENT_STATES, raw);
export const filledStateOf = (raw: string | null) => oneOf(FILLED_STATES, raw);
export const madeStateOf = (raw: string | null) => oneOf(MADE_STATES, raw);

const AS: Partial<Record<FilledState, NewEventState>> = {
  refused: 'refused',
  saving: 'creating',
  'not-open': 'notCreated',
  forbidden: 'notCreated',
};

const SOURCE_OF: Record<FilledState, SourceKey> = {
  filled: 'bisi',
  sparse: 'chinedu',
  long: 'long',
  'date-passed': 'kunle',
  'lead-member': 'bisi',
  'lead-removed': 'bisi',
  'lead-none': 'lucia',
  'currency-from-budget': 'ada',
  'currency-not-offered': 'kenji',
  refused: 'bisi',
  saving: 'bisi',
  'not-open': 'bisi',
  forbidden: 'bisi',
};

const WITH_TIMES: readonly FilledState[] = ['saving', 'not-open', 'forbidden'];

export interface Filling {
  client: string;
  typed: NewTyped;
  lead: string | null;
  leadRemoved: boolean;
  currencyFrom: CurrencyFrom;
  as: NewEventState | null;
  /** What Create answers instead of going through: the 409 or the 403. */
  refusal: string | null;
  opens: string;
}

export function fillingOf(state: FilledState, offered: readonly string[]): Filling {
  const source = SOURCES[SOURCE_OF[state]];
  const { lead, currencyFrom, ...typed } = filledFrom(source, offered, ORG_DEFAULTS);
  const timed = WITH_TIMES.includes(state)
    ? {
        ...typed,
        start: { date: typed.start.date, time: '14:00' },
        end: { date: typed.end.date, time: '22:00' },
      }
    : typed;

  return {
    client: source.client,
    typed: timed,
    lead,
    leadRemoved: state === 'lead-removed',
    currencyFrom,
    as: AS[state] ?? null,
    refusal:
      state === 'not-open'
        ? ENQUIRY_EVENT_WORDS.notOpen
        : state === 'forbidden'
          ? ENQUIRY_EVENT_WORDS.forbidden
          : null,
    opens: `/demo/events/${MADE_FROM}?state=from-enquiry`,
  };
}

export function currencyHelp(from: Filling | null, own: string): string {
  return from?.currencyFrom === 'budget' ? ENQUIRY_EVENT_WORDS.fromBudget : own;
}

export function filledStateFor(source: SourceEnquiry): FilledState {
  const key = (Object.keys(SOURCES) as SourceKey[]).find((one) => SOURCES[one].id === source.id);
  const found = FILLED_STATES.find((one) => SOURCE_OF[one] === key);

  return found ?? 'filled';
}

export const MADE_FROM = 'evt-draft-4';

export function madeEvent(draft: SampleEvent): SampleEvent {
  const typed = filledFrom(SOURCES.bisi, [], ORG_DEFAULTS);

  return {
    ...draft,
    name: typed.name,
    type: 'anniversary',
    startsAt: '2027-02-14T13:00:00Z',
    endsAt: '2027-02-14T21:00:00Z',
    timeZone: typed.timeZone,
    venue: { name: typed.venueName, address: null, city: '' },
    hosts: typed.hosts,
    currency: 'NGN',
  };
}

export function withEnquiry(raw: string | null, event: SampleEvent | null): SampleEvent | null {
  return event?.id === MADE_FROM && madeStateOf(raw) != null ? madeEvent(event) : event;
}

/** The Overview's From an enquiry line shows only to who can see the enquiry, and not on Free. */
export function fromEnquiryShown(state: MadeState | null): boolean {
  return state === 'from-enquiry';
}

export const ENQUIRY_EVENT_WORDS = {
  open: 'Open',
  won: 'Won',
  lost: 'Lost',
  createEvent: 'Create event',
  closeAsLost: 'Close as lost…',
  memberLine: 'An owner or admin creates the event from this enquiry.',
  became: (name: string) => `Became ${name}`,
  lostBudget: 'Lost · Budget',
  reopen: 'Reopen',
  notReopened: 'Not reopened. This enquiry became an event meanwhile, so it stays Won.',
  pressReopen: 'Press Reopen on the stale page',
  eventDeleted: 'The event made from this enquiry was deleted.',
  restElsewhere:
    'The rest of the page (Reach them, About the event, Assigned to, Notes) is sc-31226’s.',
  filledIn: (client: string) =>
    `Filled in from ${client}’s enquiry. Check each field before you create the event.`,
  fromBudget: 'From the budget in the enquiry.',
  lead: 'Lead',
  leadLine: 'They get the event role Lead when you create the event.',
  change: 'Change',
  remove: 'Remove',
  noLead: 'No lead',
  noRole: (member: string) => `${member} won’t be given a role on this event.`,
  chooseLead: 'Choose a lead',
  members: 'Members',
  leadNamed: (member: string) => `Lead: ${member}`,
  notOpen:
    'Not created. This enquiry was closed while you were filling this in, so no event was made from it.',
  forbidden: 'Not created. Only an owner or admin can create an event from an enquiry.',
  fromEnquiry: (client: string) => `From an enquiry · ${client}`,
} as const;

function link(to: string, name: string): DemoLink {
  return { to, name };
}

const ENQUIRY = (state: EnquiryEventState) => `/demo/enquiries/enq-bisi-event?state=${state}`;
const FILLED = (state: FilledState) => `/demo/events/new?from=enquiry&state=${state}`;
const MADE = (state: MadeState) => `/demo/events/${MADE_FROM}?state=${state}`;

export const ENQUIRY_EVENT_PAGES: readonly { name: string; states: readonly DemoLink[] }[] = [
  {
    name: 'An enquiry becomes an event (sc-31232)',
    states: [
      link(ENQUIRY('open-admin'), 'The enquiry, Open, an Owner: Create event'),
      link(ENQUIRY('open-member'), 'The enquiry, Open, the assigned Member: no Create event'),
      link(ENQUIRY('won'), 'The enquiry, Won: Became Bisi Adebayo · Anniversary'),
      link(ENQUIRY('won-has-event'), 'The enquiry, Reopen on a stale page: it stays Won'),
      link(ENQUIRY('event-deleted'), 'The enquiry, its event deleted: Create event again'),
      link(FILLED('filled'), 'New event filled from Bisi Adebayo, times empty'),
      link(FILLED('sparse'), 'New event from a sparse enquiry: Chinedu Eze'),
      link(FILLED('long'), 'New event with a long name, venue and host, cut'),
      link(FILLED('date-passed'), 'New event on a date that has passed'),
      link(FILLED('lead-member'), 'New event with Lead: the assigned Member'),
      link(FILLED('lead-removed'), 'New event with the Lead removed: No lead'),
      link(FILLED('lead-none'), 'New event from an Admin’s enquiry: no Lead'),
      link(FILLED('currency-from-budget'), 'New event in GBP, from the budget'),
      link(FILLED('currency-not-offered'), 'New event with JPY not offered: NGN'),
      link(FILLED('refused'), 'New event, Create with the times empty'),
      link(FILLED('saving'), 'New event, Creating…'),
      link(FILLED('not-open'), 'New event, the enquiry was closed meanwhile'),
      link(FILLED('forbidden'), 'New event, only an owner or admin creates it'),
      link(MADE('from-enquiry'), 'The event’s Overview: From an enquiry · Bisi Adebayo'),
      link(MADE('from-enquiry-hidden'), 'The event’s Overview, a Member without the enquiry'),
      link(MADE('free-plan'), 'The event’s Overview on Free: no line'),
    ],
  },
];

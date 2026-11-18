import {
  EVENT_NAME_MAXIMUM,
  type EventType,
  HOST_NAME_MAXIMUM,
  VENUE_NAME_MAXIMUM,
} from '@soirely/domain';

import { type SampleEvent, TYPE_WORDS } from '../events/EventsSample.ts';
import type { NewState, NewTyped } from '../events/NewEventModel.ts';
import { PEOPLE, type Person } from './EnquiriesModel.ts';

/** UAX #29's common clusters, as `clusterLength` in @soirely/domain's visibleText.ts counts them on Hermes. */
const CLUSTER =
  /\r\n|\p{Regional_Indicator}{2}|[ᄀ-ᅟ]+[ᅠ-ᆧ]*[ᆨ-ᇿ]*|[^](?:[\p{M}‌\u{E0020}-\u{E007F}]|\p{Emoji_Modifier}|‍\p{Extended_Pictographic})*/gu;

function clustersOf(text: string): string[] {
  if (typeof Intl.Segmenter === 'function')
    return Array.from(new Intl.Segmenter().segment(text), (one) => one.segment);

  return text.match(CLUSTER) ?? [];
}

/** The first `most` extended grapheme clusters, never splitting one; a cut's trailing spaces go. */
export function cutVisible(text: string, most: number): string {
  const clusters = clustersOf(text);
  if (clusters.length <= most) return text;

  return clusters.slice(0, most).join('').trimEnd();
}

export interface Budget {
  amount: number;
  currency: string;
}

export interface EventEnquiry {
  id: string;
  client: string;
  type: EventType | null;
  date: string | null;
  where: string | null;
  budget: Budget | null;
  assignedTo: Person | null;
}

export type CurrencyFrom = 'budget' | 'organisation';

export type Filled = NewTyped & { lead: string | null; currencyFrom: CurrencyFrom };

/** New event's fields from an enquiry: guests, budget amount, how to reach them, where they heard and notes are never copied. */
export function filledFrom(
  enquiry: EventEnquiry,
  offered: readonly string[],
  defaults: { timeZone: string; currency: string },
): Filled {
  const at = { date: enquiry.date ?? '', time: '' };
  const budget = enquiry.budget?.currency;
  const fromBudget = budget != null && offered.includes(budget);

  return {
    name: cutVisible(
      enquiry.type == null ? enquiry.client : `${enquiry.client} · ${TYPE_WORDS[enquiry.type]}`,
      EVENT_NAME_MAXIMUM,
    ),
    type: enquiry.type ?? '',
    hosts: [{ key: 0, name: cutVisible(enquiry.client, HOST_NAME_MAXIMUM) }],
    photo: false,
    position: 'middle',
    described: '',
    start: at,
    end: { ...at },
    venueName: enquiry.where == null ? '' : cutVisible(enquiry.where, VENUE_NAME_MAXIMUM),
    venueAddress: '',
    note: '',
    timeZone: defaults.timeZone,
    currency: fromBudget ? budget : defaults.currency,
    lead: enquiry.assignedTo?.role === 'member' ? enquiry.assignedTo.name : null,
    currencyFrom: fromBudget ? 'budget' : 'organisation',
  };
}

/** Exactly 100 clusters, the 60th the one-cluster bride with her skin tone. */
export const LONG_CLIENT =
  'Oluwaseun Adebayo-Williams & Chiamaka Nwosu-Okonkwo, bride \u{1F470}\u{1F3FD}‍♀️ and groom, both families, Lagos & Enugu';

export const LONG_WHERE =
  'The Civic Centre, Ozumba Mbadiwe Avenue, Victoria Island, Lagos, the main hall and the garden behind it, with the marquee on the lawn by the water, parking on the north side, guests arrive by the gate';

export const EVENT_ENQUIRIES = {
  bisi: {
    id: 'enq-bisi-event',
    client: 'Bisi Adebayo',
    type: 'anniversary',
    date: '2027-02-14',
    where: 'Victoria Island, Lagos',
    budget: { amount: 15_000_000, currency: 'NGN' },
    assignedTo: PEOPLE.tunde,
  },
  chinedu: {
    id: 'enq-chinedu-event',
    client: 'Chinedu Eze',
    type: null,
    date: null,
    where: null,
    budget: null,
    assignedTo: null,
  },
  long: {
    id: 'enq-long-event',
    client: LONG_CLIENT,
    type: 'religious',
    date: '2027-05-22',
    where: LONG_WHERE,
    budget: null,
    assignedTo: PEOPLE.tunde,
  },
  kunle: {
    id: 'enq-kunle-event',
    client: 'Kunle Adeyemi',
    type: 'birthday',
    date: '2026-11-14',
    where: 'Ikoyi, Lagos',
    budget: null,
    assignedTo: PEOPLE.tunde,
  },
  ada: {
    id: 'enq-ada-event',
    client: 'Ada Okafor',
    type: 'wedding',
    date: '2027-06-12',
    where: 'Hampton Court, Surrey',
    budget: { amount: 30_000, currency: 'GBP' },
    assignedTo: PEOPLE.folake,
  },
  kenji: {
    id: 'enq-kenji-event',
    client: 'Kenji Sato',
    type: 'wedding',
    date: '2027-04-10',
    where: 'Lekki, Lagos',
    budget: { amount: 2_500_000, currency: 'JPY' },
    assignedTo: null,
  },
  lucia: {
    id: 'enq-lucia-event',
    client: 'Lucía Fernández',
    type: 'corporate',
    date: '2027-03-05',
    where: 'Madrid',
    budget: { amount: 12_000, currency: 'EUR' },
    assignedTo: PEOPLE.kemi,
  },
} as const satisfies Record<string, EventEnquiry>;

export type EnquiryKey = keyof typeof EVENT_ENQUIRIES;

export function eventEnquiryOf(id: string | undefined): EventEnquiry | null {
  return Object.values(EVENT_ENQUIRIES).find((one) => one.id === id) ?? null;
}

export const MEMBERS: readonly string[] = [PEOPLE.tunde.name, 'Chidi Nnamdi', 'Amaka Obi'];

export const PAGE_STATES = [
  'open-admin',
  'open-member',
  'won',
  'won-has-event',
  'event-deleted',
] as const;
export type PageState = (typeof PAGE_STATES)[number];

export const FORM_STATES = [
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
export type FormState = (typeof FORM_STATES)[number];

export const ORIGIN_STATES = ['from-enquiry', 'from-enquiry-hidden', 'free-plan'] as const;
export type OriginState = (typeof ORIGIN_STATES)[number];

function oneOf<State extends string>(
  states: readonly State[],
  value: string | undefined | null,
): State | null {
  return states.find((state) => state === value) ?? null;
}

export const pageStateOf = (value: string | undefined | null) => oneOf(PAGE_STATES, value);
export const formStateOf = (value: string | undefined | null) => oneOf(FORM_STATES, value);
export const originStateOf = (value: string | undefined | null) => oneOf(ORIGIN_STATES, value);

export const FORM_ENQUIRY: Record<FormState, EnquiryKey> = {
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

export type Refusal = 'notOpen' | 'forbidden';

export interface Lead {
  name: string | null;
  was: string;
}

/** What New event opens with when it is filled from an enquiry. */
export interface FromEnquiry {
  client: string;
  typed: NewTyped;
  lead: Lead | null;
  currencyFrom: CurrencyFrom;
  refusal: Refusal | null;
  leadInView: boolean;
}

const CHOSEN_TIMES = { start: '14:00', end: '22:00' };

/** The form opened from an enquiry's Create event, or at one of the board's states. */
export function fromEnquiry(
  enquiry: EventEnquiry,
  offered: readonly string[],
  defaults: { timeZone: string; currency: string },
  state: FormState | null = null,
): { from: FromEnquiry; start: NewState | null } {
  const { lead, currencyFrom, ...typed } = filledFrom(enquiry, offered, defaults);
  const timed =
    state === 'saving' || state === 'not-open' || state === 'forbidden'
      ? {
          ...typed,
          start: { date: typed.start.date, time: CHOSEN_TIMES.start },
          end: { date: typed.end.date, time: CHOSEN_TIMES.end },
        }
      : typed;

  return {
    from: {
      client: enquiry.client,
      typed: timed,
      lead: lead == null ? null : { name: state === 'lead-removed' ? null : lead, was: lead },
      currencyFrom,
      refusal: state === 'not-open' ? 'notOpen' : state === 'forbidden' ? 'forbidden' : null,
      leadInView: state === 'lead-member' || state === 'lead-removed',
    },
    start:
      state === 'refused'
        ? 'newRefused'
        : state === 'saving'
          ? 'newCreating'
          : state === 'not-open' || state === 'forbidden'
            ? 'newNotCreated'
            : null,
  };
}

/** The draft Create made from Bisi's enquiry, with the times chosen on the form. */
export function draftFromEnquiry(base: SampleEvent): SampleEvent {
  const bisi = EVENT_ENQUIRIES.bisi;

  return {
    ...base,
    name: `${bisi.client} · ${TYPE_WORDS[bisi.type]}`,
    type: bisi.type,
    venue: { name: bisi.where, address: '', place: bisi.where },
    arrivalNote: null,
    timeZone: 'Africa/Lagos',
    startsAt: '2027-02-14T13:00:00Z',
    endsAt: '2027-02-14T21:00:00Z',
    hosts: [bisi.client],
    currency: bisi.budget.currency,
    status: 'draft',
    concludedAt: null,
    photo: false,
  };
}

export const ORIGIN_HREF = `/demo/enquiries/${EVENT_ENQUIRIES.bisi.id}?state=won`;

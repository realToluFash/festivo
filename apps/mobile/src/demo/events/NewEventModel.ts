import {
  type EventDraft,
  type EventFormField,
  type EventType,
  eventFormProblems,
  firstRefusedOf,
  newEventHosts,
} from '@soirely/domain';

import { hostErrorWords } from './hostErrors.ts';
import { W, say } from './EventsWords.ts';

/** New event's states (sc-48607), each a ?state= on /demo/events with the form open over the list. */
export const NEW_STATES = [
  'new',
  'newFilled',
  'newRefused',
  'newCreating',
  'newNotCreated',
  'newServer',
  'newOffline',
  'newLeave',
  'newMoved',
  'newSkipped',
  'newCreated',
  'newPhoto',
  'newPhotoRefused',
] as const;
export type NewState = (typeof NEW_STATES)[number];

export function isNewState(state: string | null): state is NewState {
  return NEW_STATES.some((one) => one === state);
}

export interface Moment {
  date: string;
  time: string;
}

export interface NewTyped {
  name: string;
  type: EventType | '';
  hosts: { key: number; name: string }[];
  photo: boolean;
  start: Moment;
  end: Moment;
  venueName: string;
  venueAddress: string;
  timeZone: string;
  currency: string;
}

export const ORG_DEFAULTS = { timeZone: 'Africa/Lagos', currency: 'NGN' };

export const BLANK: NewTyped = {
  name: '',
  type: '',
  hosts: [{ key: 0, name: '' }],
  photo: false,
  start: { date: '', time: '' },
  end: { date: '', time: '' },
  venueName: '',
  venueAddress: '',
  ...ORG_DEFAULTS,
};

export const FILLED: NewTyped = {
  name: 'Adaeze & Tunde’s wedding',
  type: 'wedding',
  hosts: [
    { key: 0, name: 'Adaeze Obi' },
    { key: 1, name: 'Tunde Bakare' },
  ],
  photo: false,
  start: { date: '2027-03-13', time: '14:00' },
  end: { date: '2027-03-13', time: '23:00' },
  venueName: 'Eko Hotel',
  venueAddress: 'Adetokunbo Ademola Street, Victoria Island, Lagos',
  ...ORG_DEFAULTS,
};

/** Four refusals at once: the name blank, no type, a blank second host and an end before the start. */
const REFUSED: NewTyped = {
  ...FILLED,
  name: '',
  type: '',
  hosts: [
    { key: 0, name: 'Adaeze Obi' },
    { key: 1, name: '' },
  ],
  start: { date: '2027-03-13', time: '18:00' },
  end: { date: '2027-03-13', time: '15:00' },
};

/** 01:30 on the night London's clocks go forward in 2027, which does not exist there. */
const SKIPPED: NewTyped = {
  ...FILLED,
  name: 'Ireti’s 30th',
  type: 'birthday',
  hosts: [{ key: 0, name: 'Ireti Adeyemi' }],
  start: { date: '2027-03-28', time: '01:30' },
  end: { date: '2027-03-28', time: '05:00' },
  venueName: 'The Landmark',
  venueAddress: '222 Marylebone Road, London NW1 6JQ',
  timeZone: 'Europe/London',
  currency: 'GBP',
};

export const MOVED: NewTyped = {
  ...FILLED,
  start: { date: '2027-03-14', time: '14:00' },
  end: { date: '2027-03-14', time: '23:00' },
};

export function typedFor(state: NewState | null): NewTyped {
  switch (state) {
    case null:
    case 'new':
      return BLANK;
    case 'newRefused':
      return REFUSED;
    case 'newSkipped':
      return SKIPPED;
    case 'newMoved':
      return MOVED;
    case 'newPhoto':
    case 'newPhotoRefused':
      return { ...FILLED, photo: true };
    default:
      return FILLED;
  }
}

export function draftOf(typed: NewTyped): EventDraft {
  return {
    name: typed.name,
    type: typed.type,
    startDate: typed.start.date,
    startTime: typed.start.time,
    endDate: typed.end.date,
    endTime: typed.end.time,
  };
}

export type Refusals = Partial<Record<EventFormField, string>>;

const WORDS: Record<string, string> = {
  nameBlank: W.nameBlank,
  nameTooLong: W.nameTooLong,
  typeMissing: W.typeMissing,
  startMissing: W.startMissing,
  endMissing: W.endMissing,
  endBeforeStart: W.endBeforeStart,
  venueNameTooLong: W.venueNameTooLong,
  venueAddressTooLong: W.venueAddressTooLong,
  currencyBlank: W.currencyBlank,
};

export function refusalsOf(typed: NewTyped): Refusals {
  const found: Refusals = {};
  for (const one of eventFormProblems({
    draft: draftOf(typed),
    venue: { name: typed.venueName, address: typed.venueAddress, addressId: null, note: '' },
    timeZone: typed.timeZone,
    currency: typed.currency,
  }))
    found[one.field] = WORDS[one.problem] ?? one.problem;

  return found;
}

/** What Create checks before it sends: the fields', then each host row's, with a blank Host 1 alone let through. */
export function checkOf(typed: NewTyped): {
  refusals: Refusals;
  hosts: (string | null)[];
  count: number;
  summary: string | null;
} {
  const refusals = refusalsOf(typed);
  const sent = newEventHosts(typed.hosts);
  const hosts =
    sent.length === 0
      ? typed.hosts.map(() => null)
      : hostErrorWords(
          typed.hosts.map((row) => row.name),
          true,
        );
  const count = Object.keys(refusals).length + hosts.filter((one) => one != null).length;

  return { refusals, hosts, count, summary: count === 0 ? null : say.problems(count) };
}

/** Where focus lands on a refusal, by the domain's order: Event name and Type before the hosts, the rest after them (sc-22143). */
export function firstRefused(
  refusals: Refusals,
  hosts: readonly (string | null)[],
): { field: EventFormField } | { host: number } | null {
  const rows = hosts.map((_, key) => ({ key, name: '' }));
  const hostErrors = Object.fromEntries(
    hosts.flatMap((one, key) => (one == null ? [] : [[key, one]])),
  );

  return firstRefusedOf(refusals, hostErrors, rows);
}

/** Anything typed or chosen beyond what the form opened with, which Cancel asks about first. */
export function typedSomething(typed: NewTyped): boolean {
  return (
    JSON.stringify({ ...typed, hosts: typed.hosts.map((one) => one.name) }) !==
    JSON.stringify({ ...BLANK, hosts: BLANK.hosts.map((one) => one.name) })
  );
}

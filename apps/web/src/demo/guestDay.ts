import { guestPlace } from './arrivalNote.ts';
import type { Lang, Visit } from './guest.ts';
import { type SampleEvent, localDay, sampleEvent } from './events.ts';
import type { DemoLink } from './settings.ts';

const WEDDING = sampleEvent('evt-wed-4') as SampleEvent;

export type Day = 'before' | 'onTheDay' | 'after';

export type WhereShown = 'full' | 'nameOnly' | 'addressOnly' | 'none';

export interface Place {
  name: string | null;
  address: string | null;
  note: string | null;
}

/** The rule the server's day flag follows; the page reads the flag (`Visit.day`), never works the day out itself. */
export function isTheDay(now: Date, event: Pick<SampleEvent, 'startsAt' | 'endsAt' | 'timeZone'>) {
  return (
    localDay(now, event.timeZone) >= localDay(event.startsAt, event.timeZone) &&
    now.getTime() < Date.parse(event.endsAt)
  );
}

export function dayAt(
  now: Date,
  event: Pick<SampleEvent, 'startsAt' | 'endsAt' | 'timeZone'>,
): Day {
  if (now.getTime() >= Date.parse(event.endsAt)) return 'after';

  return isTheDay(now, event) ? 'onTheDay' : 'before';
}

/** The page's one reading of the place: the venue as `where` shows it, and the host's arrival note from sc-24385. */
export function placeOf(
  visit: Pick<Visit, 'where' | 'note' | 'phase'>,
  event: SampleEvent = WEDDING,
): Place {
  const { venue, note } = guestPlace(event, visit.note, visit.phase === 'live');
  const name = venue?.name ?? null;
  const address = venue?.address ?? null;
  const shown: Record<WhereShown, Omit<Place, 'note'>> = {
    full: { name, address },
    nameOnly: { name, address: null },
    addressOnly: { name: null, address },
    none: { name: null, address: null },
  };

  return { ...shown[visit.where], note };
}

export function hasWhere(place: Place): boolean {
  return place.name != null || place.address != null || place.note != null;
}

/** Google Maps' search on the address alone, as the event-change email links it. */
export function mapsLink(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

/** Only a Coming guest's live page on the day leads with the code, and only in its answered or closed view. */
export function leadsWithCode(visit: Visit): boolean {
  const { view, recorded, phase, day } = visit;

  return (
    day === 'onTheDay' &&
    phase === 'live' &&
    recorded?.answer === 'coming' &&
    (view.kind === 'recorded' || view.kind === 'closed')
  );
}

/** The order is set when the page loads; a reload is the only thing that changes it (WCAG 3.2.1, 3.2.2). */
export function inDayOrder(visit: Visit): boolean {
  return visit.dayOrder && leadsWithCode(visit);
}

const DAY_WORDS: Record<Lang, { code: string; where: string }> = {
  en: { code: 'Your code', where: 'Where' },
  es: { code: '[Su código]', where: '[Dónde]' },
  fr: { code: '[Votre code]', where: '[Où]' },
  pt: { code: '[O seu código]', where: '[Onde]' },
};

export function dayWords(lang: Lang) {
  return DAY_WORDS[lang];
}

/** 09:00 and 19:00 on the wedding's day in London, before and after its 18:00 start; 09:00 the day before. */
export const DAY_NOW = '2026-11-05T09:00:00Z';
export const STARTED_NOW = '2026-11-05T19:00:00Z';
export const EVE_NOW = '2026-11-04T09:00:00Z';
export const AFTER_NOW = '2026-11-07T16:00:00Z';

const ON_THE_DAY: Partial<Visit> = { day: 'onTheDay', now: DAY_NOW, replyBy: null };
const STARTED: Partial<Visit> = { day: 'onTheDay', now: STARTED_NOW, started: true };
const COMING = { recorded: { answer: 'coming', on: '2026-10-27' } } as const;
const RECORDED = { view: { kind: 'recorded', same: false } } as const;
const CLOSED = { view: { kind: 'closed' } } as const;

export const GUEST_DAY_STATES = {
  onTheDay: {
    name: 'On the day, answers open, Coming: Your code, Where, Your answer',
    starts: { ...ON_THE_DAY, ...COMING, ...RECORDED },
  },
  onTheDayStarted: {
    name: 'On the day, from the start, Coming: the closed view under Your answer',
    starts: { ...STARTED, ...COMING, ...CLOSED },
  },
  onTheDayNameOnly: {
    name: 'On the day, a venue name and no address: no Open in maps',
    starts: { ...ON_THE_DAY, ...COMING, ...RECORDED, where: 'nameOnly' },
  },
  onTheDayAddressOnly: {
    name: 'On the day, an address and no name',
    starts: { ...ON_THE_DAY, ...COMING, ...RECORDED, where: 'addressOnly' },
  },
  onTheDayNoteOnly: {
    name: 'On the day, an arrival note and no venue',
    starts: { ...ON_THE_DAY, ...COMING, ...RECORDED, note: 'alone' },
  },
  onTheDayNoWhere: {
    name: 'On the day, no venue and no note: no Where block, the time stays at the head',
    starts: { ...ON_THE_DAY, ...COMING, ...RECORDED, where: 'none', note: 'none' },
  },
  onTheDayLoading: {
    name: 'On the day, loading: the code card’s box held at its size',
    starts: { ...ON_THE_DAY, ...COMING, ...RECORDED, page: 'loading' },
  },
  onTheDayFrench: {
    name: 'On the day, in French (open it at 320)',
    starts: { ...ON_THE_DAY, ...COMING, ...RECORDED, lang: 'fr' },
  },
  onTheDayNotComing: {
    name: 'On the day, Not coming: the usual order',
    starts: {
      ...ON_THE_DAY,
      recorded: { answer: 'notComing', on: '2026-10-27' },
      ...RECORDED,
    },
  },
  onTheDayNotSure: {
    name: 'On the day, Not sure yet: the usual order',
    starts: { ...ON_THE_DAY, recorded: { answer: 'notSure', on: '2026-10-27' }, ...RECORDED },
  },
  onTheDayNoAnswer: {
    name: 'On the day, no answer: the usual order, still answering',
    starts: ON_THE_DAY,
  },
  onTheDayNoAnswerStarted: {
    name: 'On the day, from the start, no answer: the closed view',
    starts: { ...STARTED, ...CLOSED },
  },
  theDayBefore: {
    name: 'The day before, Coming: the usual order',
    starts: { day: 'before', now: EVE_NOW, replyBy: null, ...COMING, ...RECORDED },
  },
  afterTheEnd: {
    name: 'After the end: sc-3591’s page, no longer the day’s order',
    starts: { day: 'after', now: AFTER_NOW, phase: 'over', started: true, ...COMING, ...CLOSED },
  },
} satisfies Record<string, { name: string; starts: Partial<Visit> }>;

export type GuestDayState = keyof typeof GUEST_DAY_STATES;

export function isGuestDayState(value: string | null): value is GuestDayState {
  return value != null && Object.hasOwn(GUEST_DAY_STATES, value);
}

export function guestDayStarts(state: GuestDayState): Partial<Visit> {
  return GUEST_DAY_STATES[state].starts as Partial<Visit>;
}

export const GUEST_DAY_PAGES: readonly { name: string; states: readonly DemoLink[] }[] = [
  {
    name: 'On the event’s day (sc-24381)',
    states: (Object.keys(GUEST_DAY_STATES) as GuestDayState[]).map((state) => ({
      to: `/demo/guest?state=${state}`,
      name: GUEST_DAY_STATES[state].name,
    })),
  },
];

import { writtenTime } from './clock.ts';
import type { Visit } from './guest.ts';
import { type RunItem, expected } from './runView.ts';
import { type Item, dayOf as eventDayOf, sampleItems } from './schedule.ts';
import type { DemoLink } from './settings.ts';

/** What the guest API answers per item, and nothing else: never owner, role, note, length, fixed time or lateness. */
export interface GuestItem {
  id: string;
  title: string;
  startsAt: string;
  /** The event day it sits on; an event day runs from 05:00 to 05:00 (sc-3895, Decided 1 Nov). */
  day: string;
  place: string | null;
}

export type ProgrammeSet = 'none' | 'days' | 'oneDay' | 'onePlace';

export interface Mark {
  started: string;
  ended?: string;
}

export interface Live {
  at: string;
  marks: Readonly<Record<string, Mark>>;
}

const WITH = (items: Item[], shown: (one: Item) => boolean): Item[] =>
  items.map((one) => ({ ...one, guests: shown(one) }));

export function scheduleOf(set: ProgrammeSet): Item[] {
  const items = sampleItems();

  switch (set) {
    case 'none':
      return WITH(items, () => false);
    case 'days':
      return items;
    case 'oneDay':
      return WITH(items, (one) => (one.id === 'late' ? true : one.id !== 'drinks' && one.guests));
    case 'onePlace':
      return WITH(items, (one) => one.guests && one.place === 'Ballroom');
  }
}

/** How the night went on Friday by 17:25, as sc-1404's run view would have it marked. */
export const LIVE_MARKS: Readonly<Record<string, Mark>> = {
  drinks: { started: '2026-11-05T18:00', ended: '2026-11-05T20:00' },
  families: { started: '2026-11-05T20:02', ended: '2026-11-05T21:10' },
  seated: { started: '2026-11-06T13:32', ended: '2026-11-06T14:05' },
  ceremony: { started: '2026-11-06T14:08', ended: '2026-11-06T14:58' },
  photos: { started: '2026-11-06T15:05', ended: '2026-11-06T16:00' },
  reception: { started: '2026-11-06T15:05', ended: '2026-11-06T16:50' },
  entrance: { started: '2026-11-06T17:24' },
};

export const LIVE_NOW = '2026-11-06T17:25:00Z';

const MINUTE = 60_000;
const FIVE = 5 * MINUTE;
const DAY_TURNS_AT = 5 * 60;

const pad2 = (n: number): string => String(n).padStart(2, '0');

function msOf(wall: string): number {
  return Date.UTC(
    Number(wall.slice(0, 4)),
    Number(wall.slice(5, 7)) - 1,
    Number(wall.slice(8, 10)),
    Number(wall.slice(11, 13)),
    Number(wall.slice(14, 16)),
  );
}

function wallOf(ms: number): string {
  const d = new Date(ms);

  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}T${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
}

export function laterBy(wall: string, minutes: number): string {
  return wallOf(msOf(wall) + minutes * MINUTE);
}

/** Down to 5 minutes, as the room screen (sc-3897): 17:24 reads 17:20, so a guest is never told a start already gone. */
export function roundedToFive(wall: string): string {
  return wallOf(Math.floor(msOf(wall) / FIVE) * FIVE);
}

export function wallIn(at: string, zone: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(at));
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((one) => one.type === type)?.value ?? '00';

  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}`;
}

/** A wall time in the event's zone as an instant with that zone's offset, for a `time` element's dateTime. */
export function dateTimeOf(wall: string, zone: string): string {
  const guess = msOf(wall);
  const offsetAt = (ms: number) => msOf(wallIn(new Date(ms).toISOString(), zone)) - ms;
  const offset = offsetAt(guess - offsetAt(guess)) / MINUTE;
  const sign = offset < 0 ? '-' : '+';
  const size = Math.abs(offset);

  return `${wall}${sign}${pad2(Math.floor(size / 60))}:${pad2(size % 60)}`;
}

function wallOnDay(day: string, minutesIntoDay: number): string {
  return wallOf(msOf(`${day}T00:00`) + (DAY_TURNS_AT + minutesIntoDay) * MINUTE);
}

function markAt(mark: Mark | undefined, at: string): Mark | null {
  if (mark == null || mark.started > at) return null;

  return mark.ended == null || mark.ended > at ? { started: mark.started } : mark;
}

/** Each item's start as a guest reads it while Happening now: when it started, or sc-1404's expected start. */
function liveStarts(items: readonly Item[], live: Live): Map<string, string> {
  const today = eventDayOf(live.at);
  const tracks = new Map<string, Item[]>();

  for (const one of items) {
    const key = `${eventDayOf(one.starts)}|${one.place ?? ''}`;
    tracks.set(key, [...(tracks.get(key) ?? []), one]);
  }

  const starts = new Map<string, string>();

  for (const [key, track] of tracks) {
    const day = key.slice(0, 10);
    const run: RunItem[] = track.map((one) => {
      const mark = markAt(live.marks[one.id], live.at);

      return {
        id: one.id,
        planned: one.starts.slice(11, 16),
        title: one.title,
        length: one.lasts,
        owner: one.owner,
        fixed: one.fixed,
        phase: mark == null ? 'waiting' : mark.ended == null ? 'now' : 'done',
        ...(mark == null ? {} : { started: mark.started.slice(11, 16) }),
        ...(mark?.ended == null ? {} : { ended: mark.ended.slice(11, 16) }),
      };
    });
    const worked = day === today ? expected(run, live.at.slice(11, 16)).starts : new Map();

    for (const one of track) {
      const mark = markAt(live.marks[one.id], live.at);
      const minutes = worked.get(one.id);

      starts.set(
        one.id,
        mark != null ? mark.started : minutes == null ? one.starts : wallOnDay(day, minutes),
      );
    }
  }

  return starts;
}

export function guestProgramme(items: readonly Item[], live: Live | null): GuestItem[] {
  const starts = live == null ? null : liveStarts(items, live);

  return items
    .filter((one) => one.guests)
    .map((one) => ({
      id: one.id,
      title: one.title,
      startsAt: starts == null ? one.starts : roundedToFive(starts.get(one.id) ?? one.starts),
      day: eventDayOf(one.starts),
      place: one.place,
    }))
    .sort((a, b) => msOf(a.startsAt) - msOf(b.startsAt));
}

export interface ProgrammeDay {
  day: string;
  items: readonly GuestItem[];
}

export function byDay(items: readonly GuestItem[]): ProgrammeDay[] {
  const days = new Map<string, GuestItem[]>();

  for (const one of items) days.set(one.day, [...(days.get(one.day) ?? []), one]);

  return [...days].map(([day, rows]) => ({ day, items: rows }));
}

/** More than one place among the items shown, an item with none counting as one of them. */
export function showsPlaces(items: readonly GuestItem[]): boolean {
  return new Set(items.map((one) => one.place)).size > 1;
}

/** A start past midnight carries its weekday, since it sits under the event day before, as on the Schedule page. */
export function timeText(one: GuestItem, locale: string): string {
  const time = writtenTime(one.startsAt, locale);

  if (one.startsAt.slice(0, 10) === one.day) return time;
  const weekday = new Intl.DateTimeFormat(locale, { timeZone: 'UTC', weekday: 'short' }).format(
    new Date(msOf(one.startsAt)),
  );

  return `${weekday} ${time}`;
}

export function isHappening(visit: Pick<Visit, 'started' | 'phase' | 'day'>): boolean {
  return (
    visit.started &&
    visit.day === 'onTheDay' &&
    (visit.phase === 'live' || visit.phase === 'paused')
  );
}

/** No section with nothing shown to guests, or once the event is called off. */
export function showsProgramme(visit: Pick<Visit, 'programme' | 'phase'>): boolean {
  return (
    visit.phase !== 'calledOff' && guestProgramme(scheduleOf(visit.programme), null).length > 0
  );
}

type Words = { theDay: string; programme: string; zone: (zone: string) => string };

const PROGRAMME_WORDS: Record<Visit['lang'], Words> = {
  en: { theDay: 'The day', programme: 'Programme', zone: (zone) => `Times in ${zone}.` },
  es: { theDay: '[El día]', programme: '[Programa]', zone: (zone) => `[Horas de ${zone}.]` },
  fr: { theDay: '[Le jour J]', programme: '[Programme]', zone: (zone) => `[Heures de ${zone}.]` },
  pt: { theDay: '[O dia]', programme: '[Programa]', zone: (zone) => `[Horas de ${zone}.]` },
};

export function programmeWords(lang: Visit['lang']): Words {
  return PROGRAMME_WORDS[lang];
}

export function headingOf(items: readonly GuestItem[], lang: Visit['lang']): string {
  const words = programmeWords(lang);

  return byDay(items).length > 1 ? words.programme : words.theDay;
}

export const DEMO_CLOCK = {
  line: 'Demo only: the clock stands still here, so this moves it on 5 minutes to show the times catch up.',
  move: 'Move the clock on 5 min',
} as const;

export const TABLE_SLOT = {
  heading: 'Your table',
  line: 'Table 4 · Ballroom',
  notBuilt: 'AC, not yet built · sc-4022',
} as const;

const DAY_NOW = '2026-11-05T09:00:00Z';
const COMING = { recorded: { answer: 'coming', on: '2026-10-27' } } as const;
const RECORDED = { view: { kind: 'recorded', same: false } } as const;
const CLOSED = { view: { kind: 'closed' } } as const;
const ON_THE_DAY: Partial<Visit> = { day: 'onTheDay', now: DAY_NOW, replyBy: null };
const HAPPENING: Partial<Visit> = { day: 'onTheDay', now: LIVE_NOW, replyBy: null, started: true };
const AFTER: Partial<Visit> = {
  day: 'after',
  now: '2026-11-07T16:00:00Z',
  started: true,
  ...CLOSED,
  ...COMING,
};

export const GUEST_PROGRAMME_STATES = {
  programmeBefore: {
    name: 'Before the event: planned times under the event’s details, two event days, Programme',
    starts: { programme: 'days', ...COMING, ...RECORDED },
  },
  programmeOneDay: {
    name: 'One event day, its last item at 00:30: The day',
    starts: { programme: 'oneDay', ...COMING, ...RECORDED },
  },
  programmeOnePlace: {
    name: 'One place: no place on any item',
    starts: { programme: 'onePlace', ...COMING, ...RECORDED },
  },
  programmeNone: {
    name: 'None shown to guests: no section',
    starts: { programme: 'none', ...COMING, ...RECORDED },
  },
  programmeZone: {
    name: 'A guest in another time zone: the event’s zone named',
    starts: { programme: 'days', readerZone: 'America/Sao_Paulo', ...COMING, ...RECORDED },
  },
  programmeNotAnswered: {
    name: 'Before the event, no answer yet: still shown',
    starts: { programme: 'days' },
  },
  programmeOnTheDay: {
    name: 'On the day, Coming: Your code, Where, Programme, Your answer',
    starts: { programme: 'days', ...ON_THE_DAY, ...COMING, ...RECORDED },
  },
  programmeOnTheDayTable: {
    name: 'On the day, Coming, tables shared: Your table (sc-4022’s slot) above it',
    starts: { programme: 'days', tables: true, ...ON_THE_DAY, ...COMING, ...RECORDED },
  },
  programmeNotComing: {
    name: 'On the day, Not coming: still shown, the usual order',
    starts: {
      programme: 'days',
      ...ON_THE_DAY,
      recorded: { answer: 'notComing', on: '2026-10-27' },
      ...RECORDED,
    },
  },
  programmeNotSure: {
    name: 'On the day, Not sure yet: still shown, the usual order',
    starts: {
      programme: 'days',
      ...ON_THE_DAY,
      recorded: { answer: 'notSure', on: '2026-10-27' },
      ...RECORDED,
    },
  },
  programmeHappening: {
    name: 'Happening now, Coming: expected times rounded down to 5 minutes, nothing about lateness',
    starts: { programme: 'days', ...HAPPENING, ...COMING, ...CLOSED },
  },
  programmeHappeningOneDay: {
    name: 'Happening now, one event day, Coming',
    starts: { programme: 'oneDay', ...HAPPENING, ...COMING, ...CLOSED },
  },
  programmeHappeningNotComing: {
    name: 'Happening now, Not coming: expected times under the event’s details',
    starts: {
      programme: 'days',
      ...HAPPENING,
      recorded: { answer: 'notComing', on: '2026-10-27' },
      ...CLOSED,
    },
  },
  programmeOver: {
    name: 'After the end (sc-3591): kept as a keepsake, planned times',
    starts: { programme: 'days', phase: 'over', ...AFTER },
  },
  programmeFinished: {
    name: 'Finished, with the hosts’ thank-you: kept, planned times',
    starts: { programme: 'days', phase: 'finished', ...AFTER },
  },
  programmeCalledOff: {
    name: 'Called off: no section',
    starts: { programme: 'days', phase: 'calledOff', ...COMING, ...CLOSED },
  },
  programmeFrench: {
    name: 'In French, two event days (open it at 320)',
    starts: { programme: 'days', lang: 'fr', ...COMING, ...RECORDED },
  },
  programmeFrenchOneDay: {
    name: 'In French, one event day, a start past midnight (open it at 320)',
    starts: { programme: 'oneDay', lang: 'fr', ...COMING, ...RECORDED },
  },
} satisfies Record<string, { name: string; starts: Partial<Visit> }>;

export type GuestProgrammeState = keyof typeof GUEST_PROGRAMME_STATES;

export function isGuestProgrammeState(value: string | null): value is GuestProgrammeState {
  return value != null && Object.hasOwn(GUEST_PROGRAMME_STATES, value);
}

export function guestProgrammeStarts(state: GuestProgrammeState): Partial<Visit> {
  return GUEST_PROGRAMME_STATES[state].starts as Partial<Visit>;
}

export const GUEST_PROGRAMME_PAGES: readonly { name: string; states: readonly DemoLink[] }[] = [
  {
    name: 'The day on the guest’s page (sc-3899)',
    states: (Object.keys(GUEST_PROGRAMME_STATES) as GuestProgrammeState[]).map((state) => ({
      to: `/demo/guest?state=${state}`,
      name: GUEST_PROGRAMME_STATES[state].name,
    })),
  },
];

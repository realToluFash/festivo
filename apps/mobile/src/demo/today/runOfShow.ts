import type { Moment, Now } from '../../kit/today.ts';
import type { Say } from '../today.ts';

/** One item of a track, as sc-3895's presses leave it. Times are `18:00` in the event's zone. */
export interface RunItem {
  planned: string;
  title: string;
  /** Minutes, or null when the running order sets no length. */
  length: number | null;
  phase: 'waiting' | 'now' | 'done' | 'skipped';
  started?: string;
  ended?: string;
}

export interface RunStop {
  time: string;
  title: string;
  state: 'done' | 'now' | 'next' | 'later';
}

export interface RunNow {
  happening: boolean;
  headline: string;
  /** "until 5:30 PM", "12 min over", or null for an item with no length and when nothing is Now. */
  until: string | null;
  figure: { words: string; said: string } | null;
  next: { time: string; title: string } | null;
  rail: RunStop[];
  railSaid: string;
  band: string;
}

export const RUN_STATES = [
  'on',
  'over',
  'open',
  'last',
  'between',
  'before',
  'done',
  'long',
] as const;

export type RunState = (typeof RUN_STATES)[number];

export const RAIL_STOPS = 6;

export const LONG_TITLE =
  'Drinks reception on the garden terrace with the string quartet, canapés from the Lagos kitchen and the first photographs';

/** sc-3895's event day runs 05:00 to 05:00, so 00:30 comes after 22:00 on the same track. */
const DAY_STARTS = 5 * 60;
const DAY = 24 * 60;
const minutes = (hhmm: string) =>
  (Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5)) - DAY_STARTS + DAY) % DAY;
const clockOf = (total: number) => {
  const at = (total + DAY_STARTS) % DAY;

  return `${String(Math.floor(at / 60)).padStart(2, '0')}:${String(at % 60).padStart(2, '0')}`;
};

/** Each not-started item's expected start, by sc-1404: the latest of its planned start, the expected end before it, and now. */
export function expectedStarts(items: readonly RunItem[], clock: string): Map<RunItem, number> {
  const at = minutes(clock);
  const starts = new Map<RunItem, number>();
  let end = 0;

  for (const item of items) {
    const length = item.length ?? 0;

    if (item.phase === 'skipped') continue;
    if (item.phase === 'done') end = minutes(item.ended ?? clockOf(minutes(item.planned) + length));
    else if (item.phase === 'now')
      end = Math.max(minutes(item.started ?? item.planned) + length, at);
    else {
      const start = Math.max(minutes(item.planned), end, at);

      starts.set(item, start);
      end = start + length;
    }
  }

  return starts;
}

/** Up to six stops, from the one before the anchor, with earlier ones filling in near the end. */
export function railWindow<T>(stops: readonly T[], anchor: number): T[] {
  const from = Math.max(0, Math.min(anchor - 1, stops.length - RAIL_STOPS));

  return stops.slice(from, from + RAIL_STOPS);
}

/** Each stop's label box on a rail `width` wide: centred on its stop, at most `widest`, pushed in so none overlap. */
export function railLabels(
  count: number,
  width: number,
  widest: number,
  apart: number,
): { left: number; width: number }[] {
  const box = Math.min(widest, (width - (count - 1) * apart) / count);
  const step = count > 1 ? width / (count - 1) : 0;

  return Array.from({ length: count }, (_, index) => ({
    left: Math.min(
      Math.max(index * step - box / 2, index * (box + apart)),
      width - (count - index) * box - (count - 1 - index) * apart,
    ),
    width: box,
  }));
}

const STATE_SAID: Record<RunStop['state'], string> = {
  done: 'done',
  now: 'now',
  next: 'next',
  later: 'still to come',
};

export function runNowOf(name: string, items: readonly RunItem[], clock: string, say: Say): RunNow {
  const byPlan = [...items].sort((a, b) => minutes(a.planned) - minutes(b.planned));
  const now = byPlan
    .filter((item) => item.phase === 'now')
    .sort((a, b) => minutes(a.started ?? a.planned) - minutes(b.started ?? b.planned))[0];
  const next = byPlan.find((item) => item.phase === 'waiting');
  const expected = next == null ? undefined : expectedStarts(byPlan, clock).get(next);
  const shown = byPlan.filter((item) => item.phase !== 'skipped');
  const anchor = now ?? next;
  const window = railWindow(shown, anchor == null ? shown.length : shown.indexOf(anchor));
  const rail = window.map<RunStop>((item) => ({
    time: say.hour(item.planned),
    title: item.title,
    state: item === now ? 'now' : item === next ? 'next' : item.phase === 'done' ? 'done' : 'later',
  }));
  const behind = next == null || expected == null ? null : expected - minutes(next.planned);
  const figure =
    behind == null
      ? now == null
        ? null
        : { words: 'Last item under way', said: 'Last item under way' }
      : behind <= 0
        ? { words: 'On time', said: 'On time' }
        : {
            words: `${behind} min behind`,
            said: `${behind} ${behind === 1 ? 'minute' : 'minutes'} behind`,
          };
  let until: string | null = null;

  if (now?.length != null) {
    const end = minutes(now.started ?? now.planned) + now.length;
    const over = minutes(clock) - end;

    until = over > 0 ? `${over} min over` : `until ${say.clock(clockOf(end))}`;
  }

  return {
    happening: now != null,
    headline: now?.title ?? (next == null ? 'That’s everything.' : 'Nothing is on'),
    until,
    figure,
    next:
      next == null || expected == null
        ? null
        : { time: say.clock(clockOf(expected)), title: next.title },
    rail,
    railSaid: rail
      .map((stop) => `${stop.time} ${stop.title}, ${STATE_SAID[stop.state]}`)
      .join('; '),
    band:
      now == null
        ? `Live · ${name}`
        : until == null
          ? `Now · ${now.title}`
          : `Now · ${now.title}, ${until}`,
  };
}

type Planned = readonly [planned: string, title: string, length: number | null];

const TRACK: readonly Planned[] = [
  ['13:30', 'Guests arrive', 30],
  ['14:00', 'Ceremony', 60],
  ['15:00', 'Photos', 45],
  ['15:45', 'Confetti walk', 15],
  ['16:00', 'Drinks reception', 80],
  ['17:20', 'Guests take their seats', 40],
  ['18:00', 'Dinner is served', 90],
  ['19:30', 'Speeches', null],
  ['21:00', 'Cake cutting', 15],
  ['21:30', 'First dance', 30],
];

const SKIPPED = 3;
const DRINKS = 4;
const SPEECHES = 7;
const LAST = 9;

const AT: Record<
  RunState,
  { clock: string; done: number; now?: readonly [number, string]; ended?: string }
> = {
  on: { clock: '16:40', done: DRINKS, now: [DRINKS, '16:10'] },
  over: { clock: '17:42', done: DRINKS, now: [DRINKS, '16:10'] },
  long: { clock: '16:40', done: DRINKS, now: [DRINKS, '16:10'] },
  between: { clock: '17:38', done: DRINKS + 1, ended: '17:35' },
  before: { clock: '13:10', done: 0 },
  open: { clock: '20:05', done: SPEECHES, now: [SPEECHES, '19:40'] },
  last: { clock: '21:50', done: LAST, now: [LAST, '21:35'] },
  done: { clock: '22:30', done: TRACK.length },
};

export function trackAt(state: RunState): { clock: string; items: RunItem[] } {
  const { clock, done, now, ended } = AT[state];

  return {
    clock,
    items: TRACK.map(([planned, title, length], index): RunItem => {
      const item: RunItem = {
        planned,
        title: state === 'long' && index === DRINKS ? LONG_TITLE : title,
        length,
        phase: 'waiting',
      };

      if (index === SKIPPED && done > SKIPPED) return { ...item, phase: 'skipped' };
      if (now != null && index === now[0]) return { ...item, phase: 'now', started: now[1] };
      if (index < done)
        return index === done - 1 && ended != null
          ? { ...item, phase: 'done', ended }
          : { ...item, phase: 'done' };

      return item;
    }),
  };
}

export function isRunState(name: string | undefined): name is RunState {
  return RUN_STATES.some((state) => state === name);
}

export interface RunMoment extends Moment {
  now: Now;
  run: RunNow;
  /** Off until sc-29978 gives Now an arrived figure. */
  arrived: boolean;
}

export function withRun(
  moment: Moment,
  state: RunState,
  arrived: boolean,
  say: Say,
): RunMoment | null {
  if (moment.now == null || !moment.full) return null;

  const { clock, items } = trackAt(state);

  return {
    ...moment,
    time: clock,
    now: moment.now,
    run: runNowOf(moment.now.name, items, clock, say),
    arrived,
  };
}

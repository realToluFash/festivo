import { hourContext, todayRailWindow } from '@soirely/domain';
import type { TFunction } from 'i18next';

import { type RunNow as ShownRun, type RunStop, railSaid } from '../components/todayRun.ts';

import { writtenTime } from './clock.ts';

/** The app's `now=` states on the web's Today (sc-61017): the same track, the same moments, so the two demos read alike. */
export const NOW_STATES = [
  'on',
  'over',
  'open',
  'last',
  'between',
  'before',
  'done',
  'long',
] as const;

export type NowState = (typeof NOW_STATES)[number];

export function isNowState(raw: string | null): raw is NowState {
  return NOW_STATES.some((state) => state === raw);
}

export const NOW_STATE_NAMES: Record<NowState, string> = {
  on: 'an item Now, until 17:30, 10 min behind',
  over: 'an item Now, past its end, min over',
  open: 'an item with no length, no until line',
  last: 'the last item Now, Last item under way, no Next',
  between: 'Nothing is on, between two items',
  before: 'Nothing is on, before the first item',
  done: 'That’s everything.',
  long: 'an item title of 120 characters',
};

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

export const LONG_TITLE =
  'Drinks reception on the garden terrace with the string quartet, canapés from the Lagos kitchen and the first photographs';

/** An event day runs 05:00 to 05:00, so 00:30 comes after 22:00 on the same track. */
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

export interface RunNow {
  title: string | null;
  everything: boolean;
  until: { kind: 'until'; time: string } | { kind: 'over'; minutes: number } | null;
  figure: { kind: 'onTime' } | { kind: 'behind'; minutes: number } | { kind: 'last' } | null;
  next: { time: string; title: string } | null;
  rail: RunStop[];
}

/** sc-29875's Now for one track at one moment, in the app's order: the item Now first, then the earliest Next, then the last to finish. */
export function runNowOf(items: readonly RunItem[], clock: string): RunNow {
  const byPlan = [...items].sort((a, b) => minutes(a.planned) - minutes(b.planned));
  const now = byPlan
    .filter((item) => item.phase === 'now')
    .sort((a, b) => minutes(a.started ?? a.planned) - minutes(b.started ?? b.planned))[0];
  const next = byPlan.find((item) => item.phase === 'waiting');
  const expected = next == null ? undefined : expectedStarts(byPlan, clock).get(next);
  const shown = byPlan.filter((item) => item.phase !== 'skipped');
  const anchor = now ?? next;
  const window = todayRailWindow(shown, anchor == null ? shown.length : shown.indexOf(anchor));
  const behind = next == null || expected == null ? null : expected - minutes(next.planned);
  let until: RunNow['until'] = null;

  if (now?.length != null) {
    const end = minutes(now.started ?? now.planned) + now.length;
    const over = minutes(clock) - end;

    until = over > 0 ? { kind: 'over', minutes: over } : { kind: 'until', time: clockOf(end) };
  }

  return {
    title: now?.title ?? null,
    everything: now == null && next == null,
    until,
    figure:
      behind == null
        ? now == null
          ? null
          : { kind: 'last' }
        : behind <= 0
          ? { kind: 'onTime' }
          : { kind: 'behind', minutes: behind },
    next: next == null || expected == null ? null : { time: clockOf(expected), title: next.title },
    rail: window.map((item) => ({
      time: item.planned,
      title: item.title,
      state:
        item === now ? 'now' : item === next ? 'next' : item.phase === 'done' ? 'done' : 'later',
    })),
  };
}

type Planned = readonly [planned: string, title: string, length: number | null];

/** The app demo's wedding day 2 (apps/mobile/src/demo/today/runOfShow.ts), ten items, the fourth skipped once passed. */
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
  NowState,
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

export function trackAt(state: NowState): { clock: string; items: RunItem[] } {
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

/** The demo's moment in the product's words, from the web's catalogue, so the demo and Today say the same. */
export function runWordsOf(run: RunNow, locale: string, t: TFunction): ShownRun {
  const clock = (hhmm: string) => writtenTime(hhmm, locale);
  const rail = run.rail.map((stop) => ({ ...stop, time: clock(stop.time) }));
  let until: string | null = null;
  let untilSaid: string | null = null;

  if (run.until?.kind === 'over') {
    until = t('today.runOver', { count: run.until.minutes });
    untilSaid = t('today.runOverSaid', { count: run.until.minutes });
  } else if (run.until != null) {
    const time = clock(run.until.time);

    until = t('today.runUntil', { time, ...hourContext(time) });
  }

  return {
    headline: run.title ?? (run.everything ? t('night.everything') : t('night.nothingOn')),
    until,
    untilSaid,
    figure:
      run.figure == null
        ? null
        : run.figure.kind === 'behind'
          ? {
              words: t('runView.behind', { count: run.figure.minutes }),
              said: t('today.runBehindSaid', { count: run.figure.minutes }),
            }
          : {
              words: t(run.figure.kind === 'onTime' ? 'runView.onTime' : 'runView.last'),
              said: t(run.figure.kind === 'onTime' ? 'runView.onTime' : 'runView.last'),
            },
    next: run.next == null ? null : { time: clock(run.next.time), title: run.next.title },
    rail,
    railSaid: railSaid(rail, t),
    track: null,
  };
}

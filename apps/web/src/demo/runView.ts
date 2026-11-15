import type { DemoLink } from './settings.ts';

/** The run view (sc-1404, RunOfShow.dc.html on page e33): each track's planned and expected times, how far behind it runs, fixed times and their collisions. */
export const RUN_EVENT = 'evt-wed-4';

export type Phase = 'waiting' | 'now' | 'done';

export interface RunItem {
  id: string;
  planned: string;
  title: string;
  /** Minutes, or null when the schedule sets no length. */
  length: number | null;
  owner: string | null;
  fixed: boolean;
  phase: Phase;
  started?: string;
  ended?: string;
}

export interface Track {
  id: string;
  name: string;
  items: readonly RunItem[];
}

export interface Run {
  clock: string;
  tracks: readonly Track[];
}

export type Figure =
  { kind: 'onTime' } | { kind: 'behind'; minutes: number } | { kind: 'last' } | { kind: 'done' };

export interface Row {
  item: RunItem;
  second: { kind: 'expected' | 'started'; time: string } | null;
  lasts: string;
  before: string | null;
}

export interface TrackView {
  track: Track;
  rows: readonly Row[];
  figure: Figure;
  collisions: readonly string[];
  now: RunItem | null;
  next: { item: RunItem; expected: string } | null;
  then: readonly Row[];
}

export const RW = {
  title: 'Run of show',
  sub: 'Every time still to come moves with the night. Planned times change only when you edit the schedule.',
  columns: ['Starts', 'Lasts', 'Item', 'Owner', ''] as const,
  noLength: 'No length set',
  noOwner: 'No owner yet',
  fixed: 'Fixed time',
  start: 'Start',
  finish: 'Finish',
  now: 'Now',
  done: 'Done',
  next: 'Next',
  then: 'Then',
  nothingNow: 'Nothing is on',
  nothingThen: 'Nothing after this.',
  allDone: 'Every item on this track is done.',
  nextStep: 'Next step: start it when it begins.',
  later: 'Move the clock on 5 min',
  demoOnly: 'Demo only: the clock stands still here, so this moves it on to show times recompute.',
} as const;

const DAY_STARTS = 5 * 60;
const DAY = 24 * 60;

/** Minutes into sc-3895's event day, which runs 05:00 to 05:00, so 00:15 comes after 22:00. */
export function minutesOf(hhmm: string): number {
  return (Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5)) - DAY_STARTS + DAY) % DAY;
}

export function clockOf(total: number): string {
  const at = (((total + DAY_STARTS) % DAY) + DAY) % DAY;

  return `${String(Math.floor(at / 60)).padStart(2, '0')}:${String(at % 60).padStart(2, '0')}`;
}

export function inOrder(items: readonly RunItem[]): RunItem[] {
  return [...items].sort((a, b) => minutesOf(a.planned) - minutesOf(b.planned));
}

/** Each not-started item's expected start and every item's expected end, in minutes, by sc-1404's rules. */
export function expected(
  items: readonly RunItem[],
  clock: string,
): { starts: Map<string, number>; ends: Map<string, number> } {
  const at = minutesOf(clock);
  const ordered = inOrder(items);
  const lastStarted = ordered.reduce(
    (last, item, index) => (item.phase === 'waiting' ? last : index),
    -1,
  );
  const starts = new Map<string, number>();
  const ends = new Map<string, number>();
  let end = 0;

  ordered.forEach((item, index) => {
    const length = item.length ?? 0;

    if (item.phase === 'done') {
      end = minutesOf(item.ended ?? clockOf(minutesOf(item.started ?? item.planned) + length));
      ends.set(item.id, end);
      return;
    }
    if (item.phase === 'now') {
      end = Math.max(minutesOf(item.started ?? item.planned) + length, at);
      ends.set(item.id, end);
      return;
    }

    const start = item.fixed ? minutesOf(item.planned) : Math.max(minutesOf(item.planned), end, at);

    starts.set(item.id, start);
    ends.set(item.id, start + length);
    if (index > lastStarted) end = start + length;
  });

  return { starts, ends };
}

export function figureOf(items: readonly RunItem[], clock: string): Figure {
  const ordered = inOrder(items);

  if (ordered.every((item) => item.phase === 'done')) return { kind: 'done' };

  const next = ordered.find((item) => item.phase === 'waiting');

  if (next == null) return { kind: 'last' };
  if (ordered.every((item) => item.phase === 'waiting')) return { kind: 'onTime' };

  const behind = (expected(items, clock).starts.get(next.id) ?? 0) - minutesOf(next.planned);

  return behind <= 0 ? { kind: 'onTime' } : { kind: 'behind', minutes: behind };
}

export function figureWords(figure: Figure): string {
  return figure.kind === 'onTime'
    ? 'On time'
    : figure.kind === 'behind'
      ? `${figure.minutes} min behind`
      : figure.kind === 'last'
        ? 'Last item under way'
        : RW.allDone;
}

export function figureSaid(name: string, figure: Figure): string {
  return figure.kind === 'behind'
    ? `${name}, ${figure.minutes} ${figure.minutes === 1 ? 'minute' : 'minutes'} behind`
    : `${name}, ${figureWords(figure).toLowerCase().replace(/\.$/, '')}`;
}

/** "Cake cutting would run into Fireworks at 22:00", for each fixed-time item the one before it would still be running at. */
export function collisionsOf(items: readonly RunItem[], clock: string): string[] {
  const ordered = inOrder(items);
  const { ends } = expected(items, clock);

  return ordered.flatMap((item, index) => {
    const before = ordered[index - 1];

    if (!item.fixed || item.phase !== 'waiting' || before == null || before.phase === 'done')
      return [];

    const end = ends.get(before.id) ?? 0;

    return end > minutesOf(item.planned)
      ? [`${before.title} would run into ${item.title} at ${item.planned}`]
      : [];
  });
}

export function lastsOf(item: RunItem): string {
  return item.length == null ? RW.noLength : `${item.length} min`;
}

/** The line under a track's table: "Next: Welcome speech at about 19:40. Next step: start it when it begins." */
export function nextLine(view: TrackView): string {
  if (view.figure.kind === 'done') return RW.allDone;
  if (view.next == null) return RW.nothingThen;

  const { item, expected: at } = view.next;

  return `Next: ${item.title} at ${at === item.planned ? at : `about ${at}`}. ${RW.nextStep}`;
}

export function trackView(track: Track, clock: string): TrackView {
  const ordered = inOrder(track.items);
  const { starts } = expected(track.items, clock);
  const rows = ordered.map<Row>((item, index) => {
    const start = starts.get(item.id);
    const skipped = ordered.slice(0, index).find((one) => one.phase === 'waiting');

    return {
      item,
      second:
        item.phase !== 'waiting'
          ? { kind: 'started', time: item.started ?? item.planned }
          : start != null && start !== minutesOf(item.planned)
            ? { kind: 'expected', time: clockOf(start) }
            : null,
      lasts: lastsOf(item),
      before:
        item.phase !== 'waiting' && skipped != null ? `Started before ${skipped.title}.` : null,
    };
  });
  const now =
    ordered
      .filter((item) => item.phase === 'now')
      .sort((a, b) => minutesOf(a.started ?? a.planned) - minutesOf(b.started ?? b.planned))[0] ??
    null;
  const next = ordered.find((item) => item.phase === 'waiting') ?? null;

  return {
    track,
    rows,
    figure: figureOf(track.items, clock),
    collisions: collisionsOf(track.items, clock),
    now,
    next: next == null ? null : { item: next, expected: clockOf(starts.get(next.id) ?? 0) },
    then: rows.filter((row) => row.item.phase === 'waiting' && row.item !== next),
  };
}

export function startItem(run: Run, trackId: string, itemId: string): Run {
  return change(run, trackId, itemId, (item) => ({ ...item, phase: 'now', started: run.clock }));
}

export function finishItem(run: Run, trackId: string, itemId: string): Run {
  return change(run, trackId, itemId, (item) => ({ ...item, phase: 'done', ended: run.clock }));
}

export function later(run: Run, by: number): Run {
  return { ...run, clock: clockOf(minutesOf(run.clock) + by) };
}

function change(run: Run, trackId: string, itemId: string, to: (item: RunItem) => RunItem): Run {
  return {
    ...run,
    tracks: run.tracks.map((track) =>
      track.id !== trackId
        ? track
        : { ...track, items: track.items.map((item) => (item.id === itemId ? to(item) : item)) },
    ),
  };
}

type Plan = readonly [
  id: string,
  planned: string,
  title: string,
  length: number | null,
  owner: string | null,
  fixed?: boolean,
];

const HALL: readonly Plan[] = [
  ['arrive', '18:00', 'Guests arrive', 30, 'Tolu Bello'],
  ['welcome', '18:30', 'Welcome speech', 10, 'Ifeoma Nduka'],
  ['dinner', '18:40', 'Dinner is served', 75, 'Ronke Alade'],
  ['speeches', '19:55', 'Speeches', null, 'Ifeoma Nduka'],
  ['dance', '21:10', 'First dance', 15, null],
  ['cake', '21:30', 'Cake cutting', 30, 'Ada Nnaji'],
  ['fireworks', '22:00', 'Fireworks', 15, 'Tolu Bello', true],
  ['dancing', '22:15', 'Dancing', 120, null],
  ['lastSong', '00:15', 'Last song', 15, 'Ifeoma Nduka'],
];

const TERRACE: readonly Plan[] = [
  ['photos', '17:30', 'Photographs on the lawn', 45, 'Sade Lawal'],
  ['cocktails', '18:15', 'Cocktails at the bar', 45, 'Bola Ajayi'],
  ['sparklers', '21:50', 'Sparklers handed out', 10, 'Sade Lawal'],
];

function planned([id, at, title, length, owner, fixed = false]: Plan): RunItem {
  return { id, planned: at, title, length, owner, fixed, phase: 'waiting' };
}

type Marks = Readonly<Record<string, readonly [started: string, ended?: string]>>;

/** The terrace runs to plan: what the clock has passed is done, what it is inside has started. */
function onPlan(plans: readonly Plan[], clock: string): RunItem[] {
  const at = minutesOf(clock);

  return plans.map(planned).map((item) => {
    const from = minutesOf(item.planned);
    const to = from + (item.length ?? 0);

    if (to <= at) return { ...item, phase: 'done', started: item.planned, ended: clockOf(to) };
    if (from <= at) return { ...item, phase: 'now', started: item.planned };

    return item;
  });
}

function marked(plans: readonly Plan[], marks: Marks): RunItem[] {
  return plans.map(planned).map((item) => {
    const mark = marks[item.id];

    if (mark == null) return item;

    const [started, ended] = mark;

    return ended == null
      ? { ...item, phase: 'now', started }
      : { ...item, phase: 'done', started, ended };
  });
}

const SERVED: Marks = {
  arrive: ['18:02', '18:31'],
  welcome: ['18:33', '18:44'],
};
const DINED: Marks = { ...SERVED, dinner: ['18:45', '20:02'] };
const DANCED: Marks = {
  ...DINED,
  speeches: ['20:05', '21:05'],
  dance: ['21:08', '21:24'],
  cake: ['21:26', '21:58'],
  fireworks: ['22:00', '22:15'],
  dancing: ['22:16', '00:14'],
};

export const RUN_STATES = {
  onTime: {
    name: 'On time: Dinner under way, Speeches next at 19:55',
    clock: '19:10',
    marks: { ...SERVED, dinner: ['18:40'] },
  },
  behind: {
    name: '18 min behind: Speeches “about 20:13” under 19:55',
    clock: '19:20',
    marks: { ...SERVED, dinner: ['18:58'] },
  },
  noLength: {
    name: 'Speeches with no length set, still on at 21:13: First dance “about 21:13”',
    clock: '21:13',
    marks: { ...DINED, speeches: ['20:05'] },
  },
  collision: {
    name: 'Collision: Cake cutting would run into Fireworks at 22:00',
    clock: '21:32',
    marks: { ...DINED, speeches: ['20:05', '21:05'], dance: ['21:25'] },
  },
  outOfOrder: {
    name: 'Out of order: Dinner started before Welcome speech',
    clock: '18:55',
    marks: { arrive: ['18:02', '18:31'], dinner: ['18:42'] },
  },
  notStarted: {
    name: 'Nothing started yet: On time',
    clock: '17:20',
    marks: {},
  },
  last: {
    name: 'Last item under way',
    clock: '00:22',
    marks: { ...DANCED, lastSong: ['00:16'] },
  },
  allDone: {
    name: 'Everything done',
    clock: '00:40',
    marks: { ...DANCED, lastSong: ['00:16', '00:33'] },
  },
} as const satisfies Record<string, { name: string; clock: string; marks: Marks }>;

export type RunStateName = keyof typeof RUN_STATES;

export function isRunState(raw: string | null): raw is RunStateName {
  return raw != null && Object.hasOwn(RUN_STATES, raw);
}

export function runAt(raw: string | null): Run {
  const state = RUN_STATES[isRunState(raw) ? raw : 'onTime'];

  return {
    clock: state.clock,
    tracks: [
      { id: 'hall', name: 'Main hall', items: marked(HALL, state.marks) },
      { id: 'terrace', name: 'Garden terrace', items: onPlan(TERRACE, state.clock) },
    ],
  };
}

export function runViewAt(state?: RunStateName): string {
  return `/demo/events/${RUN_EVENT}/run${state == null ? '' : `?state=${state}`}`;
}

export const RUN_PAGES: readonly { name: string; states: readonly DemoLink[] }[] = [
  {
    name: 'The run view, one table per track',
    states: (Object.keys(RUN_STATES) as RunStateName[]).map((state) => ({
      to: runViewAt(state),
      name: RUN_STATES[state].name,
    })),
  },
];

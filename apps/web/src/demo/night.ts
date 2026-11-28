import { writtenTime } from './clock.ts';
import type { DemoLink } from './settings.ts';

/** The night screen (sc-3895, RunOfShow.dc.html's night frames on page e33): Now, Next and Later for one track, the presses, and every state the board's Tweak draws. Times are minutes from 05:00 on the event's first day. */
export const NIGHT_EVENT_NAME = 'Adaeze & Tunde’s wedding';

export type Phase = 'waiting' | 'now' | 'done' | 'skipped';

export interface NightItem {
  id: string;
  planned: number;
  title: string;
  /** Minutes, or null when the schedule sets no length. */
  length: number | null;
  owner: string | null;
  phase: Phase;
  started?: number;
  ended?: number;
  /** sc-3898: the name of the menu course this item is linked to. */
  course?: string;
}

export interface NightTrack {
  id: string;
  place: string;
  day: number;
  items: readonly NightItem[];
}

/** A losing replay: who won and when, from the 409's `superseded_by`, or, when it names nobody, the 409's own words. */
export type Lost =
  { title: string; by: string; at: number } | { title: string; by: null; said: string };

export interface Night {
  clock: number;
  today: number;
  tracks: readonly NightTrack[];
  online: boolean;
  queued: number;
  age: number;
  lost: Lost | null;
  said: string;
  manage: boolean;
  eventsManage: boolean;
  happening: boolean;
  laterDayHasItems: boolean;
}

export const NW = {
  title: 'Run of show',
  courseTag: (name: string) => `Course · ${name}`,
  now: 'Now',
  next: 'Next',
  later: 'Later',
  laterNote: 'Times are expected, not planned',
  done: 'Done',
  skip: 'Skip',
  startNow: 'Start now',
  move: 'Move',
  leaveIt: 'Leave it',
  finishFirst: 'Finish the current item first',
  nothingOn: 'Nothing is on',
  noLength: 'No length set',
  noOwner: 'No owner',
  onTime: 'On time',
  notStarted: 'Not started',
  skipped: 'Skipped',
  everything: 'That’s everything.',
  endNow: 'End now',
  tryNow: 'Try now',
  failed: 'The run of show did not load.',
  tryAgain: 'Try again',
  dismiss: 'Dismiss',
  viewOnly: 'View only',
  viewOnlyLine: 'You can follow the night here, not change it.',
  loading: 'Loading the run of show',
  nothingToday: '[Nothing is planned for today.]',
  openSchedule: '[Open the Schedule]',
  addedOnWeb: '[Items are added on the Schedule, on the web.]',
  nothingElse: (place: string) => `[Nothing else is planned for ${place}.]`,
  schedule: 'Schedule',
  live: 'Live · updated just now',
  sent: 'Connected. Presses sent.',
  moveStub:
    'sc-3894’s Move choices open here. They are that story’s and are not wired in this one.',
  readOutNote: 'Read out, polite',
  demoOnly:
    'Demo only: each press moves the sample clock on a minute, so elapsed and expected times move.',
} as const;

const DAY = 24 * 60;
const WEEKDAYS = [5, 6, 0];

/** Minutes from 05:00 on the first event day: `at('00:30')` is the first night's 00:30, `at('09:10', 1)` the next morning. */
export function at(hhmm: string, day = 0): number {
  const minutes = Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5)) - 5 * 60;

  return day * DAY + ((minutes + DAY) % DAY);
}

function wallOf(minutes: number): { day: number; hour: number; minute: number } {
  const wall = minutes + 5 * 60;

  return {
    day: Math.floor(wall / DAY),
    hour: Math.floor((wall % DAY) / 60),
    minute: wall % 60,
  };
}

export function timeIn(locale: string, minutes: number): string {
  const { hour, minute } = wallOf(minutes);

  return writtenTime(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`, locale);
}

export function weekdayIn(locale: string, day: number): string {
  const sunday = Date.UTC(2026, 10, 15);
  const weekday = WEEKDAYS[day] ?? 5;

  return new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }).format(
    sunday + weekday * DAY * 60_000,
  );
}

export function minutesWord(minutes: number): string {
  return minutes < 60
    ? `${minutes} min`
    : minutes % 60 === 0
      ? `${minutes / 60} h`
      : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

export function inOrder(items: readonly NightItem[]): NightItem[] {
  return [...items].sort((a, b) => a.planned - b.planned);
}

/** sc-1404's rules: a not-started item is expected at the latest of its planned start, the expected end of the item before it and now. Skipped takes no time, no length counts as 0, and items passed over by an out-of-order start move nothing after them. */
export function expectedStarts(items: readonly NightItem[], clock: number): Map<string, number> {
  const ordered = inOrder(items);
  const lastStarted = ordered.reduce(
    (last, item, index) => (item.phase === 'now' || item.phase === 'done' ? index : last),
    -1,
  );
  const starts = new Map<string, number>();
  let end = 0;

  ordered.forEach((item, index) => {
    const length = item.length ?? 0;

    if (item.phase === 'skipped') return;
    if (item.phase === 'done') {
      end = item.ended ?? (item.started ?? item.planned) + length;
      return;
    }
    if (item.phase === 'now') {
      end = Math.max((item.started ?? item.planned) + length, clock);
      return;
    }

    const start = Math.max(item.planned, end, clock);

    starts.set(item.id, start);
    if (index > lastStarted) end = start + length;
  });

  return starts;
}

export type Mark = 'done' | 'skipped' | 'notStarted';

export interface LaterRow {
  item: NightItem;
  mark: Mark;
  time: string | null;
}

export type Header =
  { kind: 'onTime' } | { kind: 'behind'; minutes: number } | { kind: 'finished' };

export interface Elapsed {
  words: string;
  over: boolean;
  share: number | null;
}

export interface Finished {
  sentence: string | null;
  workedOut: string | null;
  endNow: boolean;
}

export interface TrackView {
  track: NightTrack;
  label: string;
  now: NightItem | null;
  nowBefore: string | null;
  elapsed: Elapsed | null;
  lastFinished: string | null;
  next: { item: NightItem; planned: string; expected: string | null } | null;
  later: LaterRow[];
  header: Header;
  sub: string;
  finished: Finished | null;
}

export function pickerTracks(night: Night): NightTrack[] {
  return [
    ...night.tracks.filter((track) => track.day === night.today),
    ...night.tracks.filter(
      (track) => track.day < night.today && track.items.some((item) => item.phase === 'now'),
    ),
  ];
}

export function labelOf(track: NightTrack, night: Night, locale: string): string {
  return track.day === night.today
    ? track.place
    : `${track.place} · ${weekdayIn(locale, track.day)}`;
}

function isFinished(track: NightTrack): boolean {
  return track.items.every((item) => item.phase === 'done' || item.phase === 'skipped');
}

/** End now shows only once the event has nothing left to run and the viewer may end it (pm, 1 Nov, #25606). */
export function endNowShows(night: Night): boolean {
  return (
    pickerTracks(night).every(isFinished) &&
    !night.laterDayHasItems &&
    night.happening &&
    night.eventsManage &&
    night.manage
  );
}

export function finishedOf(track: NightTrack, night: Night, locale: string): Finished {
  const ran = track.items.filter((item) => item.phase === 'done');
  if (ran.length === 0) return { sentence: null, workedOut: null, endNow: endNowShows(night) };
  const last = inOrder(track.items)
    .filter((item) => item.phase !== 'skipped')
    .at(-1);
  const actual = Math.max(...ran.map((item) => item.ended ?? item.planned));
  const planned = last == null ? actual : last.planned + (last.length ?? 0);
  const delta = actual - planned;

  return {
    sentence:
      delta > 0
        ? `Finished ${delta} min behind plan.`
        : delta < 0
          ? `Finished ${-delta} min ahead of plan.`
          : 'Finished on plan.',
    workedOut: `Last item finished at ${timeIn(locale, actual)}, planned to finish at ${timeIn(locale, planned)}.`,
    endNow: endNowShows(night),
  };
}

export function trackView(night: Night, track: NightTrack, locale: string): TrackView {
  const ordered = inOrder(track.items);
  const starts = expectedStarts(track.items, night.clock);
  const now =
    ordered
      .filter((item) => item.phase === 'now')
      .sort((a, b) => (a.started ?? a.planned) - (b.started ?? b.planned))[0] ?? null;
  const next = ordered.find((item) => item.phase === 'waiting') ?? null;
  const after = next == null ? [] : ordered.slice(ordered.indexOf(next) + 1);
  const later = after
    .filter((item) => item !== now)
    .map<LaterRow>((item) => ({
      item,
      mark: item.phase === 'skipped' ? 'skipped' : item.phase === 'waiting' ? 'notStarted' : 'done',
      time:
        item.phase === 'skipped'
          ? null
          : item.phase === 'waiting'
            ? timeIn(locale, starts.get(item.id) ?? item.planned)
            : `started ${timeIn(locale, item.started ?? item.planned)}`,
    }));
  const passed =
    now == null
      ? null
      : ordered.find((item) => item.phase === 'waiting' && item.planned < now.planned);
  const nextAt = next == null ? null : (starts.get(next.id) ?? next.planned);
  const behind = next == null || nextAt == null ? 0 : nextAt - next.planned;
  const doneCount = track.items.filter((item) => item.phase === 'done').length;
  const lastRun = ordered.filter((item) => item.phase !== 'skipped').at(-1);
  const endsAt =
    lastRun == null
      ? null
      : lastRun.phase === 'waiting'
        ? (starts.get(lastRun.id) ?? lastRun.planned) + (lastRun.length ?? 0)
        : lastRun.phase === 'now'
          ? Math.max((lastRun.started ?? lastRun.planned) + (lastRun.length ?? 0), night.clock)
          : (lastRun.ended ?? lastRun.planned);
  const recent = ordered
    .filter((item) => item.phase === 'done' && item.ended != null)
    .sort((a, b) => (b.ended ?? 0) - (a.ended ?? 0))[0];
  const finished = now == null && next == null;

  return {
    track,
    label: labelOf(track, night, locale),
    now,
    nowBefore: passed == null ? null : `Started before ${passed.title}.`,
    elapsed: now == null ? null : elapsedOf(now, night.clock),
    lastFinished:
      recent == null ? null : `${recent.title} finished at ${timeIn(locale, recent.ended ?? 0)}.`,
    next:
      next == null
        ? null
        : {
            item: next,
            planned: timeIn(locale, next.planned),
            expected: nextAt === next.planned ? null : timeIn(locale, nextAt ?? next.planned),
          },
    later,
    header: finished
      ? { kind: 'finished' }
      : behind > 0
        ? { kind: 'behind', minutes: behind }
        : { kind: 'onTime' },
    sub: `${doneCount} of ${track.items.length} done${endsAt == null || finished ? '' : ` · ends about ${timeIn(locale, endsAt)}`}`,
    finished: finished ? finishedOf(track, night, locale) : null,
  };
}

export function elapsedOf(item: NightItem, clock: number): Elapsed {
  const ran = Math.max(0, clock - (item.started ?? item.planned));

  if (item.length == null) return { words: minutesWord(ran), over: false, share: null };
  if (ran > item.length)
    return { words: `+${minutesWord(ran - item.length)} over`, over: true, share: 1 };

  return { words: minutesWord(ran), over: false, share: item.length === 0 ? 1 : ran / item.length };
}

export function headerWords(header: Header): string | null {
  return header.kind === 'onTime'
    ? NW.onTime
    : header.kind === 'behind'
      ? `${minutesWord(header.minutes)} behind`
      : null;
}

export function nextSaid(next: NonNullable<TrackView['next']>): string {
  return next.expected == null ? next.planned : `${next.planned}, about ${next.expected}`;
}

export function queuedWords(count: number): string {
  return `${count} ${count === 1 ? 'press' : 'presses'} waiting to send.`;
}

/** Each press moves the sample clock on a minute, clears a losing replay's alert and, offline, adds to the count. */
function pressed(night: Night, tracks: readonly NightTrack[], said: string): Night {
  return {
    ...night,
    clock: night.clock + 1,
    tracks,
    lost: null,
    queued: night.online ? night.queued : night.queued + 1,
    said,
  };
}

function change(
  night: Night,
  trackId: string,
  itemId: string,
  to: (item: NightItem) => NightItem,
): NightTrack[] {
  return night.tracks.map((track) =>
    track.id !== trackId
      ? track
      : { ...track, items: track.items.map((item) => (item.id === itemId ? to(item) : item)) },
  );
}

function titleOf(night: Night, trackId: string, itemId: string): string {
  return (
    night.tracks.find((t) => t.id === trackId)?.items.find((i) => i.id === itemId)?.title ?? ''
  );
}

export function pressDone(night: Night, trackId: string, itemId: string): Night {
  const tracks = change(night, trackId, itemId, (item) => ({
    ...item,
    phase: 'done',
    ended: night.clock,
  }));
  const after = tracks.find((t) => t.id === trackId);
  const next = after == null ? null : inOrder(after.items).find((item) => item.phase === 'waiting');
  const title = titleOf(night, trackId, itemId);

  return pressed(
    night,
    tracks,
    next == null ? `${title} done.` : `${title} done. Next: ${next.title}.`,
  );
}

export function pressSkip(night: Night, trackId: string, itemId: string): Night {
  const tracks = change(night, trackId, itemId, (item) => {
    const { started: _started, ended: _ended, ...rest } = item;

    return { ...rest, phase: 'skipped' };
  });

  return pressed(night, tracks, `${titleOf(night, trackId, itemId)} skipped.`);
}

export function pressStart(night: Night, trackId: string, itemId: string): Night {
  const track = night.tracks.find((t) => t.id === trackId);

  if (track == null || track.items.some((item) => item.phase === 'now')) return night;

  const tracks = change(night, trackId, itemId, (item) => ({
    ...item,
    phase: 'now',
    started: night.clock,
  }));

  return pressed(night, tracks, `${titleOf(night, trackId, itemId)} started.`);
}

export function tryNow(night: Night): Night {
  return { ...night, online: true, queued: 0, age: 0, said: NW.sent };
}

export function dismiss(night: Night): Night {
  return { ...night, lost: null };
}

type Plan = readonly [
  id: string,
  planned: string,
  title: string,
  length: number | null,
  owner: string | null,
];

const BALLROOM: readonly Plan[] = [
  ['arrive', '18:00', 'Guests arrive', 30, 'Tolu Bello'],
  ['dinner', '18:30', 'Dinner is served', 75, 'Ronke Alade'],
  ['speeches', '19:45', 'Speeches', 40, 'Ifeoma Nduka'],
  ['dance', '20:30', 'First dance', 15, null],
  ['cake', '20:45', 'Cake cutting', 20, 'Ada Nnaji'],
  ['set', '21:05', 'The band’s first set', 60, 'Kunle Ade'],
  ['bouquet', '22:05', 'Bouquet toss', 10, 'Sade Lawal'],
  ['dancing', '22:15', 'Dancing', null, null],
  ['lastSong', '00:15', 'Last song', 15, 'Ifeoma Nduka'],
];

const FOYER: readonly Plan[] = [
  ['booth', '19:00', 'Photo booth', 120, 'Sade Lawal'],
  ['bar', '23:30', 'Late bar', 60, 'Bola Ajayi'],
  ['carriages', '00:30', 'Carriages', 45, 'Bola Ajayi'],
];

const BRUNCH: readonly Plan[] = [
  ['brunch', '10:00', 'Brunch is served', 90, 'Ronke Alade'],
  ['toast', '11:30', 'Farewell toast', 10, 'Ifeoma Nduka'],
];

const GARDEN: readonly Plan[] = [['croquet', '11:00', 'Croquet on the lawn', 60, 'Sade Lawal']];

type Marks = Readonly<Record<string, readonly [started: string, ended?: string] | 'skipped'>>;
type Courses = Readonly<Record<string, string>>;

function planned(
  plans: readonly Plan[],
  marks: Marks,
  day = 0,
  courses: Courses = {},
): NightItem[] {
  return plans.map(([id, time, title, length, owner]) => {
    const course = courses[id];
    const item: NightItem = {
      id,
      planned: at(time, day),
      title,
      length,
      owner,
      phase: 'waiting',
      ...(course == null ? {} : { course }),
    };
    const mark = marks[id];

    if (mark == null) return item;
    if (mark === 'skipped') return { ...item, phase: 'skipped' };

    const [started, ended] = mark;

    return ended == null
      ? { ...item, phase: 'now', started: at(started, day) }
      : { ...item, phase: 'done', started: at(started, day), ended: at(ended, day) };
  });
}

const DINED: Marks = {
  arrive: ['18:02', '18:31'],
  dinner: ['18:33', '19:48'],
};
const DANCED: Marks = {
  ...DINED,
  speeches: ['19:50', '20:28'],
  dance: ['20:31', '20:46'],
  cake: ['20:47', '21:05'],
  set: ['21:06', '22:08'],
  bouquet: ['22:09', '22:17'],
  dancing: ['22:18', '00:20'],
};
const FOYER_RUN: Marks = { booth: ['19:00', '21:00'], bar: ['23:30', '00:30'] };
const FOYER_DONE: Marks = { ...FOYER_RUN, carriages: ['00:31', '01:10'] };

interface Scene {
  name: string;
  clock: string;
  hall: Marks;
  foyer?: Marks;
  day?: number;
  online?: boolean;
  queued?: number;
  lost?: Lost;
  manage?: boolean;
  chosen?: string;
  said?: string;
  courses?: Courses;
}

const LINKED: Courses = { dinner: 'Starter', cake: 'Dessert' };

const SPEAKING: Marks = { ...DINED, speeches: ['19:50'] };
const GAP: Marks = { ...DINED, speeches: ['19:50', '20:28'] };

export const NIGHT_STATES = {
  populated: { name: 'Speeches on, First dance next on plan', clock: '20:02', hall: SPEAKING },
  behind: {
    name: '12 min behind: First dance “about 20:42”',
    clock: '20:20',
    hall: { ...DINED, speeches: ['20:02'] },
  },
  gap: {
    name: 'Nothing is on: Speeches finished, First dance’s Start now',
    clock: '20:29',
    hall: GAP,
    said: 'Speeches done. Next: First dance.',
  },
  running_over: { name: 'Speeches +4 min over', clock: '20:34', hall: SPEAKING },
  later_chosen_busy: {
    name: 'Cake cutting chosen while Speeches is on',
    clock: '20:02',
    hall: SPEAKING,
    chosen: 'cake',
  },
  later_chosen_free: {
    name: 'Cake cutting chosen while nothing is on',
    clock: '20:29',
    hall: GAP,
    chosen: 'cake',
  },
  later_started: {
    name: 'Cake cutting started out of order: First dance stays Next',
    clock: '20:35',
    hall: { ...GAP, cake: ['20:31'] },
    said: 'Cake cutting started.',
  },
  later_started_done: {
    name: 'Cake cutting done, back in Later; First dance’s Start now',
    clock: '20:52',
    hall: { ...GAP, cake: ['20:31', '20:51'] },
    said: 'Cake cutting done. Next: First dance.',
  },
  later_skipped: {
    name: 'Cake cutting skipped from Later',
    clock: '20:03',
    hall: { ...SPEAKING, cake: 'skipped' },
    said: 'Cake cutting skipped.',
  },
  offline: {
    name: 'Offline: 2 presses waiting to send, Try now',
    clock: '20:02',
    hall: SPEAKING,
    online: false,
    queued: 2,
  },
  replay_lost: {
    name: 'A losing replay: Already started by Ifeoma Nduka',
    clock: '20:33',
    hall: { ...GAP, dance: ['20:31'] },
    lost: { title: 'First dance', by: 'Ifeoma Nduka', at: at('20:31') },
  },
  replay_lost_unnamed: {
    name: 'A losing replay that names nobody: the 409’s own words',
    clock: '20:06',
    hall: SPEAKING,
    lost: {
      title: 'First dance',
      by: null,
      said: 'This item has not started yet, so it cannot be done.',
    },
  },
  read_only: {
    name: 'View only (run_of_show.read)',
    clock: '20:02',
    hall: SPEAKING,
    manage: false,
  },
  end_behind: {
    name: 'That’s everything: 12 min behind plan, End now',
    clock: '01:15',
    hall: { ...DANCED, lastSong: ['00:27', '00:42'] },
    foyer: FOYER_DONE,
  },
  end_ahead: {
    name: 'That’s everything: 6 min ahead of plan, End now',
    clock: '01:15',
    hall: { ...DANCED, lastSong: ['00:20', '00:24'] },
    foyer: FOYER_DONE,
  },
  end_on_plan: {
    name: 'That’s everything: on plan, End now',
    clock: '01:15',
    hall: { ...DANCED, lastSong: ['00:20', '00:30'] },
    foyer: FOYER_DONE,
  },
  end_other_running: {
    name: 'Ballroom finished while the Foyer’s Carriages is Now: no End now',
    clock: '00:45',
    hall: { ...DANCED, lastSong: ['00:27', '00:42'] },
    foyer: { ...FOYER_RUN, carriages: ['00:31'] },
  },
  course_now: {
    name: 'Course: Dinner is served is Now, linked to Starter',
    clock: '18:44',
    hall: { arrive: ['18:02', '18:31'], dinner: ['18:33'] },
    courses: LINKED,
  },
  course_later: {
    name: 'Course: Cake cutting in Later, linked to Dessert',
    clock: '20:02',
    hall: SPEAKING,
    courses: LINKED,
  },
  course_next: {
    name: 'Course: Cake cutting Next, linked to Dessert',
    clock: '20:44',
    hall: { ...GAP, dance: ['20:31', '20:44'] },
    courses: LINKED,
  },
  course_long: {
    name: 'Course: a long course name cut short beside the title',
    clock: '18:44',
    hall: { arrive: ['18:02', '18:31'], dinner: ['18:33'] },
    courses: {
      dinner: 'Plat principal : filet de bœuf et purée de patates douces',
      cake: 'Sobremesa: bolo de casamento com doce de leite e frutas',
    },
  },
  picker_earlier_day: {
    name: 'Saturday 09:10: Friday’s Foyer still Now, “Foyer · Friday” in the picker',
    clock: '09:10',
    hall: {},
    foyer: { ...FOYER_RUN, bar: ['23:30'] },
    day: 1,
  },
} as const satisfies Record<string, Scene>;

export const NIGHT_EXTRA_STATES = ['loading', 'empty_track'] as const;

export type NightStateName = keyof typeof NIGHT_STATES;
export type NightState = NightStateName | (typeof NIGHT_EXTRA_STATES)[number];

export function isNightState(raw: string | null | undefined): raw is NightState {
  return (
    raw != null &&
    (Object.hasOwn(NIGHT_STATES, raw) || (NIGHT_EXTRA_STATES as readonly string[]).includes(raw))
  );
}

export interface NightStart {
  night: Night;
  trackId: string;
  chosen: string | null;
  menuOpen: boolean;
  loading: boolean;
}

export function nightAt(
  raw: string | null | undefined,
  { oneTrack = false, as }: { oneTrack?: boolean; as?: string | undefined } = {},
): NightStart {
  const reader = as === 'reader';
  const name: NightState = isNightState(raw) ? raw : 'populated';
  const scene: Scene =
    name === 'loading' || name === 'empty_track' ? NIGHT_STATES.populated : NIGHT_STATES[name];
  const day = scene.day ?? 0;
  const tracks: NightTrack[] =
    name === 'empty_track'
      ? []
      : day === 1
        ? [
            { id: 'brunch', place: 'Ballroom', day: 1, items: planned(BRUNCH, {}, 1) },
            { id: 'garden', place: 'Garden', day: 1, items: planned(GARDEN, {}, 1) },
            { id: 'foyer', place: 'Foyer', day: 0, items: planned(FOYER, scene.foyer ?? {}) },
          ]
        : [
            {
              id: 'hall',
              place: 'Ballroom',
              day: 0,
              items: planned(BALLROOM, scene.hall, 0, scene.courses),
            },
            ...(oneTrack
              ? []
              : [
                  { id: 'foyer', place: 'Foyer', day: 0, items: planned(FOYER, scene.foyer ?? {}) },
                ]),
          ];

  return {
    night: {
      clock: at(scene.clock, day),
      today: day,
      tracks,
      online: scene.online ?? true,
      queued: scene.queued ?? 0,
      age: scene.online === false ? 2 : 0,
      lost: scene.lost ?? null,
      said: scene.said ?? '',
      manage: !reader && (scene.manage ?? true),
      eventsManage: !reader && as !== 'no-events-manage' && (scene.manage ?? true),
      happening: true,
      laterDayHasItems: false,
    },
    trackId: name === 'end_other_running' ? 'hall' : (tracks[0]?.id ?? ''),
    chosen: scene.chosen ?? null,
    menuOpen: name === 'picker_earlier_day',
    loading: name === 'loading',
  };
}

const ORDER: readonly NightState[] = [
  ...(Object.keys(NIGHT_STATES) as NightStateName[]),
  ...NIGHT_EXTRA_STATES,
];

const NAMES: Record<(typeof NIGHT_EXTRA_STATES)[number], string> = {
  loading: 'Loading: a skeleton of Now, Next and Later',
  empty_track: 'A day with nothing on it: [Nothing is planned for today.]',
};

export function stateName(state: NightState): string {
  return state === 'loading' || state === 'empty_track' ? NAMES[state] : NIGHT_STATES[state].name;
}

export const NIGHT_EVENT = 'evt-wed-4';

export function nightAtUrl(state?: NightState, extra = ''): string {
  const query = [state == null ? '' : `state=${state}`, extra]
    .filter((part) => part !== '')
    .join('&');

  return `/demo/events/${NIGHT_EVENT}/night${query === '' ? '' : `?${query}`}`;
}

export const NIGHT_PAGES: readonly { name: string; states: readonly DemoLink[] }[] = [
  {
    name: 'The night: Now and Next beside Later, a docked panel for a chosen row',
    states: ORDER.map((state) => ({
      to: nightAtUrl(state),
      name: `${state} · ${stateName(state)}`,
    })),
  },
  {
    name: 'The track picker, the reader’s locale, and who may end the night',
    states: [
      { to: nightAtUrl('populated', 'tracks=one'), name: 'One track: the plain place name' },
      {
        to: nightAtUrl('picker_earlier_day', 'locale=fr-FR'),
        name: 'fr-FR: “Foyer · vendredi”, times on the 24-hour clock',
      },
      { to: nightAtUrl('populated', 'as=reader'), name: 'Read only (run_of_show.read)' },
      {
        to: nightAtUrl('course_long', 'locale=fr-FR'),
        name: 'sc-3898: a long course name in fr-FR, cut short beside the title',
      },
      {
        to: nightAtUrl('course_long', 'locale=pt-BR'),
        name: 'sc-3898: a long course name in pt-BR, cut short beside the title',
      },
      {
        to: nightAtUrl('end_behind', 'as=no-events-manage'),
        name: 'end_behind without events.manage: no End now',
      },
    ],
  },
];

/** sc-65646: offline, moving to another area keeps the event this tab loaded, and coming back keeps the night and its count. */
export const NIGHT_KEPT_PAGES: readonly { name: string; states: readonly DemoLink[] }[] = [
  {
    name: 'Offline, another area keeps the event, and the night keeps its count',
    states: [
      {
        to: nightAtUrl(undefined, 'tab=fresh'),
        name: 'Online: Lose the connection, press Done, open Guests, then Schedule > Run of show. Guests shows its list if it loaded first in this tab, its own failure line if not',
      },
      {
        to: nightAtUrl('offline'),
        name: 'Loaded, then offline with 2 presses waiting: open Overview or Guests, come back',
      },
      {
        to: `/demo/events/${NIGHT_EVENT}?tab=offline`,
        name: 'A link opened offline, never loaded in this tab: The event did not load',
      },
    ],
  },
];

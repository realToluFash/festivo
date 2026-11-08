import { writtenTime } from './clock.ts';
import type { Load } from './members.ts';
import { SAMPLE } from './rules.ts';
import { VIEWERS, type Viewer } from './settings.ts';

export const PERIODS = ['Off', '30 days', '90 days', '180 days', '365 days'] as const;
export type Period = (typeof PERIODS)[number];
export type OnPeriod = Exclude<Period, 'Off'>;

export const ON_PERIODS: readonly OnPeriod[] = ['30 days', '90 days', '180 days', '365 days'];

const DAY_MS = 24 * 60 * 60 * 1000;
const NOTICE_MS = 7 * DAY_MS;
const DAYS: Record<OnPeriod, number> = {
  '30 days': 30,
  '90 days': 90,
  '180 days': 180,
  '365 days': 365,
};

/** When it was ended, or its scheduled `closesAt` if nobody ended it. */
export interface PastEvent {
  id: string;
  name: string;
  endedAt: string;
}

export interface Hold {
  event: PastEvent;
  by: string;
  at: string;
  reason: string;
}

export const PAST_EVENTS: readonly PastEvent[] = [
  { id: 'adunni', name: 'Adunni & Femi’s wedding', endedAt: '2026-03-14T23:00:00+01:00' },
  { id: 'lumen', name: 'Lumen Studio launch', endedAt: '2026-06-20T22:00:00+01:00' },
  { id: 'harvest', name: 'Harvest supper', endedAt: '2026-09-05T21:30:00+01:00' },
  { id: 'bisi', name: 'Bisi’s birthday', endedAt: '2026-10-10T23:30:00+01:00' },
];

const HELD_EVENT: PastEvent = {
  id: 'tola',
  name: 'Tola & Seun’s wedding',
  endedAt: '2026-02-07T23:00:00+01:00',
};

export const SAMPLE_HOLD: Hold = {
  event: HELD_EVENT,
  by: VIEWERS.julien.name,
  at: '2026-10-16T11:05:00+01:00',
  reason: 'The caterer’s claim is still open.',
};

export const LONG_HOLD: Hold = {
  ...SAMPLE_HOLD,
  reason:
    'Mesa Viva Catering’s claim MV-2026-0412 for Tola & Seun’s wedding is still open. Their lawyer has asked us to keep the whole guest list, with every name, email address and mobile number, until the claim is settled, because the dispute turns on who was served at the second sitting and which guests were moved to the overflow tables. Our insurer, Atlântico Seguros, wants the same records for its own review, reference ATS-88213. Please keep everything until both are closed.',
};

export const TOO_LONG_REASON = `${LONG_HOLD.reason.replace('Tola & Seun’s', 'Adunni & Femi’s')} Ask Folake before anyone releases it.`;

/** Each run is one instant: the instant its notice is sent, plus 7 × 24 hours. */
export function runAfter(noticeAt: string): string {
  return new Date(new Date(noticeAt).getTime() + NOTICE_MS).toISOString();
}

/** Those whose end plus the period is at or before the run's instant, less any held back. */
export function eventsInRun(
  events: readonly PastEvent[],
  period: OnPeriod,
  runAt: string,
  held: readonly Hold[],
): PastEvent[] {
  const run = new Date(runAt).getTime();

  return events
    .filter((event) => new Date(event.endedAt).getTime() + DAYS[period] * DAY_MS <= run)
    .filter((event) => !held.some((hold) => hold.event.id === event.id))
    .sort((one, other) => one.endedAt.localeCompare(other.endedAt));
}

/** The reader's own zone by sc-868's rule, or labelled UTC for an account with none. */
export type ReaderZone = 'Africa/Lagos' | 'Europe/London' | null;

function zoneWord(at: string, zone: ReaderZone): string {
  if (zone == null) return 'UTC';
  if (zone === 'Africa/Lagos') return 'WAT';

  return (
    new Intl.DateTimeFormat('en-GB', { timeZone: zone, timeZoneName: 'short' })
      .formatToParts(new Date(at))
      .find((part) => part.type === 'timeZoneName')?.value ?? 'UTC'
  );
}

function dayWords(at: string, zone: ReaderZone, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    timeZone: zone ?? 'UTC',
  }).format(new Date(at));
}

export function instantWords(at: string, zone: ReaderZone, locale: string): string {
  return `${dayWords(at, zone, locale)} at ${writtenTime(at, locale, zone ?? 'UTC')} ${zoneWord(at, zone)}`;
}

export function endedWords(event: PastEvent, zone: ReaderZone, locale: string): string {
  return `Ended ${dayWords(event.endedAt, zone, locale)}`;
}

export function nextRunLine(runAt: string, zone: ReaderZone, locale: string): string {
  return `Next run · ${instantWords(runAt, zone, locale)}`;
}

export const DATA_WORDS = {
  title: 'Delete guest data after an event',
  setting: 'Delete guest data after an event',
  howLong: 'How long',
  counted:
    'Counted from the event’s end: when it was ended, or its scheduled end if nobody ended it.',
  ownerOnly: 'Only an Owner can change this.',
  locked: 'Locked',
  contact: 'Contact Soirely about Enterprise',
  contactTold: 'Contacting Soirely has its own design.',
  choose: 'Choose a period',
  ask: 'Delete guest data?',
  turnOn: 'Turn on',
  change: 'Change',
  samePeriod: 'This is the period in force. Nothing changes.',
  emailedNow: 'Owners and Admins are emailed now.',
  emailedLater: 'Owners and Admins are emailed 7 days before any run with events in it.',
  gone: 'Erased details can’t come back.',
  emptyRun: 'No event is in this run.',
  emptyRunLine: 'It sends no notice and erases nothing.',
  holdFoot:
    'Holding an event back keeps it out of every run until an Owner or an Admin releases it.',
  holdBack: 'Hold back',
  held: 'Held back',
  release: 'Release',
  releaseFoot: 'A released event is named in the next notice and erased in that run.',
  holdTitle: 'Hold back?',
  holdLine: 'It stays out of every run until an Owner or an Admin releases it.',
  reason: 'Reason',
  reasonHelp: 'Owners and Admins see who held it, when and why. Up to 500 characters.',
  reasonBlank: 'Enter a reason. Nothing is held back without one.',
  reasonLong: 'Keep the reason to 500 characters or fewer.',
  keptFoot: 'Switched off and kept as it was. It comes back on with Enterprise.',
  heldKept: 'Kept as they were. Release comes back with Enterprise.',
  discard: 'Discard your reason?',
  keepEditing: 'Keep editing',
  discardVerb: 'Discard',
  loading: 'Loading guest data settings…',
  failed: 'We could not load guest data settings.',
  failedLine: 'Check your connection and try again.',
  tryAgain: 'Try again',
} as const;

export function heldLine(hold: Hold, zone: ReaderZone, locale: string): string {
  return `Held by ${hold.by} · ${instantWords(hold.at, zone, locale)}`;
}

/** The question's sentence, in its three wordings, true as of the run: an event can cross the period in the notice's week (pm, 8 Nov). */
export function firstRunLine(count: number, period: OnPeriod, when: string): string {
  const before = `at least ${period} before the first run, on ${when}`;

  if (count === 0) return `No event will have ended ${before}, so it erases nothing yet.`;
  if (count === 1) return `1 event will have ended ${before}, so its guests are in it.`;

  return `${count} events will have ended ${before}, so their guests are in it.`;
}

export interface Question {
  line: string;
  events: readonly PastEvent[];
  emailed: string;
  replaces: string | null;
  verb: string;
}

/** A first run with no events sends no notice, so with none the question does not say anyone is emailed now. */
export function questionOf(
  page: DataPage,
  picked: OnPeriod,
  zone: ReaderZone,
  locale: string,
): Question {
  const runAt = runAfter(page.clock);
  const events = eventsInRun(page.events, picked, runAt, page.held);

  return {
    line: firstRunLine(events.length, picked, instantWords(runAt, zone, locale)),
    events,
    emailed: events.length === 0 ? DATA_WORDS.emailedLater : DATA_WORDS.emailedNow,
    replaces:
      page.runAt == null
        ? null
        : `It replaces the run on ${instantWords(page.runAt, zone, locale)}.`,
    verb: page.period === 'Off' ? DATA_WORDS.turnOn : DATA_WORDS.change,
  };
}

export interface DataPage {
  plan: 'enterprise' | 'free';
  leftEnterpriseAt: string | null;
  period: Period;
  clock: string;
  runAt: string | null;
  run: readonly PastEvent[];
  events: readonly PastEvent[];
  held: readonly Hold[];
  said: string | null;
}

/** Turning it on or changing the period sends the notice now, so the run is 7 × 24 hours from now and replaces any noticed before. */
export function withPeriod(page: DataPage, period: OnPeriod): DataPage {
  const runAt = runAfter(page.clock);

  return {
    ...page,
    period,
    runAt,
    run: eventsInRun(page.events, period, runAt, page.held),
    said: null,
  };
}

export function turnedOff(page: DataPage): DataPage {
  return {
    ...page,
    period: 'Off',
    runAt: null,
    run: [],
    said: 'Turned off. The next run is cancelled.',
  };
}

export function isBlank(reason: string): boolean {
  return reason.trim() === '';
}

export const REASON_MOST = 500;

export function reasonFault(reason: string): 'blank' | 'long' | null {
  if (isBlank(reason)) return 'blank';

  return [...reason.trim()].length > REASON_MOST ? 'long' : null;
}

export function heldBack(page: DataPage, event: PastEvent, reason: string, by: string): DataPage {
  return {
    ...page,
    run: page.run.filter((one) => one.id !== event.id),
    held: [...page.held, { event, by, at: page.clock, reason: reason.trim() }],
    said: `Held back. ${event.name} stays out of every run until an Owner or an Admin releases it.`,
  };
}

/** A run erases only what its notice named, so a released event waits for the next notice, sent at this run's instant. */
export function released(page: DataPage, hold: Hold, zone: ReaderZone, locale: string): DataPage {
  const left = page.held.filter((one) => one.event.id !== hold.event.id);

  return {
    ...page,
    held: left,
    said:
      page.runAt == null
        ? `Released. ${hold.event.name} is no longer held back.`
        : `Released. ${hold.event.name} is named in the next notice, on ${instantWords(page.runAt, zone, locale)}, and erased in the run on ${instantWords(runAfter(page.runAt), zone, locale)}.`,
  };
}

export interface CardWords {
  says: string;
  line: string;
  step: 'choose' | 'contact' | null;
}

function runCount(count: number): string {
  if (count === 0) return 'No event is in the next run.';

  return count === 1 ? '1 event is in the next run.' : `${count} events are in the next run.`;
}

export function cardOf(
  page: DataPage,
  viewer: Pick<Viewer, 'owns'>,
  zone: ReaderZone,
  locale: string,
): CardWords {
  if (page.plan !== 'enterprise' && page.leftEnterpriseAt != null)
    return {
      says: 'Guests’ details are kept after an event',
      line: `Switched off on ${dayWords(page.leftEnterpriseAt, zone, locale)}, when ${SAMPLE.organisation} moved to the free plan. Its period and held events are kept as they were, and come back on with Enterprise.`,
      step: 'contact',
    };
  if (page.plan !== 'enterprise')
    return {
      says: 'Available on Enterprise',
      line: 'On Enterprise, an Owner sets how long guests’ details are kept after an event, and Soirely erases them on time.',
      step: 'contact',
    };
  if (page.period === 'Off')
    return {
      says: 'Guests’ details are kept after an event',
      line:
        page.said ??
        (viewer.owns
          ? 'Choose how long, and Soirely erases them on time, after a week’s notice.'
          : 'Only an Owner can turn this on.'),
      step: viewer.owns ? 'choose' : null,
    };

  return {
    says: `Guests’ details are erased ${page.period} after an event ends`,
    line: page.said ?? runCount(page.run.length),
    step: null,
  };
}

export type Refusal = 'owner_required' | 'plan_required';

export const REFUSALS: Record<Refusal, { title: string; line: string }> = {
  owner_required: { title: 'Only an Owner can change this.', line: 'Nothing changed.' },
  plan_required: { title: 'Available on Enterprise', line: 'Nothing changed.' },
};

export interface DataStart {
  load: Load;
  page: DataPage;
  asking: OnPeriod | null;
  holding: PastEvent | null;
  reason: string;
  pressed: boolean;
  refusal: Refusal | null;
  zone: ReaderZone;
}

const OFF_CLOCK = '2026-10-17T14:20:00+01:00';
const ON_CLOCK = '2026-10-19T10:12:00+01:00';
const NOTICE_AT = '2026-10-17T14:20:00+01:00';
export const LEFT_ENTERPRISE_AT = '2026-10-18T09:30:00+01:00';

const OFF_PAGE: DataPage = {
  plan: 'enterprise',
  leftEnterpriseAt: null,
  period: 'Off',
  clock: OFF_CLOCK,
  runAt: null,
  run: [],
  events: PAST_EVENTS,
  held: [],
  said: null,
};

function onPage(period: OnPeriod, held: readonly Hold[]): DataPage {
  const events = held.length === 0 ? PAST_EVENTS : [...PAST_EVENTS, HELD_EVENT];
  const runAt = runAfter(NOTICE_AT);

  return {
    ...OFF_PAGE,
    clock: ON_CLOCK,
    period,
    runAt,
    run: eventsInRun(events, period, runAt, held),
    events,
    held,
  };
}

export function dataViewerKey(as: string | null, state: string): string | null {
  return state === 'not_owner' ? VIEWERS.julien.key : as;
}

export function zoneOf(viewer: Pick<Viewer, 'key'>, state: string): ReaderZone {
  if (state === 'rt_on_utc') return null;

  return viewer.key === VIEWERS.julien.key ? 'Europe/London' : 'Africa/Lagos';
}

export const DATA_STATES = [
  'rt_off',
  'rt_locked',
  'rt_confirm',
  'rt_confirm_one',
  'rt_confirm_none',
  'rt_change',
  'rt_on',
  'rt_on_empty',
  'rt_on_utc',
  'rt_hold',
  'rt_hold_blank',
  'rt_hold_long',
  'rt_held',
  'rt_held_long',
  'not_owner',
  'rt_released',
  'rt_turned_off',
  'rt_off_held',
  'rt_off_released',
  'rt_downgraded',
  'rt_refused_owner',
  'rt_refused_plan',
  'loading',
  'failed',
] as const;

export function dataStart(state: string, viewer: Pick<Viewer, 'key'>, locale: string): DataStart {
  const zone = zoneOf(viewer, state);
  const rest = {
    load: 'loaded',
    asking: null,
    holding: null,
    reason: '',
    pressed: false,
    refusal: null,
    zone,
  } as const;
  const on = onPage('90 days', []);
  const held = onPage('90 days', [SAMPLE_HOLD]);
  const offHeld = { ...turnedOff(held), said: null };

  switch (state) {
    case 'rt_locked':
      return { ...rest, page: { ...OFF_PAGE, plan: 'free' } };
    case 'rt_confirm':
      return { ...rest, page: OFF_PAGE, asking: '90 days' };
    case 'rt_confirm_one':
      return { ...rest, page: OFF_PAGE, asking: '180 days' };
    case 'rt_confirm_none':
      return { ...rest, page: OFF_PAGE, asking: '365 days' };
    case 'rt_change':
      return { ...rest, page: on, asking: '180 days' };
    case 'rt_on':
    case 'rt_on_utc':
      return { ...rest, page: on };
    case 'rt_on_empty':
      return { ...rest, page: onPage('365 days', []) };
    case 'rt_hold':
      return { ...rest, page: on, holding: PAST_EVENTS[0] ?? null };
    case 'rt_hold_blank':
      return { ...rest, page: on, holding: PAST_EVENTS[0] ?? null, pressed: true };
    case 'rt_hold_long':
      return {
        ...rest,
        page: on,
        holding: PAST_EVENTS[0] ?? null,
        reason: TOO_LONG_REASON,
        pressed: true,
      };
    case 'rt_held':
    case 'not_owner':
      return { ...rest, page: held };
    case 'rt_held_long':
      return { ...rest, page: onPage('90 days', [LONG_HOLD]) };
    case 'rt_released':
      return { ...rest, page: released(held, SAMPLE_HOLD, zone, locale) };
    case 'rt_turned_off':
      return { ...rest, page: turnedOff(on) };
    case 'rt_off_held':
      return { ...rest, page: offHeld };
    case 'rt_off_released':
      return { ...rest, page: released(offHeld, SAMPLE_HOLD, zone, locale) };
    case 'rt_downgraded':
      return {
        ...rest,
        page: { ...held, plan: 'free', leftEnterpriseAt: LEFT_ENTERPRISE_AT, runAt: null, run: [] },
      };
    case 'rt_refused_owner':
      return { ...rest, page: OFF_PAGE, asking: '90 days', refusal: 'owner_required' };
    case 'rt_refused_plan':
      return { ...rest, page: OFF_PAGE, asking: '90 days', refusal: 'plan_required' };
    case 'loading':
    case 'failed':
      return { ...rest, load: state, page: OFF_PAGE };
    default:
      return { ...rest, page: OFF_PAGE };
  }
}

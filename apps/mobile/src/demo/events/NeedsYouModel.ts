import { wallDay } from '@soirely/domain';

import { type EventDemoState, dayNumber } from './EventsModel.ts';

export type NeedsState = Extract<EventDemoState, `needsYou${string}`>;

export function needsStateOf(state: EventDemoState | null): NeedsState | null {
  return state != null && state.startsWith('needsYou') ? (state as NeedsState) : null;
}

export const NEEDS_WORDS = {
  heading: 'Needs you',
  nothing: 'Nothing needs you',
  loading: 'Loading the dates…',
  failed: 'The dates did not load.',
  tryAgain: 'Try again',
} as const;

export function headingLabel(count: number): string {
  if (count === 0) return NEEDS_WORDS.heading;

  return `${NEEDS_WORDS.heading}, ${count} ${count === 1 ? 'thing' : 'things'}`;
}

export interface SampleMilestone {
  at: string;
  title: string;
  owner: 'you' | 'event' | 'automatic';
  area: string;
}

export interface NeedRow {
  title: string;
  due: string;
  late: boolean;
}

function dateWords(at: string, now: Date, timeZone: string, locale: string): string {
  const otherYear = wallDay(at, timeZone).slice(0, 4) !== wallDay(now, timeZone).slice(0, 4);

  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(otherYear ? { year: 'numeric' } : {}),
    timeZone,
  }).format(new Date(at));
}

/** sc-29884's forms, counted in calendar days in the event's zone, whatever zone the device is in. */
export function dueWords(
  at: string,
  now: Date,
  timeZone: string,
  locale: string,
): { words: string; late: boolean } {
  const days = dayNumber(at, timeZone) - dayNumber(now, timeZone);

  if (Date.parse(at) <= now.getTime()) {
    if (days === 0) return { words: 'Overdue', late: true };
    if (days === -1) return { words: '1 day overdue', late: true };

    return { words: `${-days} days overdue`, late: true };
  }

  if (days === 0) return { words: 'Due today', late: false };
  if (days === 1) return { words: 'Due tomorrow', late: false };

  return { words: `Due ${dateWords(at, now, timeZone, locale)}`, late: false };
}

/** A You milestone the reader's role can act on, earliest first, a tie by title in the shown language. */
export function needRows(
  milestones: readonly SampleMilestone[],
  permissions: readonly string[],
  now: Date,
  timeZone: string,
  locale: string,
): NeedRow[] {
  const byTitle = new Intl.Collator(locale);

  return milestones
    .filter((one) => one.owner === 'you' && permissions.includes(`${one.area}.manage`))
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || byTitle.compare(a.title, b.title))
    .map((one) => {
      const { words, late } = dueWords(one.at, now, timeZone, locale);

      return { title: one.title, due: words, late };
    });
}

function kitchen(at: string): SampleMilestone {
  return { at, title: 'Give final numbers to the kitchen', owner: 'you', area: 'menu' };
}

/** No area but the kitchen's returns a You milestone yet: these stand in for its other rows. */
function other(at: string, title: string, area: string): SampleMilestone {
  return { at, title, owner: 'you', area };
}

const OPEN_FOUR = [
  other('2026-11-03T23:59:00Z', 'Pay the band’s balance', 'budget'),
  other('2026-11-04T23:59:00Z', 'Seat the last 12 guests', 'seating'),
  other('2026-11-05T12:00:00Z', 'Confirm the cake', 'vendors'),
];

const OF_EVENT: SampleMilestone = {
  at: '2026-11-05T18:00:00Z',
  title: 'Adaeze & Tunde’s wedding starts',
  owner: 'event',
  area: 'events',
};

const MANAGES = ['menu.manage', 'budget.manage', 'seating.manage', 'vendors.manage'];
const ONLY_READS = ['menu.read', 'budget.read', 'seating.read', 'vendors.read'];

/** What each state's reader is given on the wedding, before it starts. Every other state has no You milestone. */
export function sampleNeeds(state: NeedsState | null): {
  milestones: readonly SampleMilestone[];
  permissions: readonly string[];
} {
  switch (state) {
    case 'needsYou':
      return {
        milestones: [OF_EVENT, ...OPEN_FOUR, kitchen('2026-11-01T23:59:00Z')],
        permissions: MANAGES,
      };
    case 'needsYouOne':
      return { milestones: [OF_EVENT, kitchen('2026-11-04T23:59:00Z')], permissions: MANAGES };
    case 'needsYouOverdue':
      return {
        milestones: [
          other('2026-11-03T09:00:00Z', 'Confirm the cake', 'vendors'),
          other('2026-11-03T09:00:00Z', 'Agree the toasts', 'seating'),
          other('2026-11-02T23:59:00Z', 'Pay the band’s balance', 'budget'),
          kitchen('2026-11-01T23:59:00Z'),
        ],
        permissions: MANAGES,
      };
    case 'needsYouGiven':
      return { milestones: [OF_EVENT, ...OPEN_FOUR], permissions: MANAGES };
    case 'needsYouReadOnly':
      return { milestones: [OF_EVENT, kitchen('2026-11-04T23:59:00Z')], permissions: ONLY_READS };
    default:
      return { milestones: [OF_EVENT], permissions: MANAGES };
  }
}

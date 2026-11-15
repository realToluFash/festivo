import { type Milestone, levelOf } from '@soirely/domain';

import { localDay } from './events.ts';

export type NeedsState =
  | 'needsYou'
  | 'needsYouOne'
  | 'needsYouOverdue'
  | 'needsYouGiven'
  | 'needsYouReadOnly'
  | 'needsYouLoading'
  | 'needsYouFailed';

export const NEEDS_WORDS = {
  heading: 'Needs you',
  nothing: 'Nothing needs you',
  loading: 'Loading the dates…',
  failed: 'The dates did not load.',
} as const;

export interface NeedRow {
  key: string;
  title: string;
  due: string;
  late: boolean;
  action: Milestone['action'];
}

const DAY = 86_400_000;

function dayNumber(moment: string | Date, timeZone: string): number {
  return Date.parse(`${localDay(moment, timeZone)}T00:00:00Z`) / DAY;
}

function dateWords(at: string, now: Date, timeZone: string, locale: string): string {
  const otherYear = localDay(at, timeZone).slice(0, 4) !== localDay(now, timeZone).slice(0, 4);

  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    ...(otherYear ? { year: 'numeric' } : {}),
    timeZone,
  }).format(new Date(at));
}

/** sc-29884's forms, counted in calendar days in the event's zone, whatever zone the reader is in. */
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

/** A You milestone the reader's role changes: the rule both Today's Needs you and the Calendar's Only what needs you take. */
export function needsMe(milestone: Milestone, permissions: readonly string[]): boolean {
  return milestone.owner === 'you' && levelOf(permissions, milestone.area) === 'change';
}

/** Earliest first, a tie by title in the shown language. */
export function dueOrder(locale: string): (a: Milestone, b: Milestone) => number {
  const byTitle = new Intl.Collator(locale);

  return (a, b) => Date.parse(a.at) - Date.parse(b.at) || byTitle.compare(a.title, b.title);
}

/** needsMe's milestones in dueOrder. A milestone has no id, so its key is its area, moment and title. */
export function needRows(
  milestones: readonly Milestone[],
  permissions: readonly string[],
  now: Date,
  timeZone: string,
  locale: string,
): NeedRow[] {
  return milestones
    .filter((one) => needsMe(one, permissions))
    .sort(dueOrder(locale))
    .map((one) => {
      const { words, late } = dueWords(one.at, now, timeZone, locale);

      return {
        key: `${one.area}|${one.at}|${one.title}`,
        title: one.title,
        due: words,
        late,
        action: one.action,
      };
    });
}

/** No area but the kitchen's returns a You milestone yet: these stand in for its other rows, with no action. */
function other(at: string, title: string, area: string): Milestone {
  return { at, title, note: null, owner: 'you', area, action: null };
}

const OPEN_THREE = [
  other('2026-11-03T23:59:00Z', 'Pay the band’s balance', 'budget'),
  other('2026-11-04T23:59:00Z', 'Seat the last 12 guests', 'seating'),
  other('2026-11-05T12:00:00Z', 'Confirm the cake', 'vendors'),
];

const MANAGES = ['menu.manage', 'budget.manage', 'seating.manage', 'vendors.manage'];
const ONLY_READS = ['menu.read', 'budget.read', 'seating.read', 'vendors.read'];

/** The wedding's other You milestones as each state link has the server return them; the kitchen's is kitchen.ts's. */
const OWED: Partial<Record<string, readonly Milestone[]>> = {
  needsYou: OPEN_THREE,
  needsYouGiven: OPEN_THREE,
  needsYouOverdue: [
    other('2026-11-03T09:00:00Z', 'Confirm the cake', 'vendors'),
    other('2026-11-03T09:00:00Z', 'Agree the toasts', 'seating'),
    other('2026-11-02T23:59:00Z', 'Pay the band’s balance', 'budget'),
  ],
};

let held: readonly Milestone[] = [];

/** A state link sets them; with no state the demo keeps what it holds, as the kitchen's date does. */
export function seedNeedsYou(state: string | null): void {
  if (state != null) held = OWED[state] ?? [];
}

export function heldNeeds(): readonly Milestone[] {
  return held;
}

export function resetNeedsYou(): void {
  held = [];
}

export function readerOf(state: NeedsState | null): readonly string[] {
  return state === 'needsYouReadOnly' ? ONLY_READS : MANAGES;
}

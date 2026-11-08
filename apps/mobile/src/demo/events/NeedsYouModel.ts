import type { Milestone } from '@soirely/domain';

import { sayIn } from '../today.ts';
import { dueOf, headLabel, isYours } from '../today/needsYou.ts';
import type { EventDemoState } from './EventsModel.ts';

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

/** Today's heading key, and the heading alone with no row. */
export function headingLabel(count: number): string {
  return count === 0 ? NEEDS_WORDS.heading : headLabel(count);
}

export interface NeedRow {
  key: string;
  title: string;
  due: string;
  late: boolean;
}

/** The new key, Today's row without the event: the page is the event's. */
export function rowLabel({ title, due }: Pick<NeedRow, 'title' | 'due'>): string {
  return `${title}, ${due}`;
}

/** Today's rule and due words, earliest first, a tie by title in the shown language. A milestone has no id, so its key is its area, moment and title. */
export function needRows(
  milestones: readonly Milestone[],
  permissions: readonly string[],
  now: Date,
  timeZone: string,
  locale: string,
): NeedRow[] {
  const byTitle = new Intl.Collator(locale);
  const { day } = sayIn(locale);

  return milestones
    .filter((one) => isYours(one, permissions))
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at) || byTitle.compare(a.title, b.title))
    .map((one) => {
      const { words, late } = dueOf(one.at, timeZone, now, day);

      return { key: `${one.area}|${one.at}|${one.title}`, title: one.title, due: words, late };
    });
}

/** No area but the kitchen's returns a You milestone yet: these stand in for its other rows. */
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

/** Each state's reader and its rows beside the wedding's timeline, whose kitchen milestone FinalNumbers seeds. */
export function sampleNeeds(state: NeedsState | null): {
  milestones: readonly Milestone[];
  permissions: readonly string[];
} {
  switch (state) {
    case 'needsYou':
    case 'needsYouGiven':
      return { milestones: OPEN_THREE, permissions: MANAGES };
    case 'needsYouOverdue':
      return {
        milestones: [
          other('2026-11-03T09:00:00Z', 'Confirm the cake', 'vendors'),
          other('2026-11-03T09:00:00Z', 'Agree the toasts', 'seating'),
          other('2026-11-02T23:59:00Z', 'Pay the band’s balance', 'budget'),
        ],
        permissions: MANAGES,
      };
    case 'needsYouReadOnly':
      return { milestones: [], permissions: ONLY_READS };
    default:
      return { milestones: [], permissions: MANAGES };
  }
}

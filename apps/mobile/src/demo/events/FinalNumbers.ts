import type { Milestone } from '@soirely/domain';

/** sc-30812 in the app: the timeline's "Give final numbers to the kitchen" on the wedding, shown as any milestone, with no action (the kitchen sheet is the web's, sc-3914). */
export const FINAL_NUMBERS_EVENT = 'evt-wed-4';

export const FINAL_NUMBERS_STATES = [
  'finalNumbers',
  'finalNumbersOverdue',
  'finalNumbersGiven',
] as const;
export type FinalNumbersState = (typeof FINAL_NUMBERS_STATES)[number];

/** sc-30692: a change since the latest copy brings back "Give the changes to the kitchen", due at the date if it came back by then, else at the start. */
export const CHANGES_STATES = ['changes_due', 'changes_overdue', 'changes_late'] as const;
export type ChangesState = (typeof CHANGES_STATES)[number];

export const FINAL_WORDS = {
  milestone: 'Give final numbers to the kitchen',
  changes: 'Give the changes to the kitchen',
  you: 'You',
  overdue: 'Overdue',
} as const;

const CHANGES_DUE: Record<ChangesState, string | null> = {
  changes_due: '2026-11-03',
  changes_overdue: '2026-11-02',
  changes_late: null,
};

const DUE: Record<FinalNumbersState, string | null> = {
  finalNumbers: '2026-11-03',
  finalNumbersOverdue: '2026-11-02',
  finalNumbersGiven: null,
};

/** The Overview's Needs you states (sc-32801) give the wedding the same milestone, so every card agrees. */
const NEEDS_YOU_DUE: Partial<Record<string, string>> = {
  needsYou: '2026-11-01',
  needsYouOne: '2026-11-04',
  needsYouOverdue: '2026-11-01',
  needsYouReadOnly: '2026-11-04',
};

/** No area but the kitchen's returns a You milestone yet: these stand in for the wedding's others in those states, with no action. */
function other(at: string, title: string, area: string): Milestone {
  return { at, title, note: null, owner: 'you', area, action: null };
}

const OPEN_THREE = [
  other('2026-11-03T23:59:00Z', 'Pay the band’s balance', 'budget'),
  other('2026-11-04T23:59:00Z', 'Seat the last 12 guests', 'seating'),
  other('2026-11-05T12:00:00Z', 'Confirm the cake', 'vendors'),
];

const NEEDS_YOU_OTHERS: Partial<Record<string, readonly Milestone[]>> = {
  needsYou: OPEN_THREE,
  needsYouGiven: OPEN_THREE,
  needsYouOverdue: [
    other('2026-11-03T09:00:00Z', 'Confirm the cake', 'vendors'),
    other('2026-11-03T09:00:00Z', 'Agree the toasts', 'seating'),
    other('2026-11-02T23:59:00Z', 'Pay the band’s balance', 'budget'),
  ],
};

let due: string | null = null;
let others: readonly Milestone[] = [];
let changes = false;
let atStart = false;

export function isFinalNumbersState(value: string | null): value is FinalNumbersState {
  return FINAL_NUMBERS_STATES.some((state) => state === value);
}

/** A state link sets the wedding's date as the server would return it: a copy recorded means no milestone. */
export function seedFinalNumbers(state: string | null): void {
  changes = isChangesState(state);
  atStart = state === 'changes_late';
  due = isChangesState(state)
    ? CHANGES_DUE[state]
    : isFinalNumbersState(state)
      ? DUE[state]
      : ((state && NEEDS_YOU_DUE[state]) ?? null);
  others = (state == null ? undefined : NEEDS_YOU_OTHERS[state]) ?? [];
}

export function isChangesState(value: string | null): value is ChangesState {
  return CHANGES_STATES.some((state) => state === value);
}

/** The kitchen's milestone as the server returns it: its title, and when it falls due (null at the event's start). */
export function kitchenOwed(eventId: string): { title: string; due: string | null } | null {
  if (eventId !== FINAL_NUMBERS_EVENT || (due == null && !atStart)) return null;

  return {
    title: changes ? FINAL_WORDS.changes : FINAL_WORDS.milestone,
    due: atStart ? null : due,
  };
}

export function othersOwed(eventId: string): readonly Milestone[] {
  return eventId === FINAL_NUMBERS_EVENT ? others : [];
}

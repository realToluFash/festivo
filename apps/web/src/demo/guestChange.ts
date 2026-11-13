import type { Visit } from './guest.ts';
import type { DemoLink } from './settings.ts';

/** sc-4330's prepared lines, one key each: the values are the ones this guest was sent. */
export type ChangeLine = 'startTime' | 'venue' | 'calledOff';

/** A change sent with a note: one entry in the page's Messages, from the moment the send went. */
export interface ChangeSent {
  at: string;
  lines: readonly ChangeLine[];
  note: string;
}

export const CHANGE_WAS = { startTime: '18:30', venue: 'Rosewood London' } as const;

export const CHANGE_NOTE =
  'The band can only start at 21:00, so we are starting the ceremony half an hour earlier. Dinner is unchanged.';

export const CHANGE_NOTE_LONG = [
  'We are so sorry to move things this late.',
  'The band can only start at 21:00, so we are starting the ceremony half an hour earlier, and Rosewood London had a flood in the ballroom on Monday, so the whole day moves to The Landmark, on Marylebone Road.',
  'Everything else is as it was: the dress code, the dinner, the speeches and the party afterwards. If the change makes the journey harder for you, write to us here and we will help with a taxi.',
  'With love, Adaeze and Tunde',
].join('\n\n');

export const CALLED_OFF_NOTE =
  'Tunde’s father is in hospital, and we cannot celebrate without him. We will be in touch about a new date. Thank you for understanding.';

/** Between the hosts' first and second messages, so the entry shows where time places it. */
const AT = '2026-11-01T16:20:00Z';
const COMING = { recorded: { answer: 'coming', on: '2026-10-27' } } as const;
const RECORDED = { view: { kind: 'recorded', same: false } } as const;
const CLOSED = { view: { kind: 'closed' } } as const;
const STARTED: ChangeSent = { at: AT, lines: ['startTime'], note: CHANGE_NOTE };

export const GUEST_CHANGE_STATES = {
  changeNote: {
    name: 'A change sent with a note: an entry among the hosts’ messages',
    starts: { ...COMING, ...RECORDED, messages: 3, change: STARTED },
  },
  changeNoteOnly: {
    name: 'The change’s note opens Messages on a page that had none',
    starts: { ...COMING, ...RECORDED, change: STARTED },
  },
  changeNoteMerged: {
    name: 'The banner’s two changes, sent once: one entry with both lines',
    starts: {
      ...COMING,
      ...RECORDED,
      messages: 3,
      change: { ...STARTED, lines: ['startTime', 'venue'] },
    },
  },
  changeNoteLong: {
    name: 'A long note, in paragraphs as the host wrote it',
    starts: {
      ...COMING,
      ...RECORDED,
      messages: 3,
      change: { at: AT, lines: ['startTime', 'venue'], note: CHANGE_NOTE_LONG },
    },
  },
  changeNoteFrench: {
    name: 'In French: Soirely’s lines in the page’s language, the note as written',
    starts: { ...COMING, ...RECORDED, messages: 3, change: STARTED, lang: 'fr' },
  },
  changeNoteCalledOff: {
    name: 'Called off with a note',
    starts: {
      phase: 'calledOff',
      ...COMING,
      ...CLOSED,
      messages: 3,
      change: { at: '2026-11-03T12:00:00Z', lines: ['calledOff'], note: CALLED_OFF_NOTE },
    },
  },
  changeNoNote: {
    name: 'A change sent with no note: nothing on the page',
    starts: { ...COMING, ...RECORDED, messages: 3 },
  },
} satisfies Record<string, { name: string; starts: Partial<Visit> }>;

export type GuestChangeState = keyof typeof GUEST_CHANGE_STATES;

export function isGuestChangeState(value: string | null): value is GuestChangeState {
  return value != null && Object.hasOwn(GUEST_CHANGE_STATES, value);
}

export function guestChangeStarts(state: GuestChangeState): Partial<Visit> {
  return GUEST_CHANGE_STATES[state].starts as Partial<Visit>;
}

export const GUEST_CHANGE_PAGES: readonly { name: string; states: readonly DemoLink[] }[] = [
  {
    name: 'A change’s note, in Messages (sc-4330)',
    states: (Object.keys(GUEST_CHANGE_STATES) as GuestChangeState[]).map((state) => ({
      to: `/demo/guest?state=${state}`,
      name: GUEST_CHANGE_STATES[state].name,
    })),
  },
];

/** The hosts' messages and the change's entry, oldest first, so the newest sits last above the box. */
export function inTimeOrder<T extends { at: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.at.localeCompare(b.at));
}

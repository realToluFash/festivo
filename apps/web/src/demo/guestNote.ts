import type { Visit } from './guest.ts';
import type { DemoLink } from './settings.ts';

const COMING = { recorded: { answer: 'coming', on: '2026-10-27' } } as const;
const RECORDED = { view: { kind: 'recorded', same: false } } as const;

export const GUEST_NOTE_STATES = {
  arrivalNote: {
    name: 'The arrival note under the Where line, before answering',
    starts: { note: 'host' },
  },
  arrivalNoteRecorded: {
    name: 'The arrival note, answered Coming',
    starts: { note: 'host', ...COMING, ...RECORDED },
  },
  arrivalNoteClosed: {
    name: 'The arrival note, answers closed',
    starts: { note: 'host', now: '2026-10-31T10:00:00Z', ...COMING, view: { kind: 'closed' } },
  },
  arrivalNoteAlone: {
    name: 'A note and no venue: on its own, no heading, no Open in maps',
    starts: { note: 'alone' },
  },
  arrivalNoteWide: {
    name: 'A note of 500 characters with no spaces (open it at 320)',
    starts: { note: 'wide' },
  },
  arrivalNoteMarkup: {
    name: 'Markup typed as text: shown as those characters',
    starts: { note: 'markup' },
  },
  arrivalNoteFrench: {
    name: 'In French: the note as the host wrote it',
    starts: { note: 'host', lang: 'fr' },
  },
  arrivalNoteNone: {
    name: 'No note: nothing in its place',
    starts: { note: 'none' },
  },
  arrivalNotePaused: {
    name: 'Paused: sc-3591’s notice, and no note',
    starts: { note: 'host', phase: 'paused', ...COMING, view: { kind: 'closed' } },
  },
} satisfies Record<string, { name: string; starts: Partial<Visit> }>;

export type GuestNoteState = keyof typeof GUEST_NOTE_STATES;

export function isGuestNoteState(value: string | null): value is GuestNoteState {
  return value != null && Object.hasOwn(GUEST_NOTE_STATES, value);
}

export function guestNoteStarts(state: GuestNoteState): Partial<Visit> {
  return GUEST_NOTE_STATES[state].starts as Partial<Visit>;
}

export const GUEST_NOTE_PAGES: readonly { name: string; states: readonly DemoLink[] }[] = [
  {
    name: 'The host’s arrival note (sc-24385)',
    states: (Object.keys(GUEST_NOTE_STATES) as GuestNoteState[]).map((state) => ({
      to: `/demo/guest?state=${state}`,
      name: GUEST_NOTE_STATES[state].name,
    })),
  },
];

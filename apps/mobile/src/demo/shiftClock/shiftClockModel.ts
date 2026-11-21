import {
  type Scheduled,
  clock,
  hoursWords,
  opensAt,
  outLimit,
  timeWords,
  weekdayOf,
} from './clock.ts';

/** The staff member's own shift (sc-3915's frame) as page 34's proposal board draws it: Saturday 17:00 to Sunday 01:00. */
export const SHIFT: Scheduled = { start: 17 * 60, end: 25 * 60 };
export const EVENT = 'Adébáyọ̀ at 60';
export const VENUE = 'Eko Hotel';
export const JOB = 'Waiter · Section B';
export const LEAD = 'Dayo Okafor';
export const PERSON = 'Grace Okon';
export const CLOCK_IN = 16 * 60 + 58;
export const CLOCK_OUT = 25 * 60 + 42;
export const LATE_OUT = 27 * 60 + 12;

export const CW = {
  yourShift: 'Your shift',
  hours: (shift: Scheduled) => `${clock(shift.start)} to ${clock(shift.end)}`,
  endsOn: (shift: Scheduled) => `Ends on ${weekdayOf(shift.end)} at ${clock(shift.end)}`,
  yourLead: 'Your lead',
  clockIn: 'Clock in',
  clockingIn: 'Clocking in…',
  clockOut: 'Clock out',
  clockingOut: 'Clocking out…',
  opensAt: (time: string) => `Clock in opens at ${time}`,
  opensLine: 'You can clock in from an hour before your shift starts.',
  readyLine: 'Records the time Soirely receives it, not your phone’s clock.',
  clockedInAt: (time: string) => `Clocked in at ${time}`,
  clockedOutAt: (time: string) => `Clocked out at ${time}`,
  stayLine: (end: string) => `Clock out when you finish, even if it’s after ${end}.`,
  inOut: (a: string, b: string) => `Clocked in ${a} · Clocked out ${b}`,
  recorded: (minutes: number) => `${hoursWords(minutes)} recorded`,
  helper:
    'If a time is wrong, tell whoever manages staff for this event. Only they can correct it.',
  closedAt: (time: string) => `Clock-in closed at ${time}, when your shift ended.`,
  closedLine: 'Ask whoever manages staff for this event to record your times.',
  alreadyIn: (time: string) => `You had already clocked in at ${time}. Nothing has changed.`,
  alreadyOut: (time: string) => `You had already clocked out at ${time}. Nothing has changed.`,
  offIn: 'Could not clock in because there is no connection. Try again when you are back online.',
  offOut: 'Could not clock out because there is no connection. Try again when you are back online.',
  browserOut: (time: string) =>
    `Clocking out signs you out of this browser. Otherwise you will be signed out at ${time}.`,
  signedOut: 'You are signed out of this browser.',
  ended: 'This link has ended. If you are working another event, you will get a new link for it.',
  nothingSaved: 'Nothing was saved on this phone.',
  restIsSc3915: 'The rest of the shift view is sc-3915’s, which has no demo yet.',
} as const;

export const CLOCK_STATES = [
  'before',
  'ready',
  'clocked_in',
  'already_in',
  'offline',
  'out_offline',
  'clocked_out',
  'already_out',
  'closed',
  'access_ended_clocked_in',
  'access_ended_clocked_out',
  'access_ended_offline',
  'access_ended_already',
] as const;

export type ClockState = (typeof CLOCK_STATES)[number];
export type Surface = 'app' | 'browser';

export const clockStateOf = (raw: string | undefined): ClockState =>
  (CLOCK_STATES as readonly string[]).includes(raw ?? '') ? (raw as ClockState) : 'ready';

export const surfaceOf = (raw: string | undefined): Surface =>
  raw === 'browser' ? 'browser' : 'app';

/** Where the card is: before or in the window, on, off, the window closed, or past the person's access. */
export type Phase = 'before' | 'ready' | 'on' | 'off' | 'closed';
export type Line = 'alreadyIn' | 'alreadyOut' | 'offIn' | 'offOut' | null;

export interface Card {
  phase: Phase;
  past: boolean;
  now: number;
  clockIn: number | null;
  clockOut: number | null;
  line: Line;
  offline: boolean;
}

const card = (over: Partial<Card>): Card => ({
  phase: 'ready',
  past: false,
  now: CLOCK_IN,
  clockIn: null,
  clockOut: null,
  line: null,
  offline: false,
  ...over,
});

const on = { phase: 'on' as const, clockIn: CLOCK_IN, now: 17 * 60 + 10 };
const off = { phase: 'off' as const, clockIn: CLOCK_IN, clockOut: CLOCK_OUT, now: CLOCK_OUT };
const pastOn = { phase: 'on' as const, past: true, clockIn: CLOCK_IN, now: 27 * 60 + 5 };
const pastOff = {
  phase: 'off' as const,
  past: true,
  clockIn: CLOCK_IN,
  clockOut: LATE_OUT,
  now: LATE_OUT,
};

export function cardOf(state: ClockState): Card {
  const cards: Record<ClockState, Card> = {
    before: card({ phase: 'before', now: 15 * 60 + 20 }),
    ready: card({}),
    clocked_in: card(on),
    already_in: card({ ...on, line: 'alreadyIn' }),
    offline: card({ line: 'offIn', offline: true }),
    out_offline: card({ ...on, line: 'offOut', offline: true }),
    clocked_out: card(off),
    already_out: card({ ...off, line: 'alreadyOut' }),
    closed: card({ phase: 'closed', now: 25 * 60 + 20 }),
    access_ended_clocked_in: card(pastOn),
    access_ended_clocked_out: card(pastOff),
    access_ended_offline: card({ ...pastOn, line: 'offOut', offline: true }),
    access_ended_already: card({ ...pastOff, line: 'alreadyOut' }),
  };

  return cards[state];
}

export const limitOf = (c: Card) => outLimit(SHIFT, c.clockIn ?? SHIFT.start);

/** The line under the card's status, in its words, each {time} by the weekday rule. */
export function lineWords(c: Card): string | null {
  if (c.line === 'alreadyIn') return CW.alreadyIn(timeWords(c.clockIn ?? 0, c.now));
  if (c.line === 'alreadyOut') return CW.alreadyOut(timeWords(c.clockOut ?? 0, c.now));
  if (c.line === 'offIn') return CW.offIn;

  return c.line === 'offOut' ? CW.offOut : null;
}

export const opensWords = () => CW.opensAt(clock(opensAt(SHIFT)));

/** A tap on Clock in or Clock out: a line when there is no connection, otherwise the next phase at the server's time. */
export function tapped(c: Card): Card {
  if (c.offline) return { ...c, line: c.phase === 'ready' ? 'offIn' : 'offOut' };
  if (c.phase === 'ready') return { ...c, phase: 'on', clockIn: c.now, line: null };
  if (c.phase === 'on') {
    const at = c.past ? LATE_OUT : CLOCK_OUT;

    return { ...c, phase: 'off', clockOut: at, now: at, line: null };
  }

  return c;
}

/** The same button tapped a second time from another device or a stale page: nothing changes, and the line says so. */
export function tappedAgain(c: Card): Card {
  if (c.phase === 'on') return { ...c, line: 'alreadyIn' };

  return c.phase === 'off' ? { ...c, line: 'alreadyOut' } : c;
}

export const BOARD_TITLES: Record<ClockState, [string, string]> = {
  before: ['Before the window', 'Clock in opens at 16:00, disabled'],
  ready: ['Ready', 'Clock in, the window open'],
  clocked_in: ['Clocked in', 'Clocked in at 16:58, Clock out'],
  already_in: ['A second Clock in', 'You had already clocked in at 16:58'],
  offline: ['Clock in, no connection', 'Clock in stays as the retry'],
  out_offline: ['Clock out, no connection', 'Clock out stays as the retry'],
  clocked_out: ['Clocked out', 'Saturday 16:58 to 01:42, 8 h 44 min'],
  already_out: ['A second Clock out', 'You had already clocked out at 01:42, helper kept'],
  closed: ['The window closed, never clocked in', 'Ask whoever manages staff'],
  access_ended_clocked_in: ['Past access, clocked in', 'Only the clock card'],
  access_ended_clocked_out: ['Past access, clocked out', 'The card ends there'],
  access_ended_offline: ['Past access, no connection', 'Clock out stays as the retry'],
  access_ended_already: ['Past access, a second Clock out', 'You had already clocked out at 03:12'],
};

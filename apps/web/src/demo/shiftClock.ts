import { useState } from 'react';

import { hoursWords, outLimit as shiftOutLimit } from './hours.ts';
import type { DemoLink } from './settings.ts';
import { clock } from './shifts.ts';

export { clock };

/** The clock card on a person's own shift in a browser (sc-234): Saturday 17:00 to Sunday 01:00, minutes from Saturday 00:00. */
const DAY = 24 * 60;
const h = (hours: number, minutes = 0) => hours * 60 + minutes;
const WEEKDAYS = ['Saturday', 'Sunday', 'Monday'];

export const SHIFT = { start: h(17), end: h(25) };
export const EVENT = 'Adébáyọ̀ at 60';
export const VENUE = 'Eko Hotel';
export const JOB = 'Waiter · Section B';
export const LEAD = 'Dayo Okafor';
export const CLOCK_IN = h(16, 58);
export const CLOCK_OUT = h(25, 42);
export const LATE_OUT = h(27, 12);
export const SEND_MS = 700;

const dayOf = (minutes: number) => Math.floor(minutes / DAY);

/** A time not today gives its weekday, never the date (#12988). */
export const timeWords = (at: number, now: number) =>
  dayOf(at) === dayOf(now) ? clock(at) : `${WEEKDAYS[dayOf(at)] ?? ''} ${clock(at)}`;

export const outLimit = (clockIn: number) => shiftOutLimit(SHIFT, clockIn);

export const KW = {
  staffLink: 'Staff link',
  yourShift: 'Your shift',
  hours: `${clock(SHIFT.start)} to ${clock(SHIFT.end)}`,
  endsOn: `Ends on ${WEEKDAYS[dayOf(SHIFT.end)] ?? ''} at ${clock(SHIFT.end)}`,
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
  place:
    'On the staff member’s page, this card sits above Your shift, before and while its window is open.',
  openPage: 'Open it in My night',
  demoOffline: 'Demo: no connection',
  demoAgain: 'Demo: tap it again from another phone',
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

export const clockStateOf = (raw: string | null): ClockState =>
  (CLOCK_STATES as readonly string[]).includes(raw ?? '') ? (raw as ClockState) : 'ready';

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
  end: number;
}

const card = (over: Partial<Card>): Card => ({
  phase: 'ready',
  past: false,
  now: CLOCK_IN,
  clockIn: null,
  clockOut: null,
  line: null,
  offline: false,
  end: SHIFT.end,
  ...over,
});

const on = { phase: 'on' as const, clockIn: CLOCK_IN, now: h(17, 10) };
const off = { phase: 'off' as const, clockIn: CLOCK_IN, clockOut: CLOCK_OUT, now: CLOCK_OUT };
const pastOn = { phase: 'on' as const, past: true, clockIn: CLOCK_IN, now: h(27, 5) };
const pastOff = {
  phase: 'off' as const,
  past: true,
  clockIn: CLOCK_IN,
  clockOut: LATE_OUT,
  now: LATE_OUT,
};

export function cardOf(state: ClockState): Card {
  const cards: Record<ClockState, Card> = {
    before: card({ phase: 'before', now: h(15, 20) }),
    ready: card({}),
    clocked_in: card(on),
    already_in: card({ ...on, line: 'alreadyIn' }),
    offline: card({ line: 'offIn', offline: true }),
    out_offline: card({ ...on, line: 'offOut', offline: true }),
    clocked_out: card(off),
    already_out: card({ ...off, line: 'alreadyOut' }),
    closed: card({ phase: 'closed', now: h(25, 20) }),
    access_ended_clocked_in: card(pastOn),
    access_ended_clocked_out: card(pastOff),
    access_ended_offline: card({ ...pastOn, line: 'offOut', offline: true }),
    access_ended_already: card({ ...pastOff, line: 'alreadyOut' }),
  };

  return cards[state];
}

export function lineWords(c: Card): string | null {
  if (c.line === 'alreadyIn') return KW.alreadyIn(timeWords(c.clockIn ?? 0, c.now));
  if (c.line === 'alreadyOut') return KW.alreadyOut(timeWords(c.clockOut ?? 0, c.now));
  if (c.line === 'offIn') return KW.offIn;

  return c.line === 'offOut' ? KW.offOut : null;
}

export function tapped(c: Card): Card {
  if (c.offline) return { ...c, line: c.phase === 'ready' ? 'offIn' : 'offOut' };
  if (c.phase === 'ready') return { ...c, phase: 'on', clockIn: c.now, line: null };
  if (c.phase === 'on') {
    const at = c.past ? LATE_OUT : CLOCK_OUT;

    return { ...c, phase: 'off', clockOut: at, now: at, line: null };
  }

  return c;
}

/** The card's own state and its send, shared by this page and My night (sc-3915), where the card lives. */
export function useClockCard(first: Card) {
  const [c, setCard] = useState<Card>(first);
  const [busy, setBusy] = useState(false);

  function press() {
    setBusy(true);
    setTimeout(() => {
      setCard(tapped(c));
      setBusy(false);
    }, SEND_MS);
  }

  return { c, setCard, busy, press };
}

export function tappedAgain(c: Card): Card {
  if (c.phase === 'on') return { ...c, line: 'alreadyIn' };

  return c.phase === 'off' ? { ...c, line: 'alreadyOut' } : c;
}

const NAMES: Record<ClockState, string> = {
  before: 'Before the window: Clock in opens at 16:00, disabled',
  ready: 'Ready: Clock in',
  clocked_in: 'Clocked in at 16:58',
  already_in: 'A second Clock in',
  offline: 'Clock in with no connection',
  out_offline: 'Clock out with no connection',
  clocked_out: 'Clocked out, 8 h 44 min recorded',
  already_out: 'A second Clock out, the helper kept',
  closed: 'The window closed, never clocked in',
  access_ended_clocked_in: 'Past access, clocked in: signed out at 07:00 otherwise',
  access_ended_clocked_out: 'Past access, clocked out: the link’s ended page',
  access_ended_offline: 'Past access, no connection',
  access_ended_already: 'Past access, a second Clock out',
};

export const shiftClockAt = (state: ClockState) => `/demo/shift-clock?state=${state}`;

export const SHIFT_CLOCK_PAGES: readonly { name: string; states: readonly DemoLink[] }[] = [
  {
    name: 'The clock card in a browser (ShiftClock, sc-234)',
    states: CLOCK_STATES.map((state) => ({ to: shiftClockAt(state), name: NAMES[state] })),
  },
];

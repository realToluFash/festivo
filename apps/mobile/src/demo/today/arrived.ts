import type { EventCard, Moment } from '../../kit/today.ts';
import { repliesOf } from '../today.ts';

export const ARRIVED_STATES = ['some', 'nobodyComing', 'thousands', 'none', 'live'] as const;

export type ArrivedState = (typeof ARRIVED_STATES)[number];

export function isArrivedState(state: string | undefined): state is ArrivedState {
  return ARRIVED_STATES.some((name) => name === state);
}

/** sc-99's counts for one event, as the server serves them: attended, accepted, and expected (sc-1454). */
export interface Counts {
  arrived: number;
  coming: number;
  expected: number;
}

/** Now's figure: "87/99" over "arrived" beside a ring, or "37" over "arrived" with none. */
export interface Figure {
  count: string;
  of: string | null;
  share: number | null;
  spoken: string;
}

export type ArrivedMoment = Moment & { figure: Figure | null };

export const COUNTS: Record<Exclude<ArrivedState, 'live'>, Counts> = {
  // Day 2 of 3, as Guests A's door reads it: the 96 Coming and 3 let in who were not.
  some: { arrived: 87, coming: 96, expected: 99 },
  nobodyComing: { arrived: 37, coming: 0, expected: 37 },
  thousands: { arrived: 1204, coming: 1250, expected: 1250 },
  none: { arrived: 0, coming: 96, expected: 96 },
};

/** Nobody arrived and arrivals coming in are day 1, at Guests A's door: before it opens at 16:00, and from 16:05. */
export const ARRIVED_AT: Partial<Record<ArrivedState, { date: string; time: string }>> = {
  none: { date: '2026-11-05', time: '15:20' },
  live: { date: '2026-11-05', time: '16:05' },
};

const door = (arrived: number, expected: number): Counts => ({ ...COUNTS.none, arrived, expected });

/** Check-in from 16:05: a Coming guest, then two who were not, to Guests A's 3 of 98; then undone. */
export const LIVE: readonly Counts[] = [
  door(0, 96),
  door(1, 96),
  door(2, 97),
  door(3, 98),
  door(2, 97),
  door(1, 96),
  door(0, 96),
];

export function figureOf(counts: Counts, numbers: Intl.NumberFormat): Figure | null {
  if (counts.arrived === 0) return null;

  const count = numbers.format(counts.arrived);

  if (counts.coming === 0) return { count, of: null, share: null, spoken: `${count} arrived` };

  const of = numbers.format(counts.expected);

  return {
    count,
    of,
    share: counts.arrived / counts.expected,
    spoken: `${count} of ${of} arrived`,
  };
}

/** The card's line: arrived of expected once someone has, the replies line and bar until then. */
export function readyOf(counts: Counts, numbers: Intl.NumberFormat): EventCard['ready'] {
  const figure = figureOf(counts, numbers);

  if (figure == null) return repliesOf('wed');

  // Rounded down, so it is full only when everyone expected has arrived, and never under 1 with a share.
  return {
    words: figure.spoken,
    percent: figure.share == null ? 0 : Math.max(1, Math.floor(figure.share * 100)),
  };
}

const OTHERS: Partial<Record<string, EventCard['ready']>> = {
  ireti: repliesOf('ireti'),
  party: repliesOf('party'),
};

/** The built Now without Next, with sc-29881's lines on the cards and the wedding's arrivals on both. */
export function withArrived(
  moment: Moment,
  counts: Counts,
  numbers: Intl.NumberFormat,
): ArrivedMoment {
  return {
    ...moment,
    full: true,
    events: moment.events.map((card) => ({
      ...card,
      ready: card.event.id === 'wed' ? readyOf(counts, numbers) : (OTHERS[card.event.id] ?? null),
    })),
    figure: figureOf(counts, numbers),
  };
}

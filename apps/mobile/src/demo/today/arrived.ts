import type { EventCard, Moment } from '../../kit/today.ts';

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

/** Now's figure: "141/152" over "arrived" beside a ring, or "37" over "arrived" with none. */
export interface Figure {
  count: string;
  of: string | null;
  share: number | null;
  spoken: string;
}

export type ArrivedMoment = Moment & { figure: Figure | null };

const REPLIES = { words: '152 coming · 91% replied', percent: 91 };

export const COUNTS: Record<Exclude<ArrivedState, 'live'>, Counts> = {
  some: { arrived: 141, coming: 152, expected: 152 },
  nobodyComing: { arrived: 37, coming: 0, expected: 37 },
  thousands: { arrived: 1204, coming: 1250, expected: 1250 },
  none: { arrived: 0, coming: 152, expected: 152 },
};

/** Arrivals and undos as Check-in records them: the first arrival, two more, then undone back to nobody. */
export const LIVE: readonly number[] = [0, 1, 2, 3, 2, 1, 0];

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

  if (figure == null) return REPLIES;

  // Rounded down, so it is full only when everyone expected has arrived, and never under 1 with a share.
  return {
    words: figure.spoken,
    percent: figure.share == null ? 0 : Math.max(1, Math.floor(figure.share * 100)),
  };
}

const OTHERS: Partial<Record<string, EventCard['ready']>> = {
  ireti: { words: '44 coming · 80% replied', percent: 80 },
  party: { words: 'Invitations not sent', percent: 0 },
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

import type { EventGuestFigures, ListedEvent } from '@soirely/api-client';
import { type EventPhase } from './eventStates.ts';

/** The phases Events' tiles count (sc-23284); a draft has nobody invited, and a finished or called-off event drops out. */
const COUNTED: ReadonlySet<EventPhase> = new Set(['live', 'happening_now', 'paused']);

/** An event's guest line on Events (sc-3786): its figures when it is counted and has invited guests, otherwise none. */
export function guestLineOf(
  figures: EventGuestFigures | null,
  phase: EventPhase,
): EventGuestFigures | null {
  return figures != null && figures.invited > 0 && COUNTED.has(phase) ? figures : null;
}

/** The events whose headcounts Events follows: those it read guest figures for (sc-3786). */
export function followedIds(events: readonly ListedEvent[]): string[] {
  return events.filter((event) => event.guests != null).map((event) => event.id);
}

/** The figures read again, each on its own event; nothing else on the list moves (sc-3786). */
export function withFiguresFrom<T extends ListedEvent>(
  events: readonly T[],
  read: readonly ListedEvent[],
): T[] {
  const figures = new Map(read.map((event) => [event.id, event.guests ?? null]));

  return events.map((event) =>
    figures.has(event.id) ? { ...event, guests: figures.get(event.id) ?? null } : event,
  );
}

/** To the nearest whole percent, a half rounding up, except that 100% means everyone and 0% nobody (sc-29881). */
export function sharePercent(part: number, whole: number): number {
  if (part >= whole) return 100;
  if (part <= 0) return 0;

  return Math.min(99, Math.max(1, Math.round((part / whole) * 100)));
}

/** Today's line under an event (sc-29881): none on a draft or without figures, Invitations not sent with nobody invited, otherwise coming and the share replied, as Events counts them. */
export type TodayReplies =
  { kind: 'notSent' } | { kind: 'replies'; coming: number; percent: number };

export function todayRepliesOf(
  figures: EventGuestFigures | null | undefined,
  draft: boolean,
): TodayReplies | null {
  if (draft || figures == null) return null;
  if (figures.invited === 0) return { kind: 'notSent' };

  return {
    kind: 'replies',
    coming: figures.coming,
    percent: sharePercent(figures.invited - figures.notReplied, figures.invited),
  };
}

/** Today's arrived figure (sc-29978): attended of expected once anyone has arrived, the door's count (sc-1454); with nobody Coming, attended alone. */
export type TodayArrivals =
  | { kind: 'of'; attended: number; expected: number; percent: number }
  | { kind: 'alone'; attended: number };

export function todayArrivalsOf(
  figures: EventGuestFigures | null | undefined,
): TodayArrivals | null {
  if (figures == null || figures.attended === 0) return null;
  if (figures.coming === 0) return { kind: 'alone', attended: figures.attended };

  const { attended, expected } = figures;

  // Rounded down, so the bar is full only when everyone Coming has arrived, and never empty once someone has.
  return {
    kind: 'of',
    attended,
    expected,
    percent: Math.max(1, Math.floor((attended / expected) * 100)),
  };
}

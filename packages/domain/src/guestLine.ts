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

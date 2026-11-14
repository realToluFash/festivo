import type { ListedEvent } from '@soirely/api-client';

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

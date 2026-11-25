import { type Part } from './EventPartEdits.tsx';

/** The event's page with one of its parts open in place, as Change dates and the old Edit details address lead there (sc-48602). */
export function inPlace(eventId: string, part: Part) {
  return { to: `/app/events/${encodeURIComponent(eventId)}`, state: { open: part } } as const;
}

/** The event's page with End now's confirmation already open, as the night's end card leads there (sc-3895). */
export function endingNow(eventId: string) {
  return { to: `/app/events/${encodeURIComponent(eventId)}`, state: { ask: 'endNow' } } as const;
}

export function asksEndNow(state: unknown): boolean {
  return typeof state === 'object' && state != null && 'ask' in state && state.ask === 'endNow';
}

export function arrivingPart(state: unknown): Part | null {
  const open = typeof state === 'object' && state != null && 'open' in state ? state.open : null;

  return open === 'dates' || open === 'venue' || open === 'hosts' || open === 'cover' ? open : null;
}

/** The parts Edit details answered to by its hash, and no others. */
export function partOfHash(hash: string): Part | null {
  switch (hash) {
    case '#starts':
      return 'dates';
    case '#venue':
      return 'venue';
    case '#hosts':
      return 'hosts';
    case '#cover':
      return 'cover';
    default:
      return null;
  }
}

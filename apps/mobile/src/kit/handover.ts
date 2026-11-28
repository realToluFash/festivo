import { ApiError, type LedEvent } from '@soirely/api-client';

/** The Ask shows this many, then "and {n} more"; it never scrolls inside itself (sc-614). */
export const SHOWN_AT_MOST = 5;

/** The server's handover.choose_recipient: somebody began leading an event while the Ask stood open. */
export function refusedHandTo(error: unknown): boolean {
  return error instanceof ApiError && error.status === 422 && 'handTo' in error.fieldErrors();
}

export function firstFew(events: readonly LedEvent[]): { shown: LedEvent[]; more: number } {
  return {
    shown: events.slice(0, SHOWN_AT_MOST),
    more: Math.max(0, events.length - SHOWN_AT_MOST),
  };
}

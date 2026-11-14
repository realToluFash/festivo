import type { EventGuestFigures, HeadcountCounts } from '@soirely/api-client';
import { type EventPhase } from './eventStates.ts';

/** The phases Events' tiles count (sc-23284); a draft has nobody invited, and a finished or called-off event drops out. */
const COUNTED: ReadonlySet<EventPhase> = new Set(['live', 'happening_now', 'paused']);

/** sc-99's headcount in the tiles' measure, as each event's line on Events reads it when a change is published (sc-3786). */
export function figuresOf(counts: HeadcountCounts): EventGuestFigures {
  return {
    invited: counts.invited,
    coming: counts.accepted,
    notReplied: counts.awaitingReply + counts.heldBy.hostNoReply,
  };
}

/** An event's guest line on Events (sc-3786): its figures when it is counted and has invited guests, otherwise none. */
export function guestLineOf(
  figures: EventGuestFigures | null,
  phase: EventPhase,
): EventGuestFigures | null {
  return figures != null && figures.invited > 0 && COUNTED.has(phase) ? figures : null;
}

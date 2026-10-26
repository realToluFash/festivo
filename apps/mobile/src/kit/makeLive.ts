import { ApiError, type EventStatus, type OrganisationEvent } from '@soirely/api-client';

/** The word each stored state shows, never its colour alone (WCAG 2.2 §1.4.1). */
export const STATUS_WORD = {
  draft: 'eventsScreen.draft',
  live: 'eventsScreen.live',
  paused: 'eventsScreen.paused',
  ended: 'eventsScreen.finished',
} as const satisfies Record<EventStatus, string>;

export interface DraftRow {
  line: 'guestsBlocked' | 'endPassed';
  offersMakeLive: boolean;
}

/** A Draft's one line for the areas it blocks (sc-3584); one whose end has passed says so instead, with no Make live. */
export function draftRowOf(
  event: Pick<OrganisationEvent, 'status' | 'endsAt'>,
  now: number,
  manages: boolean,
): DraftRow | null {
  if (event.status !== 'draft') return null;

  const concluded = now >= Date.parse(event.endsAt);

  return { line: concluded ? 'endPassed' : 'guestsBlocked', offersMakeLive: manages && !concluded };
}

export type MakeLiveRefusal =
  | { kind: 'changed' }
  | { kind: 'concluded' }
  | { kind: 'planLimit'; plan: string; limit: number }
  | { kind: 'failed' };

/** `changed` and `concluded` read the event again, so the page shows what it is now. */
export function refusalOf(error: unknown): MakeLiveRefusal {
  if (!(error instanceof ApiError)) return { kind: 'failed' };
  if (error.is('event_state_invalid')) return { kind: 'changed' };
  if (error.is('event_concluded')) return { kind: 'concluded' };
  if (error.is('plan_limit')) {
    return { kind: 'planLimit', plan: error.problem.plan ?? '', limit: error.problem.limit ?? 0 };
  }

  return { kind: 'failed' };
}

import { ApiError, type EventStatus, type OrganisationEvent } from '@soirely/api-client';
import { type MakeLiveRow, makeLiveRow } from '@soirely/domain';

/** The word each stored state shows, never its colour alone (WCAG 2.2 §1.4.1). */
export const STATUS_WORD = {
  draft: 'eventsScreen.draft',
  live: 'eventsScreen.live',
  paused: 'eventsScreen.paused',
  ended: 'eventsScreen.finished',
} as const satisfies Record<EventStatus, string>;

/** Each state's sentence whole, so a translation can agree it with the event. */
export const NOW_STATE = {
  draft: 'eventLive.nowState_draft',
  live: 'eventLive.nowState_live',
  paused: 'eventLive.nowState_paused',
  ended: 'eventLive.nowState_finished',
} as const satisfies Record<EventStatus, string>;

export interface DraftRow {
  line: MakeLiveRow['line'];
  offersMakeLive: boolean;
}

/** The row `/event-states.json` gives the event (sc-3584); Make live only to someone who manages it. */
export function draftRowOf(
  event: Pick<OrganisationEvent, 'status' | 'startsAt' | 'endsAt'>,
  now: number,
  manages: boolean,
): DraftRow | null {
  const row = makeLiveRow(event, new Date(now));

  return row == null ? null : { line: row.line, offersMakeLive: manages && row.makeLive };
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

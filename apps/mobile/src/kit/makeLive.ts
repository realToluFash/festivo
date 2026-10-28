import { ApiError, type OrganisationEvent } from '@soirely/api-client';
import { type EventPhase, type MakeLiveRow, makeLiveRow, needsHost } from '@soirely/domain';

/** The word each phase shows, never the stored state and never its colour alone (WCAG 2.2 §1.4.1). */
export const PHASE_WORD = {
  draft: 'eventsScreen.draft',
  live: 'eventsScreen.live',
  happening_now: 'eventsScreen.happeningNow',
  paused: 'eventsScreen.paused',
  finished: 'eventsScreen.finished',
} as const satisfies Record<EventPhase, string>;

export interface DraftRow {
  line: MakeLiveRow['line'];
  offersMakeLive: boolean;
}

/** The row `/event-states.json` gives the event (sc-3584); Make live only to someone who manages it. `now` is the corrected clock's. */
export function draftRowOf(
  event: Pick<OrganisationEvent, 'status' | 'startsAt' | 'endsAt'>,
  now: Date,
  manages: boolean,
): DraftRow | null {
  const row = makeLiveRow(event, now);

  return row == null ? null : { line: row.line, offersMakeLive: manages && row.makeLive };
}

export type MakeLiveRefusal =
  | { kind: 'changed' }
  | { kind: 'concluded' }
  | { kind: 'needsHost' }
  | { kind: 'planLimit'; plan: string; limit: number }
  | { kind: 'failed' };

/** Make live on a draft with no host opens refused, rather than asking first (sc-15497). */
export function makeLiveOpens(
  event: Pick<OrganisationEvent, 'status' | 'hosts'>,
): { kind: 'confirm' } | { kind: 'needsHost' } {
  return needsHost(event) ? { kind: 'needsHost' } : { kind: 'confirm' };
}

/** Add who is hosting: Edit details at Hosted by. */
export function addHostsHref(eventId: string): `/events/${string}` {
  return `/events/${encodeURIComponent(eventId)}/edit?at=hosts`;
}

/** `changed` and `concluded` read the event again, so the page shows what it is now. */
export function refusalOf(error: unknown): MakeLiveRefusal {
  if (!(error instanceof ApiError)) return { kind: 'failed' };
  if (error.is('event_state_invalid')) return { kind: 'changed' };
  if (error.is('event_concluded')) return { kind: 'concluded' };
  if (error.is('event_host_required')) return { kind: 'needsHost' };
  if (error.is('plan_limit')) {
    return { kind: 'planLimit', plan: error.problem.plan ?? '', limit: error.problem.limit ?? 0 };
  }

  return { kind: 'failed' };
}

export type EndRefusal = { kind: 'changed' } | { kind: 'concluded' } | { kind: 'failed' };

/** End now's refusals (sc-3585): `changed` and `concluded` read the event again. */
export function endRefusalOf(error: unknown): EndRefusal {
  if (error instanceof ApiError && error.is('event_state_invalid')) return { kind: 'changed' };
  if (error instanceof ApiError && error.is('event_concluded')) return { kind: 'concluded' };

  return { kind: 'failed' };
}

export type PauseRefusal = { kind: 'changed' } | { kind: 'failed' };

/** Pause's and Resume's refusals (sc-3586): only `changed`, which reads the event again; past the end the phase is Finished, so neither meets `event_concluded`. */
export function pauseRefusalOf(error: unknown): PauseRefusal {
  if (error instanceof ApiError && error.is('event_state_invalid')) return { kind: 'changed' };

  return { kind: 'failed' };
}

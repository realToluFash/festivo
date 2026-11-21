import { ApiError } from '@soirely/api-client';
import { type EventPhase, endLabel, roleHolds, typedNameMatches } from '@soirely/domain';

/** Delete event is offered only to a role that holds Create events on it (sc-3592, sc-29914). */
export function offersDelete(event: { permissions: readonly string[] } | null): boolean {
  return event != null && roleHolds(event, 'events.create');
}

/** With a guest Invited, Delete event opens on the page's own Call off or End now (sc-14445); once Finished, the event is deleted as before, read off the phase the page shows. */
export function refusedVerb(
  event: { startsAt: string },
  phase: EventPhase,
  now: Date,
  refused: boolean,
): 'callOff' | 'endNow' | null {
  return refused ? endLabel(event, phase, now) : null;
}

export type DeleteAnswer =
  | { kind: 'deleted' }
  | { kind: 'mismatch'; typed: string; current?: string }
  /** A guest made Invited since the screen opened (sc-14445): the refusal is said in the screen's own words, never the 409's. */
  | { kind: 'refused' }
  | { kind: 'failed'; typed: string; error: unknown };

export interface DeletesEvents {
  deleteEvent(eventId: string, name?: string): Promise<void>;
  event(eventId: string): Promise<{ name: string }>;
}

/** A Draft is sent with no name; otherwise a name the API would refuse is never sent. */
export async function deleteEvent(
  client: DeletesEvents,
  event: { id: string; name: string },
  needsName: boolean,
  typed: string,
): Promise<DeleteAnswer> {
  if (needsName && !typedNameMatches(typed, event.name)) return { kind: 'mismatch', typed };

  try {
    if (needsName) await client.deleteEvent(event.id, typed);
    else await client.deleteEvent(event.id);

    return { kind: 'deleted' };
  } catch (error) {
    if (error instanceof ApiError && error.is('event_call_off_first')) return { kind: 'refused' };

    const nameRefused =
      error instanceof ApiError &&
      (error.problem.violations ?? []).some((one) => one.propertyPath === 'name');

    if (!nameRefused) return { kind: 'failed', typed, error };

    const current = await reread(client, event.id);

    return current == null ? { kind: 'mismatch', typed } : { kind: 'mismatch', typed, current };
  }
}

/** A name refused by the API may have been renamed since the screen opened (sc-44741); unread, the screen keeps the name it has. */
async function reread(client: DeletesEvents, eventId: string): Promise<string | null> {
  try {
    return (await client.event(eventId)).name;
  } catch {
    return null;
  }
}

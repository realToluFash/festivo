import { ApiError } from '@soirely/api-client';
import { roleHolds, typedNameMatches } from '@soirely/domain';

/** Delete event is offered only to a role that holds Create events on it (sc-3592, sc-29914). */
export function offersDelete(event: { permissions: readonly string[] } | null): boolean {
  return event != null && roleHolds(event, 'events.create');
}

export type DeleteAnswer =
  | { kind: 'deleted' }
  | { kind: 'mismatch'; typed: string; current?: string }
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

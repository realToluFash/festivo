import { ApiError } from '@soirely/api-client';
import { roleHolds, typedNameMatches } from '@soirely/domain';

/** Delete event is offered only to a role that holds Create events (sc-3592). */
export function offersDelete(organisation: { permissions: readonly string[] } | null): boolean {
  return organisation != null && roleHolds(organisation, 'events.create');
}

export type DeleteAnswer =
  | { kind: 'deleted' }
  | { kind: 'mismatch'; typed: string }
  | { kind: 'failed'; typed: string; error: unknown };

export interface DeletesEvents {
  deleteEvent(eventId: string, name?: string): Promise<void>;
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

    return nameRefused ? { kind: 'mismatch', typed } : { kind: 'failed', typed, error };
  }
}

import { ApiError, type OrganisationEvent } from '@soirely/api-client';
import { roleHolds } from '@soirely/domain';

/** The event open, and the organisation it was opened in: undefined while the account was still loading. */
export interface Selection {
  in: string | undefined;
  id: string | null;
}

/** A link followed on a cold start keeps its event for the first organisation that loads; a switch clears it. */
export function selectionIn(selection: Selection, organisationId: string | undefined): Selection {
  if (selection.in === organisationId) return selection;
  if (organisationId === undefined) return { in: undefined, id: null };
  if (selection.in === undefined) return { in: organisationId, id: selection.id };

  return { in: organisationId, id: null };
}

export type Opened =
  | { kind: 'loading' }
  | { kind: 'failed' }
  | { kind: 'notFound' }
  | { kind: 'loaded'; event: OrganisationEvent };

/** Another organisation's event, one outside the role's grants and one that does not exist all read as not found. */
export function openedOf(
  answer: { event: OrganisationEvent } | { error: unknown },
  organisationId: string,
): Opened {
  if ('event' in answer) {
    return answer.event.organisationId === organisationId
      ? { kind: 'loaded', event: answer.event }
      : { kind: 'notFound' };
  }

  return answer.error instanceof ApiError &&
    (answer.error.status === 404 || answer.error.status === 403)
    ? { kind: 'notFound' }
    : { kind: 'failed' };
}

/** Settled without asking the API: loading until the organisation has loaded, then not found for a role that cannot read events, as the API would answer. */
export function openedWithoutAsking(
  organisation: { permissions: readonly string[] } | null,
): Opened | null {
  if (organisation == null) return { kind: 'loading' };

  return roleHolds(organisation, 'events.read') ? null : { kind: 'notFound' };
}

import { ApiError } from '@soirely/api-client';
import { type Translate, copyStartRefusal, localDateTime } from '@soirely/domain';

/** The route param through which a copy's page knows the event it was duplicated from (sc-22145). */
export const COPIED_FROM = 'from';

export interface DuplicatesEvents {
  duplicateEvent(eventId: string, startsAt: string): Promise<{ id: string }>;
}

export type DuplicateAnswer =
  | { kind: 'refused'; message: string; focus: 'date' | 'time' }
  | { kind: 'created'; href: `/events/${string}` }
  | { kind: 'failed' };

/** A start not fully chosen is refused without asking the API; a refused start shows where the missing one does. */
export async function duplicateEvent(
  client: DuplicatesEvents,
  originalId: string,
  date: string,
  time: string,
  t: Translate,
): Promise<DuplicateAnswer> {
  const refusal = copyStartRefusal(date, time, t);

  if (refusal != null) return { kind: 'refused', ...refusal };

  try {
    const copy = await client.duplicateEvent(originalId, localDateTime(date, time) ?? '');

    return { kind: 'created', href: copyHref(copy.id, originalId) };
  } catch (error) {
    const refused =
      error instanceof ApiError && error.status === 422 ? error.fieldErrors().startsAt : undefined;

    return refused == null
      ? { kind: 'failed' }
      : { kind: 'refused', message: refused, focus: 'date' };
  }
}

export function copyHref(copyId: string, originalId: string): `/events/${string}` {
  return `/events/${encodeURIComponent(copyId)}?${COPIED_FROM}=${encodeURIComponent(originalId)}`;
}

/** Only the copy's own page, reached from Duplicate, goes back to the original; any other event's page goes to the list. */
export function backToOriginal(
  linked: string | null,
  open: string | null,
  copiedFrom: string | undefined,
): string | null {
  return copiedFrom == null || copiedFrom === '' || linked == null || open !== linked
    ? null
    : copiedFrom;
}

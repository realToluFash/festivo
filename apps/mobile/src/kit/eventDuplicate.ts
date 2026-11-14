import { ApiError } from '@soirely/api-client';
import { type Translate, addDays, copyStartRefusal, localDateTime } from '@soirely/domain';

/** The route param through which a copy's page knows the event it was duplicated from (sc-22145). */
export const COPIED_FROM = 'from';

/** The route param that opens an event's page with Duplicate over it, as an Events card's Duplicate does. */
export const DUPLICATING = 'duplicate';

/** The line is read before the copy opens. */
export const OPENING_AFTER = 700;

export interface Starts {
  date: string;
  time: string;
}

export interface DuplicateRun {
  starts: Starts;
  status: 'editing' | 'creating' | 'failed' | 'created';
  error: string | null;
  /** The half that takes focus with the error. */
  focus: 'date' | 'time' | null;
}

/** The copy starts on the original's weekday and time, a year on. */
export function startsAfter(begins: Starts): Starts {
  return { date: addDays(begins.date, 52 * 7), time: begins.time };
}

export function duplicateRunOf(starts: Starts): DuplicateRun {
  return { starts, status: 'editing', error: null, focus: null };
}

/** A chosen start clears its error once both halves are chosen; nothing changes while it sends. */
export function pickedRun(run: DuplicateRun, starts: Starts): DuplicateRun {
  if (run.status === 'creating' || run.status === 'created') return run;
  const whole = starts.date !== '' && starts.time !== '';

  return {
    starts,
    status: 'editing',
    error: whole ? null : run.error,
    focus: whole ? null : run.focus,
  };
}

/** Where the answer leaves the screen: `duplicateStartsBlank` and `duplicateStartsRefused`, `duplicateNotCreated`, or `duplicateCreated`. */
export function answeredRun(run: DuplicateRun, answer: DuplicateAnswer): DuplicateRun {
  switch (answer.kind) {
    case 'refused':
      return { ...run, status: 'editing', error: answer.message, focus: answer.focus };
    case 'failed':
      return { ...run, status: 'failed', error: null, focus: null };
    case 'created':
      return { ...run, status: 'created', error: null, focus: null };
  }
}

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

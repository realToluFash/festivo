import type { GuestMessageRow, OrganisationEvent, PickableGuest } from '@soirely/api-client';
import { foldedName, visibleLength } from '@soirely/domain';

export const SUBJECT_MAXIMUM = 150;
export const MESSAGE_MAXIMUM = 10_000;
const AFTER_END_DAYS = 30;

export type Who = { kind: 'all' } | { kind: 'chosen'; ids: readonly string[] };

export type Field = 'who' | 'subject' | 'message';

/** The form's order, which focus follows to the first refusal (sc-3942). */
export const FIELDS: readonly Field[] = ['who', 'subject', 'message'];

export type Refusal = 'chooseOne' | 'subjectTooLong' | 'enterMessage' | 'messageTooLong';

export type Refusals = Partial<Record<Field, Refusal>>;

/** What Send refuses before asking the API, counted as the API counts, with the ends trimmed; text past a limit stays in the field. */
export function refusalsOf(who: Who, subject: string, message: string): Refusals {
  const refusals: Refusals = {};
  const body = message.trim();

  if (who.kind === 'chosen' && who.ids.length === 0) refusals.who = 'chooseOne';
  if (visibleLength(subject.trim()) > SUBJECT_MAXIMUM) refusals.subject = 'subjectTooLong';
  if (body === '') refusals.message = 'enterMessage';
  else if (visibleLength(body) > MESSAGE_MAXIMUM) refusals.message = 'messageTooLong';

  return refusals;
}

export function firstRefused(refusals: Refusals): Field | null {
  return FIELDS.find((field) => refusals[field] != null) ?? null;
}

/** The API's 422 names `guestIds` for an empty choice, and `audience` for an event with no guests at all. */
export function fieldOfPath(path: string): Field | null {
  if (path === 'guestIds' || path === 'audience') return 'who';
  if (path === 'subject' || path === 'message') return path;

  return null;
}

export type Closed = 'closedDraft' | 'closedEnded';

/** Why nothing can be sent on this event: a Draft, or more than 30 days after it finished; a paused one can, so the host can say why. */
export function closedOf(
  event: Pick<OrganisationEvent, 'phase' | 'concludedAt' | 'endsAt'>,
  now: Date,
): Closed | null {
  if (event.phase === 'draft') return 'closedDraft';
  if (event.phase !== 'finished') return null;

  const ended = Date.parse(event.concludedAt ?? event.endsAt);
  const until = new Date(ended);

  until.setUTCDate(until.getUTCDate() + AFTER_END_DAYS);

  return now >= until ? 'closedEnded' : null;
}

/** Find a guest, as sc-3772's search: any part of the name, case and accents aside; the address too only with guests.manage (sc-3773). */
export function matching(
  guests: readonly PickableGuest[],
  typed: string,
  addresses: boolean,
): PickableGuest[] {
  const sought = foldedName(typed);

  if (sought === '') return [...guests];

  return guests.filter(
    (guest) =>
      foldedName(guest.name).includes(sought) ||
      (addresses && guest.email != null && guest.email.toLowerCase().includes(sought)),
  );
}

/** A message with no Subject is named by its first line, shortened to fit at a word. */
export function shortTitle(title: string, most = 40): string {
  if (title.length <= most) return title;

  const cut = title.slice(0, most + 1);
  const end = cut.lastIndexOf(' ');

  return `${(end > 0 ? cut.slice(0, end) : cut).replace(/[\s.,;:!?]+$/u, '')}…`;
}

/** All messages as conversations, a follow-up under the message it continues: each oldest first, the latest activity first. */
export function conversationsOf(
  rows: readonly GuestMessageRow[],
): { id: string; messages: GuestMessageRow[] }[] {
  const byId = new Map<string, GuestMessageRow[]>();

  for (const row of rows) {
    const id = row.follows ?? row.id;
    byId.set(id, [row, ...(byId.get(id) ?? [])]);
  }

  return [...byId].map(([id, messages]) => ({ id, messages }));
}

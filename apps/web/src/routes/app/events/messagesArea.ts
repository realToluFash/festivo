import {
  ApiError,
  type GuestCondition,
  type GuestMessageRow,
  type PickableGuest,
  type SavedAudience,
  type ShownCondition,
} from '@soirely/api-client';
import { foldedName, groupNameLength, overLimits, sameGroup } from '@soirely/domain';

export type Quick = 'coming' | 'notReplied';
export type Picked = Quick | 'who' | `saved:${string}`;

export type Who =
  | { kind: 'all' }
  | { kind: 'chosen'; ids: readonly string[] }
  | { kind: 'conditions'; conditions: readonly GuestCondition[]; pick: Picked };

export const QUICKS: readonly Quick[] = ['coming', 'notReplied'];

export const NOT_REPLIED: Who = {
  kind: 'conditions',
  conditions: [{ type: 'notReplied' }],
  pick: 'notReplied',
};

/** Write to them on the Guests card opens New message to Hasn't replied. */
export function writingToNotReplied(eventId: string) {
  return {
    to: `/app/events/${encodeURIComponent(eventId)}/messages`,
    state: { write: 'notReplied' },
  } as const;
}

export function writesToNotReplied(state: unknown): boolean {
  return (
    typeof state === 'object' && state != null && 'write' in state && state.write === 'notReplied'
  );
}

export type Addable = GuestCondition['type'];

/** Add a condition's menu, in the drawing's order. */
export const ADDABLE: readonly Addable[] = [
  'replied',
  'notReplied',
  'coming',
  'notComing',
  'notSure',
  'inGroup',
  'invited',
  'notInvited',
  'hasEmail',
  'hasMobile',
];

export const AUDIENCE_NAME_MAXIMUM = 60;
export const AUDIENCES_MOST = 20;

export function conditionKey(condition: GuestCondition): string {
  return condition.type === 'inGroup' ? `inGroup:${condition.groupId ?? ''}` : condition.type;
}

export function asCondition(shown: ShownCondition): GuestCondition {
  return shown.type === 'inGroup'
    ? { type: 'inGroup', groupId: shown.groupId }
    : { type: shown.type };
}

function sameConditions(a: readonly GuestCondition[], b: readonly GuestCondition[]): boolean {
  const keys = new Set(a.map(conditionKey));

  return a.length === b.length && b.every((one) => keys.has(conditionKey(one)));
}

export function savedOf(
  saved: readonly SavedAudience[],
  pick: Picked | null,
): SavedAudience | null {
  return pick?.startsWith('saved:') === true
    ? (saved.find((one) => `saved:${one.id}` === pick) ?? null)
    : null;
}

/** The message's own copy differs from the quick pick or saved audience it was picked from: this message only. */
export function changedFrom(who: Who, saved: readonly SavedAudience[]): boolean {
  if (who.kind !== 'conditions' || who.pick === 'who') return false;

  const from =
    who.pick === 'coming' || who.pick === 'notReplied'
      ? [{ type: who.pick }]
      : savedOf(saved, who.pick)?.conditions.map(asCondition);

  return from != null && !sameConditions(from, who.conditions);
}

export type NameProblem = 'nameBlank' | 'nameLong' | 'nameTaken' | 'audiencesFull';

/** A group name's rules (sc-3775): required, at most 60, no other saved audience's name, case and accents aside; then 20 when saving a new one. */
export function audienceNameProblem(
  saved: readonly SavedAudience[],
  name: string,
  renaming: string | null = null,
): NameProblem | null {
  if (name.trim() === '') return 'nameBlank';
  if (groupNameLength(name) > AUDIENCE_NAME_MAXIMUM) return 'nameLong';
  if (sameGroup(saved, name, renaming) != null) return 'nameTaken';
  if (renaming == null && saved.length >= AUDIENCES_MOST) return 'audiencesFull';

  return null;
}

const NAME_CODES: Record<string, NameProblem> = {
  audience_name_required: 'nameBlank',
  audience_name_too_long: 'nameLong',
  audience_name_taken: 'nameTaken',
  audiences_full: 'audiencesFull',
};

export function nameProblemOf(error: unknown): NameProblem | null {
  if (!(error instanceof ApiError)) return null;

  const code = [error.code, ...(error.problem.violations ?? []).map((one) => one.code)].find(
    (one) => one in NAME_CODES,
  );

  return code == null ? null : (NAME_CODES[code] ?? null);
}

export type AudienceRefusal =
  { kind: 'noCondition' } | { kind: 'deleted'; group: string } | { kind: 'nobody' };

/** Why Guests who… can't be sent: no condition, a deleted group's, or nobody matching when last counted. */
export function audienceRefusal(
  who: Who,
  deletedGroups: readonly string[],
  count: number | null,
): AudienceRefusal | null {
  if (who.kind !== 'conditions') return null;
  if (who.conditions.length === 0) return { kind: 'noCondition' };

  const gone = deletedGroups[0];
  if (gone != null) return { kind: 'deleted', group: gone };

  return count === 0 ? { kind: 'nobody' } : null;
}

/** The API's 422 for Guests who…: none added, or nobody matching as it goes. */
export function audienceRefusalOf(error: unknown): AudienceRefusal | null {
  if (!(error instanceof ApiError) || error.status !== 422) return null;

  const codes = (error.problem.violations ?? []).map((one) => one.code);

  if (codes.includes('conditions_required')) return { kind: 'noCondition' };
  if (codes.includes('nobody_matches')) return { kind: 'nobody' };

  return null;
}

export type Field = 'who' | 'subject' | 'message';

/** The form's order, which focus follows to the first refusal (sc-3942). */
export const FIELDS: readonly Field[] = ['who', 'subject', 'message'];

export type Refusal = 'chooseOne' | 'subjectTooLong' | 'enterMessage' | 'messageTooLong';

export type Refusals = Partial<Record<Field, Refusal>>;

/** What Send refuses before asking the API, counted as the API counts, with the ends trimmed; text past a limit stays in the field. */
export function refusalsOf(who: Who, subject: string, message: string): Refusals {
  const refusals: Refusals = overLimits(subject, message);

  if (who.kind === 'chosen' && who.ids.length === 0) refusals.who = 'chooseOne';
  if (message.trim() === '') refusals.message = 'enterMessage';

  return refusals;
}

export function firstRefused(refusals: Refusals): Field | null {
  return FIELDS.find((field) => refusals[field] != null) ?? null;
}

/** The API's 422 names `guestIds` for an empty choice, and `audience` for an event with no guests at all; `conditions` is said beside Send instead. */
export function fieldOfPath(path: string): Field | null {
  if (path === 'guestIds' || path === 'audience') return 'who';
  if (path === 'subject' || path === 'message') return path;

  return null;
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

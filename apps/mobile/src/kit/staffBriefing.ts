import { STAFF_RULES_MAXIMUM, type StaffBriefing, type StaffEntry } from '@soirely/api-client';
import type { TFunction } from 'i18next';

/** The rules' count shows from here, as the web has it (sc-3917). */
const COUNT_FROM = 1800;

export const BRIEFING_STATES: readonly StaffBriefing[] = ['read', 'sent', 'changed', 'none'];

export const BRIEFING_WORDS: Record<StaffBriefing, string> = {
  read: 'briefing.read',
  sent: 'briefing.sent',
  changed: 'briefing.changed',
  none: 'briefing.none',
};

/** Code points, as the API counts them: "Ọ̀" is two. */
export function codePoints(text: string): number {
  return Array.from(text).length;
}

function isOneKey(before: string, typed: string): boolean {
  const was = Array.from(before);
  const now = Array.from(typed);
  if (now.length !== was.length + 1) return false;

  let start = 0;
  while (start < was.length && was[start] === now[start]) start += 1;
  let end = 0;
  while (end < was.length - start && was[was.length - 1 - end] === now[now.length - 1 - end])
    end += 1;

  return start + end === was.length;
}

/** A key typed at the limit is not taken; a paste that would go over, even by one over a selection, keeps its first part and says so. */
export function fitRules(before: string, typed: string): { text: string; cut: boolean } {
  if (codePoints(typed) <= STAFF_RULES_MAXIMUM) return { text: typed, cut: false };
  if (isOneKey(before, typed)) return { text: before, cut: false };

  return { text: Array.from(typed).slice(0, STAFF_RULES_MAXIMUM).join(''), cut: true };
}

export function countLine(text: string, t: TFunction): { words: string; limit: boolean } | null {
  const n = codePoints(text);
  if (n >= STAFF_RULES_MAXIMUM)
    return { words: t('briefing.atLimit', { max: STAFF_RULES_MAXIMUM }), limit: true };
  if (n >= COUNT_FROM)
    return { words: t('briefing.count', { n, max: STAFF_RULES_MAXIMUM }), limit: false };

  return null;
}

/** Why there is nothing to send, where one applies: no shift first, then no number. */
export function noteOf(one: StaffEntry, t: TFunction): string | null {
  if (one.shifts.length === 0) return t('briefing.noShift');
  if (one.mobile == null) return t('briefing.noMobile');

  return null;
}

export function tallyOf(people: readonly StaffEntry[]): Record<StaffBriefing, number> {
  const tally: Record<StaffBriefing, number> = { read: 0, sent: 0, changed: 0, none: 0 };
  for (const one of people) tally[one.briefing] += 1;

  return tally;
}

/** Everyone with a shift, in roster order. */
export function withShifts(people: readonly StaffEntry[]): StaffEntry[] {
  return people.filter((one) => one.shifts.length > 0);
}

/** Copy link and Mark as sent are offered to staff.manage, with a mobile number, on an event not yet finished. */
export function copies(one: StaffEntry, manages: boolean): boolean {
  return manages && one.mobile != null && !one.contactsErased;
}

export function offersMark(one: StaffEntry): boolean {
  return one.briefingCopy != null && !one.briefingCopy.marked;
}

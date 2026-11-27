import { STAFF_RULES_MAXIMUM, type StaffBriefing, type StaffEntry } from '@soirely/api-client';
import { briefingTally, fitRules as fitHouseRules, rulesCount } from '@soirely/domain';
import type { TFunction } from 'i18next';

export const BRIEFING_STATES: readonly StaffBriefing[] = ['read', 'sent', 'changed', 'none'];

export const BRIEFING_WORDS: Record<StaffBriefing, string> = {
  read: 'briefing.read',
  sent: 'briefing.sent',
  changed: 'briefing.changed',
  none: 'briefing.none',
};

export function fitRules(before: string, typed: string): { text: string; cut: boolean } {
  return fitHouseRules(before, typed, STAFF_RULES_MAXIMUM);
}

export function countLine(text: string, t: TFunction): { words: string; limit: boolean } | null {
  const count = rulesCount(text, STAFF_RULES_MAXIMUM);
  if (count == null) return null;
  if (count.limit)
    return { words: t('briefing.atLimit', { max: STAFF_RULES_MAXIMUM }), limit: true };

  return { words: t('briefing.count', { n: count.n, max: STAFF_RULES_MAXIMUM }), limit: false };
}

/** Why there is nothing to send, where one applies: no shift first, then no number. */
export function noteOf(one: StaffEntry, t: TFunction): string | null {
  if (one.shifts.length === 0) return t('briefing.noShift');
  if (one.mobile == null) return t('briefing.noMobile');

  return null;
}

export const tallyOf = briefingTally;

/** Everyone with a shift, in roster order. */
export function withShifts(people: readonly StaffEntry[]): StaffEntry[] {
  return people.filter((one) => one.shifts.length > 0);
}

/** Copy link and Mark as sent are offered to staff.manage, with a mobile number who has not been erased. */
export function copies(one: StaffEntry, manages: boolean): boolean {
  return manages && one.mobile != null && !one.contactsErased;
}

export function offersMark(one: StaffEntry): boolean {
  return one.briefingCopy != null && !one.briefingCopy.marked;
}

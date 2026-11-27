import { STAFF_RULES_MAXIMUM, type StaffEntry } from '@soirely/api-client';
import { briefingTally, fitRules as fitHouseRules, rulesCount } from '@soirely/domain';
import type { TFunction } from 'i18next';

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

export function noteOf(one: StaffEntry, t: TFunction): string | null {
  if (one.shifts.length === 0) return t('briefing.noShift');
  if (one.mobile == null) return t('briefing.noMobile');

  return null;
}

export const tallyOf = briefingTally;

import { STAFF_RULES_MAXIMUM, type StaffBriefing, type StaffEntry } from '@soirely/api-client';
import type { TFunction } from 'i18next';

/** The rules' count shows from here, as the demo has it (sc-3917). */
const COUNT_FROM = 1800;

/** Code points, as the API counts them: "Ọ̀" is two. */
export function codePoints(text: string): number {
  return Array.from(text).length;
}

/** A key typed at the limit is not taken; a paste that would go over keeps its first part and says so. */
export function fitRules(before: string, typed: string): { text: string; cut: boolean } {
  if (codePoints(typed) <= STAFF_RULES_MAXIMUM) return { text: typed, cut: false };
  if (codePoints(typed) - codePoints(before) <= 1) return { text: before, cut: false };

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

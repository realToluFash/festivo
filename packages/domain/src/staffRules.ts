/** The house rules' count shows from here (sc-3917). */
export const STAFF_RULES_COUNT_FROM = 1800;

export type StaffBriefingState = 'read' | 'sent' | 'changed' | 'none';

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
export function fitRules(
  before: string,
  typed: string,
  maximum: number,
): { text: string; cut: boolean } {
  if (codePoints(typed) <= maximum) return { text: typed, cut: false };
  if (isOneKey(before, typed)) return { text: before, cut: false };

  return { text: Array.from(typed).slice(0, maximum).join(''), cut: true };
}

/** What the count line says, or null while it stays quiet. */
export function rulesCount(text: string, maximum: number): { n: number; limit: boolean } | null {
  const n = codePoints(text);
  if (n >= maximum) return { n, limit: true };
  if (n >= STAFF_RULES_COUNT_FROM) return { n, limit: false };

  return null;
}

/** Why a row has nothing to send, the order every client reads it in. */
export function briefingNote(one: {
  shifts: readonly unknown[];
  mobile: unknown;
}): 'noShift' | 'noMobile' | null {
  if (one.shifts.length === 0) return 'noShift';
  if (one.mobile == null) return 'noMobile';

  return null;
}

export function briefingTally(
  people: readonly { briefing: StaffBriefingState }[],
): Record<StaffBriefingState, number> {
  const tally: Record<StaffBriefingState, number> = { read: 0, sent: 0, changed: 0, none: 0 };
  for (const one of people) tally[one.briefing] += 1;

  return tally;
}

export type TwoFactorStanding = 'clear' | 'due' | 'overdue';

/** The clock is asked too, so a screen left open past the deadline closes without another fetch (sc-609). */
export function twoFactorStanding(
  due: { at: string; overdue: boolean } | null,
  now: number,
): TwoFactorStanding {
  if (due == null) return 'clear';

  return due.overdue || Date.parse(due.at) <= now ? 'overdue' : 'due';
}

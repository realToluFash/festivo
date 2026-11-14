import { describe, expect, it } from 'vitest';

import { twoFactorStanding } from './twoFactorDue.ts';

describe('a member’s standing under two-factor for everyone', () => {
  const at = '2026-10-24T13:20:00+00:00';

  it('is clear with no deadline to meet', () => {
    expect(twoFactorStanding(null, Date.parse(at))).toBe('clear');
  });

  it('is due until the deadline, and overdue from its instant on', () => {
    expect(twoFactorStanding({ at, overdue: false }, Date.parse(at) - 1)).toBe('due');
    expect(twoFactorStanding({ at, overdue: false }, Date.parse(at))).toBe('overdue');
  });

  it('believes the server when it says the deadline has passed', () => {
    expect(twoFactorStanding({ at, overdue: true }, Date.parse(at) - 60_000)).toBe('overdue');
  });
});

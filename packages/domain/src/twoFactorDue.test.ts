import { describe, expect, it } from 'vitest';

import { anyNotOverdue, twoFactorStanding } from './twoFactorDue.ts';

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

describe('whether a held page names other organisations', () => {
  const at = '2026-10-24T13:20:00+00:00';
  const now = Date.parse(at);

  it('counts none when there are none', () => {
    expect(anyNotOverdue([], now)).toBe(false);
  });

  it('counts none when the member is past the deadline in every one', () => {
    expect(
      anyNotOverdue(
        [{ twoFactorDue: { at, overdue: true } }, { twoFactorDue: { at, overdue: false } }],
        now,
      ),
    ).toBe(false);
  });

  it('counts one with no two-factor to meet', () => {
    expect(
      anyNotOverdue([{ twoFactorDue: { at, overdue: true } }, { twoFactorDue: null }], now),
    ).toBe(true);
  });

  it('counts one whose deadline is still ahead', () => {
    expect(anyNotOverdue([{ twoFactorDue: { at, overdue: false } }], now - 86_400_000)).toBe(true);
  });
});

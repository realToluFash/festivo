import { describe, expect, it } from 'vitest';

import {
  CHANGES,
  changeWhen,
  limitApplies,
  signInRulesStart,
  signInRulesStateOf,
  TITLE,
} from './SignInRulesSample.ts';

describe('Sign-in rules in the demo', () => {
  it('says when a change was made the way the locale keeps the clock', () => {
    const [twoFactor] = CHANGES;
    if (twoFactor == null) throw new Error('The sample has its changes.');

    expect(changeWhen(twoFactor, 'en-US')).toBe(
      'Wednesday, Oct 28 at 3:12 PM · Folake Adeyemi · Owner',
    );
    expect(changeWhen(twoFactor, 'en-GB')).toBe(
      'Wednesday 28 Oct at 15:12 · Folake Adeyemi · Owner',
    );
  });

  it('names the year only outside this one', () => {
    expect(changeWhen({ ...CHANGES[1]!, at: '2025-09-01T10:05' }, 'en-US')).toBe(
      'Monday, Sep 1, 2025 at 10:05 AM · Folake Adeyemi · Owner',
    );
  });

  it('keeps en.json’s words', () => {
    expect(TITLE).toBe('Ire Events’s sign-in rules');
    expect(limitApplies(7, 'Lumen Studio')).toBe(
      'For you, sign-ins end after 7 days without use: Lumen Studio’s rule, the shortest of your organisations.',
    );
    expect(limitApplies(1, 'Lumen Studio')).toContain('after 1 day without use');
  });

  it('starts each state a link names, and the whole page otherwise', () => {
    expect(signInRulesStateOf('noChanges')).toBe('noChanges');
    expect(signInRulesStateOf('nonsense')).toBe('rules');
    expect(signInRulesStateOf(undefined)).toBe('rules');

    const none = signInRulesStart('noChanges');
    expect(none.changes).toEqual([]);
    expect(none.limit).toBeNull();
    expect(none.rules.map(({ value }) => value)).toContain('Sign-ins last until you sign out');
    expect(signInRulesStart('failed').load).toBe('failed');
    expect(signInRulesStart('rules').limit).toEqual({ days: 7, organisation: 'Lumen Studio' });
  });
});

import { describe, expect, it } from 'vitest';

import { VIEWERS } from './settings.ts';
import {
  SIGN_IN_RULES_PAGES,
  SIGN_IN_RULES_STATES,
  applied,
  changeRows,
  dayIn,
  effectsOf,
  holdOf,
  refusalOf,
  roleOf,
  signInRulesStart,
} from './signInRules.ts';

const NOW = '2026-11-05T10:30';
const page = (state: string) => signInRulesStart(state, 'Folake Adeyemi', NOW).page;

describe('Sign-in rules’ sample (sc-30064)', () => {
  it('names the three roles from what the viewer holds', () => {
    expect(roleOf(VIEWERS.folake)).toBe('Owner');
    expect(roleOf(VIEWERS.julien)).toBe('Admin');
    expect(roleOf(VIEWERS.ana)).toBe('Member');
  });

  it('writes the year only outside this one', () => {
    expect(dayIn('2026-10-28T15:12', 'en-US', 2026)).toBe('Oct 28');
    expect(dayIn('2025-10-28T15:12', 'en-US', 2026)).toBe('Oct 28, 2025');
    expect(dayIn('2026-10-28T15:12', 'en-GB', 2026)).toBe('28 Oct');
    expect(dayIn('2026-11-11', 'en-US', 2026, true)).toBe('Wednesday, Nov 11');
  });

  it('tags a change after the last one seen as New', () => {
    const rows = changeRows(page('newChange').changes, page('newChange').seen, 'en-US', 2026);

    expect(rows.map((row) => row.isNew)).toEqual([true, false]);
    expect(rows[0]?.line).toBe('Oct 28 · was off · Folake Adeyemi');
  });

  it('holds changes for a member, for an unlinked account and for a manager without two-factor', () => {
    expect(holdOf(page(''), 'Owner')).toBeNull();
    expect(holdOf(page(''), 'Member')).toBe('member');
    expect(holdOf(page('googleOnly'), 'Admin')).toBe('linked');
    expect(holdOf(page('twoFactorDue'), 'Admin')).toBe('twoFactor');
  });

  it('keeps managers’ two-factor under everyone’s, and drops both for Not required', () => {
    const everyone = page('everyone');

    expect(applied('twoFactor', 'For managers', everyone)).toMatchObject({
      administratorsNeedTwoFactor: true,
      everyoneNeedsTwoFactor: false,
    });
    expect(applied('twoFactor', 'Not required', everyone)).toMatchObject({
      administratorsNeedTwoFactor: false,
      everyoneNeedsTwoFactor: false,
    });
    expect(applied('twoFactor', 'For everyone', page('noChanges'))).toMatchObject({
      administratorsNeedTwoFactor: false,
      everyoneNeedsTwoFactor: true,
    });
  });

  it('refuses only a rule the viewer does not meet, and never the one in force', () => {
    expect(refusalOf('method', 'Google or Apple only', page('methodRefused'))).toBe('provider');
    expect(refusalOf('method', 'Google or Apple only', page(''))).toBeNull();
    expect(refusalOf('twoFactor', 'For managers', page('twoFactorRefused'))).toBe('twoFactor');
    expect(refusalOf('twoFactor', 'Not required', page('twoFactorRefused'))).toBeNull();
    expect(refusalOf('twoFactor', 'For everyone', page('everyone'))).toBeNull();
  });

  it('says what saving does in the product’s words, or that nothing changes', () => {
    const rules = page('');

    expect(
      effectsOf(rules, applied('method', 'Google or Apple only', rules), rules.passwordOnly),
    ).toEqual([
      'Everyone signs in with Google or Apple. Anyone with one linked who signed in with a password is asked to sign in again with it.',
      'Priya Shah and Ana Souza can read but not change anything until they link Google or Apple. Their password still signs them in.',
    ]);
    expect(effectsOf(rules, applied('limit', 'No limit', rules), [])).toEqual([
      'Sign-ins last until people sign out.',
    ]);
    expect(effectsOf(rules, rules, [])).toEqual(['Nothing changes. These are the rules in force.']);
  });

  it('saves a change today, by the viewer, at the top', () => {
    const saved = page('limitSaved');

    expect(saved.inactivityTimeoutDays).toBe(7);
    expect(saved.changes[0]).toEqual({
      rule: 'inactivityTimeoutDays',
      now: 7,
      was: 30,
      at: NOW,
      by: 'Folake Adeyemi',
    });
  });

  it('links every state from the demo home', () => {
    const linked = SIGN_IN_RULES_PAGES.flatMap((group) => group.states).map((state) =>
      new URL(state.to, 'https://demo.test').searchParams.get('state'),
    );

    expect(new Set(linked)).toEqual(new Set([null, ...SIGN_IN_RULES_STATES]));
  });
});

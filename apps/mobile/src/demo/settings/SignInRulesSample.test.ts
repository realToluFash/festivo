import { describe, expect, it } from 'vitest';

import {
  ASK_OWNER,
  type Change,
  changeRows,
  changeTitle,
  dayIn,
  MANAGERS_ARE,
  type RulesPage,
  type RulesViewer,
  ruleLabel,
  rulesCard,
  type SignInRulesState,
  signInRulesStart,
  signInRulesStateOf,
  standFoot,
  wasWords,
  whereYouStand,
} from './SignInRulesSample.ts';
import { memberLooking } from './sample.ts';

const BY = { name: 'Folake Adeyemi' };

function seen(state: SignInRulesState, locale = 'en-US') {
  const { page, viewer } = signInRulesStart(state);
  const rules = whereYouStand(page, viewer, locale);

  return { page, viewer, rules, card: rulesCard(rules, viewer) };
}

function standing(page: Partial<RulesPage>, viewer: Partial<RulesViewer> = {}) {
  const start = signInRulesStart('rules');

  return whereYouStand({ ...start.page, ...page }, { ...start.viewer, ...viewer }, 'en-US');
}

function rule(page: Partial<RulesPage>, key: string, viewer: Partial<RulesViewer> = {}) {
  const found = standing(page, viewer).find((one) => one.key === key);
  if (found == null) throw new Error(`No ${key} row.`);

  return { mark: found.mark, title: found.title, line: found.line };
}

describe('Sign-in rules: where you stand', () => {
  it('meets every rule in the whole page, and the card says who may change them', () => {
    const { rules, card } = seen('rules');

    expect(rules.map(({ key, mark }) => [key, mark])).toEqual([
      ['method', 'met'],
      ['limit', 'met'],
      ['twoFactor', 'met'],
    ]);
    expect(card).toEqual({
      says: 'You meet Ire Events’ rules',
      line: 'To change them, use Soirely on the web.',
      step: null,
    });
    expect(rules.map(ruleLabel)).toEqual([
      'Met. Sign in any way. Password, Google and Apple all work.',
      'Met. Signed out after 30 days unused. For you, 7 days: Lumen Studio’s rule is shorter.',
      'Met. Two-factor for managers. Yours is on.',
    ]);
  });

  it('asks a manager without two-factor to turn it on', () => {
    const { rules, card } = seen('twoFactorDue');

    expect(rules.filter(({ mark }) => mark === 'needs').map(({ key }) => key)).toEqual([
      'twoFactor',
    ]);
    expect(card).toEqual({
      says: '1 rule needs you',
      line: 'Until it’s on, changes to members, billing or security wait. Your events keep working.',
      step: 'Turn on two-factor',
    });
    expect(ruleLabel(rules[2]!)).toBe(
      'Needs you. Two-factor for managers. Not on yet. Changes to members wait until it is.',
    );
  });

  it('tells somebody who manages nothing the managers rule is not theirs', () => {
    const { viewer, rules, card } = seen('notYours');

    expect(ruleLabel(rules[2]!)).toBe(
      'Doesn’t apply. Two-factor for managers. Doesn’t apply to your role, Member.',
    );
    expect(rules[1]!.line).toBe('After 30 days without Soirely, you sign in again.');
    expect(card).toEqual({
      says: 'You meet Ire Events’ rules',
      line: 'Set by its owners and admins. Only they can change them.',
      step: null,
    });
    expect(viewer.setsRules).toBe(false);
  });

  it('gives the everyone deadline in the locale, the year only outside this one', () => {
    expect(seen('everyone').card).toEqual({
      says: '1 rule needs you',
      line: 'Turn it on by Wednesday, Nov 11, or you can’t open Ire Events after that.',
      step: 'Turn on two-factor',
    });
    expect(seen('everyone', 'en-GB').rules[2]).toMatchObject({
      mark: 'needs',
      title: 'Two-factor for everyone',
      line: 'Not on yet. Turn it on by Wednesday 11 Nov.',
    });
    expect(dayIn('2027-01-05T10:00', 'en-US')).toBe('Jan 5, 2027');
    expect(dayIn('2026-10-28T15:12', 'en-GB')).toBe('28 Oct');
  });

  it('asks somebody with only a password to link Google or Apple', () => {
    const { rules, card } = seen('googleOnly');

    expect(rules.map(({ mark }) => mark)).toEqual(['needs', 'met', 'notApplicable']);
    expect(rules[0]!.line).toBe(
      'Your password still signs you in. Link one to change things again.',
    );
    expect(card).toEqual({
      says: '1 rule needs you',
      line: 'Until you link one, you can read but not change anything in Ire Events.',
      step: 'Link Google or Apple',
    });
  });

  it('counts two rules, and leads with the first', () => {
    const rules = standing({ providerOnly: true, ownTwoFactor: false }, { linked: null });
    const card = rulesCard(rules, signInRulesStart('rules').viewer);

    expect(card.says).toBe('2 rules need you');
    expect(card.step).toBe('Link Google or Apple');
  });

  it('writes each way of signing in', () => {
    expect(rule({ providerOnly: true }, 'method', { linked: 'Apple' })).toEqual({
      mark: 'met',
      title: 'Google or Apple only',
      line: 'You have Apple linked.',
    });
  });

  it('writes how long a sign-in lasts, with a shorter limit elsewhere', () => {
    const lumen = { organisation: 'Lumen Studio', days: 7 };
    const here = { organisation: 'Ire Events', days: 30 };

    expect(rule({ inactivityLimit: here }, 'limit')).toEqual({
      mark: 'met',
      title: 'Signed out after 30 days unused',
      line: 'After 30 days without Soirely, you sign in again.',
    });
    expect(rule({ inactivityTimeoutDays: null, inactivityLimit: lumen }, 'limit')).toEqual({
      mark: 'met',
      title: 'No limit on sign-ins',
      line: 'For you, 7 days: Lumen Studio’s rule.',
    });
    expect(rule({ inactivityTimeoutDays: null, inactivityLimit: null }, 'limit').line).toBe(
      'You stay signed in until you sign out.',
    );
    expect(rule({ inactivityTimeoutDays: 1, inactivityLimit: null }, 'limit').title).toBe(
      'Signed out after 1 day unused',
    );
  });

  it('shows two-factor as one row, everyone over managers', () => {
    const neither = { administratorsNeedTwoFactor: false, everyoneNeedsTwoFactor: false };

    expect(rule(neither, 'twoFactor')).toEqual({
      mark: 'met',
      title: 'Two-factor not required',
      line: 'Yours is on anyway.',
    });
    expect(rule({ ...neither, ownTwoFactor: false }, 'twoFactor').line).toBe(
      'You can turn it on in Security.',
    );
    expect(rule({ everyoneNeedsTwoFactor: true }, 'twoFactor')).toEqual({
      mark: 'met',
      title: 'Two-factor for everyone',
      line: 'Yours is on.',
    });
    expect(
      rule({ ownTwoFactor: false }, 'twoFactor', { manages: ['members', 'billing', 'security'] })
        .line,
    ).toBe('Not on yet. Changes to members, billing and security wait until it is.');
  });

  it('explains managers only while that rule is the one in force', () => {
    expect(standFoot(seen('rules').page)).toBe(MANAGERS_ARE);
    expect(MANAGERS_ARE).toBe('Managers are owners and admins.');
    expect(standFoot(seen('everyone').page)).toBeUndefined();
    expect(standFoot(seen('noChanges').page)).toBeUndefined();
    expect(ASK_OWNER).toBe('Questions? Ask an owner or admin of Ire Events.');
  });
});

describe('Sign-in rules: what changed', () => {
  it('titles each rule with its new value, and says what it was', () => {
    const cases: [Change, string, string][] = [
      [
        { rule: 'providerOnly', now: true, was: false, at: '', by: BY },
        'How people sign in: Google or Apple only',
        'was any way',
      ],
      [
        { rule: 'providerOnly', now: false, was: true, at: '', by: BY },
        'How people sign in: any way',
        'was Google or Apple only',
      ],
      [
        { rule: 'inactivityTimeoutDays', now: 30, was: null, at: '', by: BY },
        'Signed out after: 30 days unused',
        'was no limit',
      ],
      [
        { rule: 'inactivityTimeoutDays', now: null, was: 30, at: '', by: BY },
        'Signed out after: no limit',
        'was 30 days',
      ],
      [
        { rule: 'administratorsNeedTwoFactor', now: true, was: false, at: '', by: BY },
        'Two-factor for managers: on',
        'was off',
      ],
      [
        { rule: 'everyoneNeedsTwoFactor', now: false, was: true, at: '', by: BY },
        'Two-factor for everyone: off',
        'was on',
      ],
    ];

    for (const [change, title, was] of cases) {
      expect(changeTitle(change)).toBe(title);
      expect(wasWords(change)).toBe(was);
    }
  });

  it('lists the changes newest first, the day as the locale writes it', () => {
    const { page, viewer } = signInRulesStart('rules');

    expect(changeRows(page.changes, viewer.seen, 'en-US')).toEqual([
      {
        at: '2026-10-28T15:12',
        title: 'Two-factor for managers: on',
        line: 'Oct 28 · was off · Folake Adeyemi',
        isNew: false,
        label: 'Two-factor for managers: on. Oct 28. was off. Folake Adeyemi',
      },
      {
        at: '2026-09-01T10:05',
        title: 'Signed out after: 30 days unused',
        line: 'Sep 1 · was no limit · Folake Adeyemi',
        isNew: false,
        label: 'Signed out after: 30 days unused. Sep 1. was no limit. Folake Adeyemi',
      },
    ]);
    expect(changeRows(page.changes, viewer.seen, 'en-GB')[0]!.line).toBe(
      '28 Oct · was off · Folake Adeyemi',
    );
  });

  it('marks New what this device has not shown yet', () => {
    const fresh = (state: SignInRulesState) => {
      const { page, viewer } = signInRulesStart(state);

      return changeRows(page.changes, viewer.seen, 'en-US').map(({ isNew }) => isNew);
    };

    expect(fresh('newChange')).toEqual([true, false]);
    expect(fresh('everyone')).toEqual([true, false, false]);
    expect(fresh('googleOnly')).toEqual([true, false, false]);
    expect(changeRows(signInRulesStart('everyone').page.changes, null, 'en-US')[0]!.label).toBe(
      'Two-factor for everyone: on. New. Nov 4. was off. Folake Adeyemi',
    );
    expect(signInRulesStart('noChanges').page.changes).toEqual([]);
  });

  it('opens each state a link names, and the whole page otherwise', () => {
    expect(signInRulesStateOf('googleOnly')).toBe('googleOnly');
    expect(signInRulesStateOf('owner')).toBe('rules');
    expect(signInRulesStateOf(undefined)).toBe('rules');
    expect(signInRulesStart('failed').load).toBe('failed');
    expect(signInRulesStart('loading').load).toBe('loading');
  });

  it('is seen by a member of the sample, whose role the page reads', () => {
    const looking = (state: SignInRulesState) => {
      const { viewer } = signInRulesStart(state);

      return { ...memberLooking(viewer.id), held: viewer.role };
    };

    expect(looking('rules')).toMatchObject({ name: 'Julien Moreau', role: 'Admin', held: 'Admin' });
    expect(looking('notYours')).toMatchObject({ name: 'Priya Shah', held: 'Member' });
    expect(looking('googleOnly')).toMatchObject({ name: 'Ana Souza', held: 'Member' });
  });
});

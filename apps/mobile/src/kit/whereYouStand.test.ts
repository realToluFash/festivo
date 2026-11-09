import { t, init } from 'i18next';
import { beforeAll, describe, expect, it } from 'vitest';

import en from '../i18n/locales/en.json';

import {
  type Change,
  changeRows,
  changeTitle,
  dayIn,
  managedAreas,
  ruleLabel,
  rulesCard,
  type StandRules,
  type StandViewer,
  standFoot,
  wasWords,
  whereYouStand,
} from './whereYouStand.ts';

beforeAll(() =>
  init({
    lng: 'en',
    resources: { en: { translation: en } },
    interpolation: { escapeValue: false },
  }),
);

const NOW = new Date('2026-11-04T12:00:00Z');
const BY = { name: 'Folake Adeyemi' };

const RULES: StandRules = {
  providerOnly: false,
  inactivityTimeoutDays: 30,
  administratorsNeedTwoFactor: true,
  everyoneNeedsTwoFactor: false,
  twoFactorDeadline: '2026-11-11',
  elsewhere: { organisation: 'Lumen Studio', days: 7 },
  ownTwoFactor: true,
};

const ADMIN: StandViewer = {
  organisation: 'Ire Events',
  role: 'Admin',
  manages: ['members'],
  setsRules: true,
  linked: 'Google',
};

const MEMBER: StandViewer = {
  ...ADMIN,
  role: 'Member',
  manages: [],
  setsRules: false,
  linked: null,
};

function standing(rules: Partial<StandRules> = {}, viewer: Partial<StandViewer> = {}) {
  const rows = whereYouStand(t, { ...RULES, ...rules }, { ...ADMIN, ...viewer }, 'en-US', NOW);

  return { rows, card: rulesCard(t, rows, { ...ADMIN, ...viewer }) };
}

function rule(rules: Partial<StandRules>, key: string, viewer: Partial<StandViewer> = {}) {
  const found = standing(rules, viewer).rows.find((one) => one.key === key);
  if (found == null) throw new Error(`No ${key} row.`);

  return { mark: found.mark, title: found.title, line: found.line };
}

describe('Sign-in rules: where you stand', () => {
  it('meets every rule, and the card says who may change them', () => {
    const { rows, card } = standing();

    expect(rows.map(({ key, mark }) => [key, mark])).toEqual([
      ['method', 'met'],
      ['limit', 'met'],
      ['twoFactor', 'met'],
    ]);
    expect(card).toEqual({
      says: 'You meet Ire Events’s rules',
      line: 'To change them, use Soirely on the web.',
      step: null,
    });
    expect(rows.map((row) => ruleLabel(t, row))).toEqual([
      'Met. Sign in any way. Password, Google and Apple all work.',
      'Met. Signed out after 30 days unused. For you, 7 days: Lumen Studio’s rule is shorter.',
      'Met. Two-factor for managers. Yours is on.',
    ]);
  });

  it('asks a manager without two-factor to turn it on', () => {
    const { rows, card } = standing({ ownTwoFactor: false });

    expect(rows.filter(({ mark }) => mark === 'needs').map(({ key }) => key)).toEqual([
      'twoFactor',
    ]);
    expect(card).toEqual({
      says: '1 rule needs you',
      line: 'Until it’s on, changes to members, billing or security wait. Your events keep working.',
      step: { label: 'Turn on two-factor', opens: 'twoFactor' },
    });
    expect(ruleLabel(t, rows[2]!)).toBe(
      'Needs you. Two-factor for managers. Not on yet. Changes to members wait until it is.',
    );
  });

  it('tells somebody who manages nothing the managers rule is not theirs', () => {
    const { rows, card } = standing({ ownTwoFactor: false, elsewhere: null }, MEMBER);

    expect(ruleLabel(t, rows[2]!)).toBe(
      'Doesn’t apply. Two-factor for managers. Doesn’t apply to your role, Member.',
    );
    expect(rows[1]!.line).toBe('After 30 days without Soirely, you sign in again.');
    expect(card).toEqual({
      says: 'You meet Ire Events’s rules',
      line: 'Set by its owners and admins. Only they can change them.',
      step: null,
    });
  });

  it('gives the everyone deadline in the locale', () => {
    const everyone = { everyoneNeedsTwoFactor: true, ownTwoFactor: false };

    expect(standing(everyone).card).toEqual({
      says: '1 rule needs you',
      line: 'Turn it on by Wednesday, Nov 11, or you can’t open Ire Events after that.',
      step: { label: 'Turn on two-factor', opens: 'twoFactor' },
    });
    expect(rule(everyone, 'twoFactor')).toEqual({
      mark: 'needs',
      title: 'Two-factor for everyone',
      line: 'Not on yet. Turn it on by Wednesday, Nov 11.',
    });
  });

  it('asks somebody with only a password to link Google or Apple', () => {
    const { rows, card } = standing(
      { providerOnly: true, ownTwoFactor: false, elsewhere: null },
      MEMBER,
    );

    expect(rows.map(({ mark }) => mark)).toEqual(['needs', 'met', 'notApplicable']);
    expect(rows[0]!.line).toBe(
      'Your password still signs you in. Link one to change things again.',
    );
    expect(card).toEqual({
      says: '1 rule needs you',
      line: 'Until you link one, you can read but not change anything in Ire Events.',
      step: { label: 'Link Google or Apple', opens: 'link' },
    });
  });

  it('counts two rules, and leads with the first', () => {
    const { card } = standing({ providerOnly: true, ownTwoFactor: false }, { linked: null });

    expect(card.says).toBe('2 rules need you');
    expect(card.step).toEqual({ label: 'Link Google or Apple', opens: 'link' });
  });

  it('writes each way of signing in', () => {
    expect(rule({ providerOnly: true }, 'method', { linked: 'Apple' })).toEqual({
      mark: 'met',
      title: 'Google or Apple only',
      line: 'You have Apple linked.',
    });
  });

  it('writes how long a sign-in lasts, with a shorter limit elsewhere', () => {
    expect(rule({ elsewhere: null }, 'limit')).toEqual({
      mark: 'met',
      title: 'Signed out after 30 days unused',
      line: 'After 30 days without Soirely, you sign in again.',
    });
    expect(rule({ inactivityTimeoutDays: null }, 'limit')).toEqual({
      mark: 'met',
      title: 'No limit on sign-ins',
      line: 'For you, 7 days: Lumen Studio’s rule.',
    });
    expect(rule({ inactivityTimeoutDays: 5 }, 'limit').line).toBe(
      'After 5 days without Soirely, you sign in again.',
    );
    expect(rule({ inactivityTimeoutDays: null, elsewhere: null }, 'limit').line).toBe(
      'You stay signed in until you sign out.',
    );
    expect(rule({ inactivityTimeoutDays: 1, elsewhere: null }, 'limit').title).toBe(
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
    ).toBe('Not on yet. Changes to members, billing, and security wait until it is.');
  });

  it('explains managers only while that rule is the one in force', () => {
    expect(standFoot(t, RULES)).toBe('Managers are owners and admins.');
    expect(standFoot(t, { ...RULES, everyoneNeedsTwoFactor: true })).toBeUndefined();
    expect(standFoot(t, { ...RULES, administratorsNeedTwoFactor: false })).toBeUndefined();
  });

  it('reads the areas a role manages from its permissions', () => {
    expect(managedAreas(['organisation.manage', 'events.edit', 'members.invite'])).toEqual([
      'members',
      'security',
    ]);
    expect(managedAreas(['events.edit'])).toEqual([]);
  });
});

describe('Sign-in rules: the day', () => {
  it('writes an instant on the reader’s calendar, not the server’s', () => {
    const deadline = '2026-11-12T02:00:00+00:00';

    expect(dayIn(deadline, 'en-US', NOW, { weekday: true, timeZone: 'America/New_York' })).toBe(
      'Wednesday, Nov 11',
    );
    expect(dayIn(deadline, 'en-US', NOW, { weekday: true, timeZone: 'Europe/London' })).toBe(
      'Thursday, Nov 12',
    );
    expect(
      dayIn('2026-10-28T23:30:00+00:00', 'en-GB', NOW, { timeZone: 'America/Los_Angeles' }),
    ).toBe('28 Oct');
    expect(
      dayIn('2026-10-29T03:30:00+00:00', 'en-GB', NOW, { timeZone: 'America/Los_Angeles' }),
    ).toBe('28 Oct');
  });

  it('keeps a bare date as that calendar day wherever the reader is', () => {
    expect(dayIn('2026-11-11', 'en-US', NOW, { timeZone: 'Pacific/Honolulu' })).toBe('Nov 11');
    expect(dayIn('2026-11-11', 'en-US', NOW, { timeZone: 'Pacific/Kiritimati' })).toBe('Nov 11');
  });

  it('writes the year only outside this one', () => {
    expect(dayIn('2027-01-05T10:00:00Z', 'en-US', NOW, { timeZone: 'UTC' })).toBe('Jan 5, 2027');
    expect(dayIn('2026-12-31T23:30:00Z', 'en-US', NOW, { timeZone: 'Asia/Tokyo' })).toBe(
      'Jan 1, 2027',
    );
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
      expect(changeTitle(t, change)).toBe(title);
      expect(wasWords(t, change)).toBe(was);
    }
  });

  const CHANGES: Change[] = [
    { rule: 'inactivityTimeoutDays', now: 30, was: null, at: '2026-09-01T12:00:00Z', by: BY },
    {
      rule: 'administratorsNeedTwoFactor',
      now: true,
      was: false,
      at: '2026-10-28T12:00:00Z',
      by: BY,
    },
  ];

  it('lists the changes newest first, the day as the locale writes it', () => {
    expect(changeRows(t, CHANGES, '2026-10-28T12:00:00Z', 'en-US', NOW)).toEqual([
      {
        at: '2026-10-28T12:00:00Z',
        title: 'Two-factor for managers: on',
        line: 'Oct 28 · was off · Folake Adeyemi',
        isNew: false,
        label: 'Two-factor for managers: on. Oct 28. was off. Folake Adeyemi',
      },
      {
        at: '2026-09-01T12:00:00Z',
        title: 'Signed out after: 30 days unused',
        line: 'Sep 1 · was no limit · Folake Adeyemi',
        isNew: false,
        label: 'Signed out after: 30 days unused. Sep 1. was no limit. Folake Adeyemi',
      },
    ]);
    expect(changeRows(t, CHANGES, null, 'en-GB', NOW)[0]!.line).toBe(
      '28 Oct · was off · Folake Adeyemi',
    );
  });

  it('marks New what this device has not shown yet', () => {
    const fresh = (seen: string | null) =>
      changeRows(t, CHANGES, seen, 'en-US', NOW).map(({ isNew }) => isNew);

    expect(fresh('2026-09-01T12:00:00Z')).toEqual([true, false]);
    expect(fresh(null)).toEqual([true, true]);
    expect(changeRows(t, CHANGES, null, 'en-US', NOW)[0]!.label).toBe(
      'Two-factor for managers: on. New. Oct 28. was off. Folake Adeyemi',
    );
  });
});

import type { Membership } from '@soirely/api-client';
import { type TFunction } from 'i18next';
import { describe, expect, it } from 'vitest';

import {
  codeTimedOutFromParams,
  limitFromElsewhere,
  providerNames,
  refusalFromParams,
  ruleRefusal,
  rulesNotices,
  saidOnWelcome,
  signInRoute,
  timedOutSignIn,
} from './signInRules.ts';

const TIMED_OUT = {
  type: 'https://soirely.com/errors/session_timed_out',
  title: 'Signed out.',
  status: 401,
  organisation: 'Ìrè Events',
  days: 30,
  email: 'folake@ire.events',
};

const PROVIDER_ONLY = {
  type: 'https://soirely.com/errors/oauth_only',
  title: 'No.',
  status: 403,
  organisation: 'Ìrè Events',
  providers: ['google'],
  email: 'folake@ire.events',
};

function membership(overrides: Partial<Membership> = {}): Membership {
  return {
    id: 'org_1',
    name: 'Ìrè Events',
    countryCode: 'NG',
    currency: 'NGN',
    timezone: 'Africa/Lagos',
    contactAddress: 'hello@ire.events',
    locale: 'en',
    role: { id: 'role_2', seededAs: 'administrator', name: null },
    permissions: ['events.read'],
    withheldUntilTwoFactor: [],
    readOnlyUntilLinked: false,
    withheldUntilLinked: [],
    twoFactorDue: null,
    signInRules: {
      providerOnly: false,
      inactivityTimeoutDays: null,
      administratorsNeedTwoFactor: false,
      everyoneNeedsTwoFactor: false,
      changedAt: null,
    },
    ...overrides,
  };
}

describe('why a rule sent somebody to sign-in (sc-69)', () => {
  it('reads an inactivity limit and a provider-only refusal, and nothing else', () => {
    expect(ruleRefusal(TIMED_OUT)).toEqual({
      kind: 'timedOut',
      organisation: 'Ìrè Events',
      days: 30,
      email: 'folake@ire.events',
    });
    expect(ruleRefusal(PROVIDER_ONLY)).toEqual({
      kind: 'providerOnly',
      organisation: 'Ìrè Events',
      providers: ['google'],
      email: 'folake@ire.events',
    });
    expect(
      ruleRefusal({
        type: 'https://soirely.com/errors/unauthenticated',
        title: 'No.',
        status: 401,
      }),
    ).toBeNull();
    expect(ruleRefusal(undefined)).toBeNull();
  });

  it('carries the refusal through sign-in’s query and back, the address included', () => {
    for (const why of [TIMED_OUT, PROVIDER_ONLY]) {
      const refusal = ruleRefusal(why);
      const query = signInRoute(refusal, true).split('?')[1] ?? '';

      expect(refusalFromParams(Object.fromEntries(new URLSearchParams(query)))).toEqual(refusal);
    }
  });

  it('says on welcome that the session ended, and on sign-in that a password was turned away (sc-29076)', () => {
    expect(signInRoute(null, true)).toBe('/welcome?signedOut=1');
    expect(signInRoute(ruleRefusal(TIMED_OUT), true)).toMatch(/^\/welcome\?/);
    expect(signInRoute(ruleRefusal(PROVIDER_ONLY), true)).toMatch(/^\/sign-in\?/);
    expect(signInRoute(ruleRefusal(PROVIDER_ONLY), false)).not.toMatch(/signedOut/);
  });

  it('ignores a malformed query rather than naming nobody', () => {
    expect(refusalFromParams({ rule: 'timedOut', organisation: 'Ìrè Events', days: 'x' })).toBe(
      null,
    );
    expect(refusalFromParams({ rule: 'providerOnly' })).toBeNull();
    expect(refusalFromParams({ signedOut: '1' })).toBeNull();
  });

  it.each([
    ['nothing', {}, null, null],
    ['a plain sign-out', { signedOut: '1' }, null, 'signIn.endedTitle'],
    ['a timed-out rule', TIMED_OUT_QUERY, null, 'signIn.timedOutTitle'],
    [
      'a timed-out rule, then Google failing',
      TIMED_OUT_QUERY,
      'Google',
      'signIn.providerFailedTitle',
    ],
    [
      'a plain sign-out, then Apple failing',
      { signedOut: '1' },
      'Apple',
      'signIn.providerFailedTitle',
    ],
  ])('says on the welcome, after %s', (_, params, providerFailed, title) => {
    expect(saidOnWelcome(params, providerFailed, KEYS)?.[0] ?? null).toBe(title);
  });

  it('says on sign-in that a two-factor sign-in ran out, the address kept (sc-29961)', () => {
    const { params } = timedOutSignIn('ada@example.com');

    expect(codeTimedOutFromParams(params)).toBe(true);
    expect(params.email).toBe('ada@example.com');
    expect(codeTimedOutFromParams({ signedOut: '1' })).toBe(false);
  });

  it('names Google and Apple when the refusal named no provider', () => {
    expect(providerNames([])).toEqual(['Google', 'Apple']);
    expect(providerNames(['apple'])).toEqual(['Apple']);
  });
});

describe('what the rules ask of a member, on the home screen', () => {
  it('asks nothing of a member the rules leave alone', () => {
    expect(rulesNotices(membership(), null, false)).toEqual([]);
  });

  it('stacks read-only, two-factor and the change, in the design’s order', () => {
    const changedAt = '2026-10-15T17:40:00+00:00';
    const held = membership({
      readOnlyUntilLinked: true,
      twoFactorDue: null,
      withheldUntilTwoFactor: ['members.read'],
      signInRules: {
        providerOnly: true,
        inactivityTimeoutDays: null,
        administratorsNeedTwoFactor: true,
        everyoneNeedsTwoFactor: false,
        changedAt,
      },
    });

    expect(rulesNotices(held, null, false)).toEqual(['readOnly', 'twoFactor', 'changed']);
    expect(rulesNotices(held, changedAt, true)).toEqual(['readOnly']);
    expect(rulesNotices(held, undefined, true)).toEqual(['readOnly']);
  });

  it('puts the deadline for two-factor of everyone first, and nothing past it (sc-609)', () => {
    const held = membership({
      withheldUntilTwoFactor: ['members.read'],
      twoFactorDue: { at: '2026-10-24T13:20:00+00:00', written: 'Saturday', overdue: false },
    });

    expect(rulesNotices(held, null, false, 'due')).toEqual(['due', 'twoFactor']);
    expect(rulesNotices(held, null, false, 'overdue')).toEqual([]);
  });

  it('names another organisation’s shorter limit, and not this one’s own', () => {
    const lumen = { organisationId: 'org_2', organisation: 'Studio Lumen', days: 7 };

    expect(limitFromElsewhere(lumen, 'org_1')).toEqual({ organisation: 'Studio Lumen', days: 7 });
    expect(limitFromElsewhere(lumen, 'org_2')).toBeNull();
    expect(limitFromElsewhere(null, 'org_1')).toBeNull();
  });
});

const KEYS = ((key: string) => key) as TFunction;
const TIMED_OUT_QUERY = {
  signedOut: '1',
  rule: 'timedOut',
  organisation: 'Ìrè Events',
  days: '30',
};

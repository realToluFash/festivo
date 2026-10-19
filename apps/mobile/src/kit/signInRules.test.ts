import type { Membership } from '@soirely/api-client';
import { describe, expect, it } from 'vitest';

import {
  limitFromElsewhere,
  providerNames,
  refusalFromParams,
  ruleRefusal,
  ruleValue,
  rulesNotices,
  signInRoute,
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
};

function membership(overrides: Partial<Membership> = {}): Membership {
  return {
    id: 'org_1',
    name: 'Ìrè Events',
    countryCode: 'NG',
    currency: 'NGN',
    timezone: 'Africa/Lagos',
    contactAddress: 'hello@ire.events',
    role: { id: 'role_2', seededAs: 'administrator', name: null },
    permissions: ['events.read'],
    withheldUntilTwoFactor: [],
    readOnlyUntilLinked: false,
    signInRules: {
      providerOnly: false,
      inactivityTimeoutDays: null,
      administratorsNeedTwoFactor: false,
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

  it('says only that the session ended when no rule ended it', () => {
    expect(signInRoute(null, true)).toBe('/sign-in?signedOut=1');
    expect(signInRoute(ruleRefusal(PROVIDER_ONLY), false)).not.toMatch(/signedOut/);
  });

  it('ignores a malformed query rather than naming nobody', () => {
    expect(refusalFromParams({ rule: 'timedOut', organisation: 'Ìrè Events', days: 'x' })).toBe(
      null,
    );
    expect(refusalFromParams({ rule: 'providerOnly' })).toBeNull();
    expect(refusalFromParams({ signedOut: '1' })).toBeNull();
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
      withheldUntilTwoFactor: ['members.read'],
      signInRules: {
        providerOnly: true,
        inactivityTimeoutDays: null,
        administratorsNeedTwoFactor: true,
        changedAt,
      },
    });

    expect(rulesNotices(held, null, false)).toEqual(['readOnly', 'twoFactor', 'changed']);
    expect(rulesNotices(held, changedAt, true)).toEqual(['readOnly']);
    expect(rulesNotices(held, undefined, true)).toEqual(['readOnly']);
  });

  it('words each rule’s value, a count with its plural', () => {
    const said: unknown[] = [];
    const t = ((key: string, options?: unknown) => {
      said.push(options == null ? key : [key, options]);
      return key;
    }) as unknown as Parameters<typeof ruleValue>[0];

    ruleValue(t, 'providerOnly', true);
    ruleValue(t, 'inactivityTimeoutDays', 7);
    ruleValue(t, 'inactivityTimeoutDays', null);
    ruleValue(t, 'administratorsNeedTwoFactor', false);

    expect(said).toEqual([
      'signInRules.valueProviderOnly',
      ['signInRules.valueIdle', { count: 7 }],
      'signInRules.valueNoLimit',
      'signInRules.valueNoTwoFactor',
    ]);
  });

  it('names another organisation’s shorter limit, and not this one’s own', () => {
    const lumen = { organisationId: 'org_2', organisation: 'Studio Lumen', days: 7 };

    expect(limitFromElsewhere(lumen, 'org_1')).toEqual({ organisation: 'Studio Lumen', days: 7 });
    expect(limitFromElsewhere(lumen, 'org_2')).toBeNull();
    expect(limitFromElsewhere(null, 'org_1')).toBeNull();
  });
});

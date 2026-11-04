import { describe, expect, it } from 'vitest';

import { landingFor, skipDropsPhone } from './landing.ts';

describe('where an account lands', () => {
  it('verifies the email, then a phone it has, then completes, then reaches the app', () => {
    expect(landingFor('email')).toBe('/verify-email');
    expect(landingFor('phone')).toBe('/verify-phone?from=onboarding');
    expect(landingFor('details')).toBe('/complete-profile');
    expect(landingFor(null)).toBe('/');
  });

  it('waits on the details screen while a request to join at its domain is unanswered', () => {
    expect(landingFor('approval')).toBe('/complete-profile');
  });
});

describe('skipping the mobile number', () => {
  const phone = (verified: boolean) => ({
    id: 'p',
    number: '+447700900123',
    countryCode: 'GB',
    primary: true,
    verified,
    pending: false,
  });

  it('drops a number saved on the way and not yet proved', () => {
    expect(skipDropsPhone({ phoneNumbers: [phone(false)] })).toBe(true);
  });

  it('leaves a proved number, and has nothing to drop with none', () => {
    expect(skipDropsPhone({ phoneNumbers: [phone(true)] })).toBe(false);
    expect(skipDropsPhone({ phoneNumbers: [] })).toBe(false);
  });
});

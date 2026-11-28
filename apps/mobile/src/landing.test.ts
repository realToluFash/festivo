import { gateOf, heldByDevice } from '@soirely/api-client';
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

describe("a door code's account (sc-72)", () => {
  const doorCode = {
    verified: false,
    complete: false,
    emailAddresses: [],
    phoneNumbers: [],
    waitingFor: null,
  };
  const address = {
    id: 'e',
    address: 'ana@example.com',
    verified: false,
    primary: true,
  };

  it('has no gate to pass and lands in the app, inside its event', () => {
    expect(heldByDevice(doorCode)).toBe(true);
    expect(landingFor(gateOf(doorCode))).toBe('/');
  });

  it('is not an unproved address, which still verifies first', () => {
    const unproved = { ...doorCode, emailAddresses: [address] };

    expect(heldByDevice(unproved)).toBe(false);
    expect(landingFor(gateOf(unproved))).toBe('/verify-email');
  });
});

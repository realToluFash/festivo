import { describe, expect, it } from 'vitest';

import {
  COUNTRIES,
  COUNTRY_BLANK,
  mobileRefusal,
  NO_REGION,
  NUMBER_BLANK,
  startCountry,
} from './signUpChecks.ts';

const PORTUGAL = COUNTRIES.find((country) => country.name === 'Portugal') ?? null;

describe('the country a step starts from', () => {
  it('is the device’s, and blank when the device names none', () => {
    expect(startCountry(undefined)).toEqual(COUNTRIES[0]);
    expect(startCountry(NO_REGION)).toBeNull();
  });
});

describe('Send code on Your mobile number', () => {
  it('names the number for its own lines, so the edge goes there', () => {
    expect(mobileRefusal('', PORTUGAL)).toEqual({ on: 'number', words: NUMBER_BLANK });
    expect(mobileRefusal('', null)).toEqual({ on: 'number', words: NUMBER_BLANK });
  });

  it('names the Code for Choose a country., once the number is in (sc-30447)', () => {
    expect(mobileRefusal('912 345 678', null)).toEqual({ on: 'country', words: COUNTRY_BLANK });
    expect(COUNTRY_BLANK).toBe('Choose a country.');
  });

  it('sends with a number and a code', () => {
    expect(mobileRefusal('912 345 678', PORTUGAL)).toBeNull();
  });
});

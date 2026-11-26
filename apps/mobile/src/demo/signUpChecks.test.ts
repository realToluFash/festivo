import { callingCode, phoneLengthProblem, refusedPhoneField } from '@soirely/domain';
import { describe, expect, it } from 'vitest';

import { COUNTRIES } from './countries.ts';
import {
  COUNTRY_BLANK,
  mobileRefusal,
  NO_REGION,
  NUMBER_BLANK,
  startCountry,
} from './signUpChecks.ts';

const PORTUGAL = COUNTRIES.find((country) => country.code === 'PT') ?? null;

describe('the demo’s countries', () => {
  it('dial the code their ISO code has', () => {
    for (const country of COUNTRIES) expect(callingCode(country.code)).toBe(country.dial);
  });
});

describe('the country a step starts from', () => {
  it('is the device’s, and blank when the device names none', () => {
    expect(startCountry(undefined)).toEqual(COUNTRIES[0]);
    expect(startCountry(NO_REGION)).toBeNull();
  });
});

describe('Send code on Your mobile number', () => {
  it('names the number for its own lines, so the edge goes there', () => {
    expect(mobileRefusal('', PORTUGAL)).toEqual({ on: 'number', words: NUMBER_BLANK });
    expect(mobileRefusal('7400 1', PORTUGAL)).toEqual({ on: 'number', words: NUMBER_BLANK });
  });

  it('names the Code for Choose a country., once the number is in (sc-30447)', () => {
    expect(mobileRefusal('912 345 678', null)).toEqual({ on: 'country', words: COUNTRY_BLANK });
    expect(COUNTRY_BLANK).toBe('Choose a country.');
  });

  it('names the control the domain names when both are missing', () => {
    const domain = refusedPhoneField(phoneLengthProblem('', ''));

    expect(mobileRefusal('', null)?.on).toBe(domain);
  });

  it('sends with a number and a code', () => {
    expect(mobileRefusal('912 345 678', PORTUGAL)).toBeNull();
  });
});

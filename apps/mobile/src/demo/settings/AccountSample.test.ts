import { matchingZones, zoneLabel } from '@soirely/domain';
import { describe, expect, it } from 'vitest';

import { SAMPLE } from '../samples.ts';
import {
  authenticatorProblem,
  countryName,
  passwordProblem,
  phoneShown,
  secondFactorProblem,
  sentCodeProblem,
  ZONES,
} from './AccountSample.ts';

describe("the demo's codes and password", () => {
  it('passes only the code on the demo list, spaces and all', () => {
    expect(sentCodeProblem(SAMPLE.code)).toBeNull();
    expect(sentCodeProblem('482 913')).toBeNull();
    expect(sentCodeProblem('482170')).toBe('wrong');
    expect(sentCodeProblem('4821')).toBe('short');
    expect(sentCodeProblem(' ')).toBe('blank');
  });

  it('sets up two-factor with the authenticator code alone', () => {
    expect(authenticatorProblem(SAMPLE.authenticator)).toBeNull();
    expect(authenticatorProblem(SAMPLE.code)).toBe('wrong');
  });

  it('takes the authenticator code or the recovery code once two-factor is on', () => {
    expect(secondFactorProblem(SAMPLE.authenticator)).toBeNull();
    expect(secondFactorProblem(SAMPLE.recovery.toUpperCase())).toBeNull();
    expect(secondFactorProblem(SAMPLE.code)).toBe('wrong');
    expect(secondFactorProblem('')).toBe('blank');
  });

  it('knows the sample password and nothing else', () => {
    expect(passwordProblem(SAMPLE.password)).toBeNull();
    expect(passwordProblem('correct horse')).toBe('wrong');
    expect(passwordProblem('')).toBe('blank');
  });
});

describe('a number added in the demo', () => {
  it('reads as people write it, from the picked country', () => {
    expect(phoneShown('GB', '07700 900461')).toBe('+44 7700 900461');
    expect(countryName('GB')).toBe('United Kingdom');
  });
});

describe("the demo's time zones", () => {
  it('find the board\'s five for "San"', () => {
    expect(matchingZones(ZONES, 'San').map(zoneLabel)).toEqual([
      'San Marino (UTC+01:00)',
      'San Salvador (UTC-06:00)',
      'Santarém (UTC-03:00)',
      'Santiago (UTC-03:00)',
      'Santo Domingo (UTC-04:00)',
    ]);
  });

  it('find nothing for a place not listed', () => {
    expect(matchingZones(ZONES, 'Atlantis')).toEqual([]);
  });
});

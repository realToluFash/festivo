import { describe, expect, it } from 'vitest';

import { callingCode, formatPhone, phoneLengthProblem } from './phone.ts';

describe('the phone check before sending', () => {
  it('needs a number', () => {
    expect(phoneLengthProblem('  ', 'NG')).toBe('blank');
  });

  it('accepts a number typed any of the ways the API accepts', () => {
    expect(phoneLengthProblem('0803 555 0142', 'NG')).toBeNull();
    expect(phoneLengthProblem('+234 803-555-0142', 'NG')).toBeNull();
    expect(phoneLengthProblem('8035550142', 'NG')).toBeNull();
  });

  it('says too short and too long for the chosen country', () => {
    expect(phoneLengthProblem('803 55', 'NG')).toBe('tooShort');
    expect(phoneLengthProblem('0803 555 0142 9999 9999', 'NG')).toBe('tooLong');
  });

  it('checks only presence for a country it has no lengths for', () => {
    expect(phoneLengthProblem('12', 'ZZ')).toBeNull();
  });

  it('gives the calling code for the code beside the number', () => {
    expect(callingCode('NG')).toBe('+234');
    expect(callingCode('GH')).toBe('+233');
    expect(callingCode('ZZ')).toBeNull();
  });

  it('shows a stored number as people read it', () => {
    expect(formatPhone('+2348035550142')).toBe('+234 803 555 0142');
    expect(formatPhone('not a number')).toBe('not a number');
  });
});

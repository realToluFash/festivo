import { describe, expect, it } from 'vitest';

import {
  callingCode,
  followCountry,
  formatPhone,
  phoneLengthProblem,
  phoneScreenCountry,
  pickPhoneCountry,
  refusedPhoneField,
  startingPhoneCountry,
} from './phone.ts';

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

describe('the phone code on "A few details"', () => {
  it('follows a changed Country, then stays once picked by hand', () => {
    let phone = startingPhoneCountry('GB', null, 'US');
    expect(phone.code).toBe('GB');

    phone = followCountry(phone, 'NG');
    expect(phone.code).toBe('NG');

    phone = pickPhoneCountry('GH');
    phone = followCountry(phone, 'KE');
    expect(phone.code).toBe('GH');
  });

  it('starts on the organisation, then the device, with no Country on the screen', () => {
    expect(startingPhoneCountry(null, 'NG', 'GB').code).toBe('NG');
    expect(startingPhoneCountry(null, null, 'GB').code).toBe('GB');
  });
});

describe('a number with no country', () => {
  it('is refused once typed, and a blank number is still blank first', () => {
    expect(phoneLengthProblem('803 555 0142', '')).toBe('noCountry');
    expect(phoneLengthProblem('', '')).toBe('blank');
    expect(phoneLengthProblem('803 555 0142', 'NG')).toBeNull();
  });
});

describe('the phone screens', () => {
  const gb = { primary: true, countryCode: 'GB' };

  it('start on the number’s country, then the Country from "A few details", then the device, else blank', () => {
    expect(phoneScreenCountry({ organisationCountry: 'GH', phoneNumbers: [gb] }, 'NG')).toBe('GB');
    expect(phoneScreenCountry({ organisationCountry: 'GH', phoneNumbers: [] }, 'NG')).toBe('GH');
    expect(phoneScreenCountry({ organisationCountry: null, phoneNumbers: [] }, 'NG')).toBe('NG');
    expect(phoneScreenCountry({ organisationCountry: '', phoneNumbers: [] }, null)).toBe('');
  });

  it('read the Country where "A few details" saves it, as /me returns an account with Ghana chosen', () => {
    const account = { countryCode: null, organisationCountry: 'GH', phoneNumbers: [] };

    expect(phoneScreenCountry(account, 'NG')).toBe('GH');
  });

  it('take a number that is not the primary for nothing', () => {
    const pending = { primary: false, countryCode: 'GB' };

    expect(phoneScreenCountry({ organisationCountry: 'GH', phoneNumbers: [pending] }, 'NG')).toBe(
      'GH',
    );
  });

  it('read a blank Country as no Country, as "A few details" does', () => {
    const blank = { organisationCountry: '', phoneNumbers: [] };

    expect(phoneScreenCountry(blank, 'NG')).toBe('NG');
    expect(startingPhoneCountry(null, '', 'NG').code).toBe('NG');
  });

  it('focus the code when none is chosen, and the number otherwise', () => {
    expect(refusedPhoneField('noCountry')).toBe('country');
    expect(refusedPhoneField('blank')).toBe('number');
    expect(refusedPhoneField('tooShort')).toBe('number');
    expect(refusedPhoneField(null)).toBeNull();
  });

  it('skip a blank country on every screen, as on the phone screens', () => {
    expect(startingPhoneCountry(null, '', 'NG').code).toBe('NG');
    expect(startingPhoneCountry('', null, null).code).toBe('');
  });
});

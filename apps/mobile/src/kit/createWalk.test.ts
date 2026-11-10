import { createInstance } from 'i18next';
import { describe, expect, it } from 'vitest';

import en from '../i18n/locales/en.json';
import {
  type Naming,
  type Walk,
  answered,
  boxWords,
  countries,
  factsOf,
  freshWalk,
  rowLabel,
} from './createWalk.ts';

const i18n = createInstance();
void i18n.init({
  resources: { en: { translation: en } },
  lng: 'en',
  interpolation: { escapeValue: false },
  initAsync: false,
});
const t = i18n.t;
const LISBON = { country: 'PT', zone: 'Europe/Lisbon' };
const READY: Walk = { ...freshWalk(LISBON), step: 3, name: 'Lumen Feiras', sent: 'creating' };

describe('what Create is answered', () => {
  it('says too many for now, until the time the server gave', () => {
    const until = new Date(2026, 10, 3, 10, 41);

    expect(answered(READY, { kind: 'limited', until })).toMatchObject({
      step: 3,
      sent: 'limited',
      lifts: until,
    });
  });

  it('says it did not work, on the same step', () => {
    expect(answered(READY, { kind: 'failed' })).toMatchObject({ step: 3, sent: 'failed' });
  });

  it('takes a refused name back to the name, with the server’s reason', () => {
    expect(answered(READY, { kind: 'refused', errors: { name: 'Too long.' } })).toMatchObject({
      step: 1,
      name: 'Lumen Feiras',
      refusal: 'Too long.',
      sent: 'idle',
    });
  });

  it('takes a refused country back to the country, keeping the pick', () => {
    expect(
      answered(READY, { kind: 'refused', errors: { countryCode: 'Choose a country.' } }),
    ).toMatchObject({ step: 2, country: 'PT', refusal: 'Choose a country.', sent: 'idle' });
  });
});

describe('before the currencies are read', () => {
  const unread: Naming = { locale: 'en', currencies: null };
  const country = { ...READY, step: 2 as const };

  it('names the country alone', () => {
    expect(rowLabel({ code: 'PT', name: 'Portugal' }, unread, t)).toBe('Portugal');
    expect(factsOf(country, '', t, false, unread).map((fact) => fact.key)).toEqual([
      'country',
      'timezone',
    ]);
  });

  it('says only the time zone the country brings', () => {
    expect(boxWords(country, t, unread)).toBe(
      'Time zone, from this device, Lisbon · Europe/Lisbon.',
    );
  });
});

describe('the countries', () => {
  it('are named in the reader’s language', () => {
    expect(countries('pt').find((each) => each.code === 'DE')?.name).toBe('Alemanha');
    expect(countries('en').find((each) => each.code === 'DE')?.name).toBe('Germany');
  });
});

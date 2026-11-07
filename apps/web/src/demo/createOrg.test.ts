import { describe, expect, it } from 'vitest';

import {
  CREATE_PAGES,
  CREATE_STATES,
  LONG_NAME,
  NEW_ORG,
  answerOf,
  cardLine,
  countryRefusal,
  currencyWords,
  entered,
  freshWalk,
  isCreateState,
  limitedLine,
  nameRefusal,
  narrowed,
  optionLabel,
  pickLine,
  sampleCountries,
  shrinks,
  stepRefused,
  walkOf,
  zoneWords,
} from './createOrg.ts';

const countries = sampleCountries();

function country(code: string) {
  const found = countries.find((one) => one.code === code);
  if (found == null) throw new Error(`No sample country ${code}`);

  return found;
}

describe('creating an organisation, the sample (sc-30335)', () => {
  it('links every state from the demo home, and knows nothing else', () => {
    const linked = CREATE_PAGES.flatMap((page) => page.states.map((state) => state.to));

    for (const state of CREATE_STATES) expect(linked).toContain(`/demo/events?create=${state}`);
    expect(linked).toContain('/demo/today?orgs=none');
    expect(isCreateState('typing')).toBe(true);
    expect(isCreateState('name-refused')).toBe(true);
    expect(isCreateState('open')).toBe(false);
    expect(isCreateState(null)).toBe(false);
  });

  it('holds the countries drawn, in countryChoices order', () => {
    expect(countries.map((one) => one.code)).toEqual([
      'AF',
      'AX',
      'AL',
      'DZ',
      'AS',
      'AD',
      'AQ',
      'BW',
      'BV',
      'BR',
      'IO',
      'VG',
      'CG',
      'GI',
      'PE',
      'PH',
      'PN',
      'PL',
      'PT',
      'PR',
      'QA',
      'RE',
      'RO',
      'SG',
    ]);
  });

  it('names each currency the way currencyLabel does, and Antarctica’s as none yet', () => {
    expect(currencyWords(country('PT'))).toBe('Euro (EUR)');
    expect(currencyWords(country('BR'))).toBe('Brazilian Real (BRL)');
    expect(currencyWords(country('CG'))).toBe('Central African CFA Franc (XAF)');
    expect(country('AQ').currency).toBeNull();
    expect(currencyWords(country('AQ'))).toBe('None yet');
    expect(optionLabel(country('AQ'))).toBe('Antarctica, None yet');
    expect(optionLabel(country('PT'))).toBe('Portugal, Euro (EUR)');
  });

  it('shows the zone from this device, whatever the country', () => {
    expect(zoneWords()).toBe('Lisbon · Europe/Lisbon');
    expect(pickLine(country('BR'))).toBe(
      'Currency, Brazilian Real (BRL). Time zone, from this device, Lisbon · Europe/Lisbon.',
    );
  });
});

describe('the search', () => {
  it('narrows by a case-insensitive includes, as main’s ListPicker does', () => {
    expect(narrowed(countries, 'bra').map((one) => one.name)).toEqual([
      'Brazil',
      'Congo - Brazzaville',
      'Gibraltar',
    ]);
    expect(narrowed(countries, '  POR ').map((one) => one.name)).toEqual(['Portugal', 'Singapore']);
  });

  it('keeps the whole list for nothing typed, and finds nothing for a miss', () => {
    expect(narrowed(countries, '   ')).toHaveLength(countries.length);
    expect(narrowed(countries, 'Belém')).toEqual([]);
  });
});

describe('the step checks', () => {
  it('refuses a blank name and one over 100, in main’s words', () => {
    expect(nameRefusal('')).toBe("Enter the organisation's name.");
    expect(nameRefusal('   ')).toBe("Enter the organisation's name.");
    expect(nameRefusal(LONG_NAME)).toBe('That name is 118 characters. Use 100 or fewer.');
    expect(nameRefusal('x'.repeat(100))).toBeNull();
    expect(nameRefusal(` ${'x'.repeat(100)} `)).toBeNull();
    expect(nameRefusal(NEW_ORG.name)).toBeNull();
  });

  it('refuses no country', () => {
    expect(countryRefusal(null)).toBe('Choose a country.');
    expect(countryRefusal('PT')).toBeNull();
  });

  it('checks only the step Continue is on', () => {
    expect(stepRefused({ ...freshWalk(), name: '' })).toEqual({
      nameRefused: "Enter the organisation's name.",
      countryRefused: false,
    });
    expect(stepRefused({ ...freshWalk(true), name: NEW_ORG.name })).toBeNull();
    expect(stepRefused({ ...freshWalk(true), name: NEW_ORG.name, step: 2 })).toEqual({
      nameRefused: null,
      countryRefused: true,
    });
    expect(stepRefused({ ...freshWalk(), name: NEW_ORG.name, step: 2 })).toBeNull();
  });

  it('shrinks the card’s name from 40 characters', () => {
    expect(shrinks(NEW_ORG.name)).toBe(false);
    expect(shrinks('x'.repeat(39))).toBe(false);
    expect(shrinks('x'.repeat(40))).toBe(true);
    expect(shrinks(LONG_NAME)).toBe(true);
  });
});

describe('something entered', () => {
  it('is nothing at the start, with or without a device country', () => {
    expect(entered(freshWalk())).toBe(false);
    expect(entered(freshWalk(true))).toBe(false);
  });

  it('is a name that is not blank', () => {
    expect(entered({ ...freshWalk(), name: '   ' })).toBe(false);
    expect(entered({ ...freshWalk(), name: 'L' })).toBe(true);
  });

  it('is a country that is not the device’s', () => {
    expect(entered({ ...freshWalk(), country: 'BR' })).toBe(true);
    expect(entered({ ...freshWalk(), country: 'PT' })).toBe(false);
    expect(entered({ ...freshWalk(true), country: 'PT' })).toBe(true);
  });
});

describe('each state’s walk', () => {
  it('opens the device’s Portugal, or none for a browser naming no country', () => {
    expect(freshWalk().device).toBe('PT');
    expect(freshWalk().country).toBe('PT');
    expect(freshWalk(true).device).toBeNull();
    expect(walkOf('country-none')).toMatchObject({ step: 2, country: null, countryRefused: true });
  });

  it('draws each step where the spec does', () => {
    expect(walkOf('typing')).toMatchObject({ step: 1, name: 'Lumen Feiras', landing: 'field' });
    expect(walkOf('name-long')?.nameRefused).toBe('That name is 118 characters. Use 100 or fewer.');
    expect(walkOf('name-refused')).toMatchObject({
      name: 'Lumen Feiras',
      nameRefused: "Enter the organisation's name.",
    });
    expect(walkOf('country-search')).toMatchObject({ step: 2, query: 'bra', country: 'PT' });
    expect(walkOf('country-picked')).toMatchObject({ country: 'BR', query: 'bra' });
    expect(walkOf('back-country')).toMatchObject({ country: 'BR', query: '', inList: true });
    expect(walkOf('creating')).toMatchObject({ step: 3, creating: true, landing: 'dialog' });
    expect(walkOf('limited')?.answer).toBe('limited');
    expect(walkOf('failed')?.answer).toBe('failed');
    expect(walkOf('discard')).toMatchObject({ step: 1, asking: true });
    expect(walkOf('created')).toBeNull();
  });

  it('tries again after did not work, and holds too many until it lifts', () => {
    const failed = walkOf('failed');
    const limited = walkOf('limited');

    expect(failed == null ? 'none' : answerOf(failed)).toBeNull();
    expect(limited == null ? 'none' : answerOf(limited)).toBe('limited');
    expect(limitedLine('en-GB')).toBe('Try again at 10:41.');
  });

  it('reads the card as one line on step 3', () => {
    const ready = walkOf('ready');

    expect(ready == null ? '' : cardLine(ready, countries)).toBe(
      'Lumen Feiras. Your role · Owner. Country, Portugal. Currency, Euro (EUR). Time zone, Lisbon · Europe/Lisbon. Contact address, folake@ire.events.',
    );
  });
});

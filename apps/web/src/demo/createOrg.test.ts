import i18next from 'i18next';
import { describe, expect, it } from 'vitest';

import { countriesOf } from '../components/createWalk.ts';
import {
  CREATE_PAGES,
  CREATE_STATES,
  LIMIT_LIFTS,
  NEW_ORG,
  SAMPLE_CURRENCIES,
  freshWalk,
  isCreateState,
  offered,
  sampleSend,
  walkOf,
} from './createOrg.ts';

const t = i18next.t;

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

  it('offers the countries drawn, in countryChoices order, with Antarctica’s currency none yet', () => {
    const countries = countriesOf('en', SAMPLE_CURRENCIES, t).filter((one) => offered(one.code));

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
    expect(countries.find((one) => one.code === 'AQ')?.currency).toEqual({
      words: 'None yet',
      none: true,
    });
  });
});

describe('each state’s walk', () => {
  it('opens the device’s Portugal, or none for a browser naming no country', () => {
    expect(freshWalk().device).toEqual({ country: 'PT', zone: 'Europe/Lisbon' });
    expect(freshWalk().country).toBe('PT');
    expect(freshWalk(true).device.country).toBeNull();
    expect(walkOf('country-none', t)).toMatchObject({
      step: 2,
      country: null,
      countryRefused: 'Choose a country.',
    });
  });

  it('draws each step where the spec does', () => {
    expect(walkOf('typing', t)).toMatchObject({
      step: 1,
      name: 'Lumen Feiras',
      landing: 'field',
    });
    expect(walkOf('name-long', t)?.nameRefused).toBe(
      'That name is 118 characters. Use 100 or fewer.',
    );
    expect(walkOf('name-refused', t)).toMatchObject({
      name: 'Lumen Feiras',
      nameRefused: "Enter the organisation's name.",
    });
    expect(walkOf('country-search', t)).toMatchObject({ step: 2, query: 'bra', country: 'PT' });
    expect(walkOf('country-nomatch', t)).toMatchObject({
      step: 2,
      query: 'zzz',
      landing: 'search',
    });
    expect(walkOf('country-picked', t)).toMatchObject({ country: 'BR', query: 'bra' });
    expect(walkOf('back-country', t)).toMatchObject({ country: 'BR', query: '', inList: true });
    expect(walkOf('creating', t)).toMatchObject({ step: 3, creating: true, landing: 'dialog' });
    expect(walkOf('limited', t)).toMatchObject({ answer: 'limited', lifts: LIMIT_LIFTS });
    expect(walkOf('failed', t)?.answer).toBe('failed');
    expect(walkOf('discard', t)).toMatchObject({ step: 1, asking: true });
    expect(walkOf('created', t)).toBeNull();
  });

  it('creates on a try after did not work', async () => {
    const failed = walkOf('failed', t);
    if (failed == null) throw new Error('Did not work draws a walk');

    expect(await sampleSend(failed)).toEqual({ kind: 'created', made: NEW_ORG });
  });
});

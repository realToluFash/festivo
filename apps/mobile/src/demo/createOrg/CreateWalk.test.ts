import { createInstance } from 'i18next';
import { describe, expect, it } from 'vitest';

import en from '../../i18n/locales/en.json';
import {
  CREATE_STATES,
  LONG_NAME,
  SAMPLE_DEVICE,
  answerTo,
  back,
  boxWords,
  cardNameSize,
  cardWords,
  countries,
  createStateOf,
  currencyWords,
  entered,
  factsOf,
  forward,
  foundedId,
  foundedPlace,
  freshWalk,
  limitedWords,
  picked,
  rowLabel,
  sampleCurrency,
  search,
  stepRefusal,
  typed,
  walkFor,
} from './CreateWalk.ts';

const i18n = createInstance();
void i18n.init({
  resources: { en: { translation: en } },
  lng: 'en',
  interpolation: { escapeValue: false },
  initAsync: false,
});
const t = i18n.t;
const EMAIL = 'folake@ire.events';

function sample(state: Parameters<typeof walkFor>[0], phone = true) {
  const walk = walkFor(state, t, phone);
  if (walk == null) throw new Error(`${state} has no walk`);

  return walk;
}

describe('the states', () => {
  it('opens each one by its name, and nothing else', () => {
    expect(CREATE_STATES.map(createStateOf)).toEqual(CREATE_STATES);
    expect(createStateOf('nonsense')).toBeNull();
    expect(createStateOf(undefined)).toBeNull();
  });

  it('lands with no walk when created', () => {
    expect(walkFor('created', t, true)).toBeNull();
  });

  it('asks Discard over step 2 on the phone and step 1 on the iPad', () => {
    expect(sample('discard', true)).toMatchObject({ step: 2, asking: true });
    expect(sample('discard', false)).toMatchObject({ step: 1, asking: true });
  });
});

describe('step 1 checks the name', () => {
  it('refuses a blank name in main’s words', () => {
    expect(stepRefusal({ ...freshWalk(SAMPLE_DEVICE), name: '   ' }, t)).toBe(
      "Enter the organisation's name.",
    );
  });

  it('refuses the 118-character name with its count', () => {
    expect(LONG_NAME).toHaveLength(118);
    expect(sample('name-long').refusal).toBe('That name is 118 characters. Use 100 or fewer.');
  });

  it('goes on with a name, keeping it, and clears the search', () => {
    const next = forward(sample('typing'), t);
    expect(next).toMatchObject({ step: 2, name: 'Lumen Feiras', refusal: null, query: '' });
  });

  it('stays, with the reason, when the name is blank', () => {
    expect(forward(sample('name'), t)).toMatchObject({ step: 1, refusal: expect.any(String) });
  });

  it('drops the reason as the name is edited', () => {
    expect(typed(sample('name-refused'), 'Lumen').refusal).toBeNull();
  });
});

describe('step 2 checks the country', () => {
  it('refuses no country', () => {
    const none = sample('country-none');
    expect(none.refusal).toBe('Choose a country.');
    expect(forward({ ...none, refusal: null }, t).refusal).toBe('Choose a country.');
  });

  it('goes on with one picked, and a pick clears the reason', () => {
    expect(picked(sample('country-none'), 'BR')).toMatchObject({ country: 'BR', refusal: null });
    expect(forward(sample('country-picked'), t)).toMatchObject({ step: 3, country: 'BR' });
  });
});

describe('Back keeps everything', () => {
  it('from step 3, with the country as picked and the search cleared', () => {
    const ready = forward({ ...sample('country-picked') }, t);
    expect(back(ready)).toMatchObject({ step: 2, country: 'BR', query: '', cameBack: true });
  });

  it('from step 2, with the name as typed', () => {
    expect(back(sample('country'))).toMatchObject({ step: 1, name: 'Lumen Feiras' });
  });

  it('forgets an answer to Create', () => {
    expect(back(sample('failed')).sent).toBe('idle');
  });
});

describe('something entered, for Discard', () => {
  it('is nothing with no name and the device’s country', () => {
    expect(entered(sample('name'))).toBe(false);
    expect(entered({ ...sample('name'), name: '  ' })).toBe(false);
  });

  it('is a name', () => {
    expect(entered(sample('typing'))).toBe(true);
  });

  it('is a country other than the device’s, with no name', () => {
    expect(entered(picked(sample('name'), 'BR'))).toBe(true);
  });

  it('is nothing on a device with no country, before one is picked', () => {
    expect(entered({ ...sample('country-none'), name: '' })).toBe(false);
  });
});

describe('the search', () => {
  it('narrows by "bra" to the three the board draws, in order', () => {
    expect(search(countries(), 'bra').map((country) => country.name)).toEqual([
      'Brazil',
      'Congo - Brazzaville',
      'Gibraltar',
    ]);
  });

  it('ignores case and the ends', () => {
    expect(search(countries(), '  POR ').map((country) => country.name)).toEqual([
      'Portugal',
      'Singapore',
    ]);
  });

  it('keeps every country for an empty search', () => {
    expect(search(countries(), ' ')).toHaveLength(249);
  });
});

describe('the sample’s currency', () => {
  it('is the API’s', () => {
    expect(sampleCurrency('PT')).toBe('EUR');
    expect(sampleCurrency('BR')).toBe('BRL');
    expect(currencyWords('BR')).toEqual({ words: 'Brazilian Real (BRL)', none: false });
    expect(rowLabel({ code: 'PT', name: 'Portugal' })).toBe('Portugal, Euro (EUR)');
  });

  it('is "None yet" for Antarctica', () => {
    expect(sampleCurrency('AQ')).toBeNull();
    expect(currencyWords('AQ')).toEqual({ words: 'None yet', none: true });
    expect(rowLabel({ code: 'AQ', name: 'Antarctica' })).toBe('Antarctica, None yet');
  });

  it('is there for every country in the list', () => {
    expect(countries().filter((country) => sampleCurrency(country.code) == null)).toEqual([
      { code: 'AQ', name: 'Antarctica' },
    ]);
  });
});

describe('the Ready card', () => {
  it('reads as one element', () => {
    expect(cardWords(sample('ready'), EMAIL, t)).toBe(
      'Lumen Feiras. Your role · Owner. Country, Portugal. Currency, Euro (EUR). Time zone, Lisbon · Europe/Lisbon. Contact address, folake@ire.events.',
    );
  });

  it('shows no country facts until a country is picked', () => {
    expect(factsOf(sample('country-none'), EMAIL, t, false)).toEqual([]);
    expect(factsOf(sample('country'), EMAIL, t, false).map((fact) => fact.key)).toEqual([
      'country',
      'currency',
      'timezone',
    ]);
  });

  it('keeps the device’s zone whatever the country', () => {
    expect(factsOf(sample('country-picked'), EMAIL, t, false)[2]?.value).toBe(
      'Lisbon · Europe/Lisbon',
    );
  });

  it('draws a long name smaller on the wide card', () => {
    expect(cardNameSize('Lumen Feiras')).toBe(24);
    expect(cardNameSize(LONG_NAME)).toBe(18);
  });
});

describe('what the country brings', () => {
  it('reads as one element', () => {
    expect(boxWords(sample('country'), t)).toBe(
      'Currency, Euro (EUR). Time zone, from this device, Lisbon · Europe/Lisbon.',
    );
  });
});

describe('Create', () => {
  it('stays too many for now until 10:41', () => {
    expect(answerTo(sample('limited'))).toBe('limited');
    expect(limitedWords('en-GB', t)).toEqual({
      title: 'Too many new organisations for now.',
      body: 'Try again at 10:41.',
    });
  });

  it('works on a try after a failure', () => {
    expect(answerTo(sample('failed'))).toBe('created');
    expect(answerTo(sample('ready'))).toBe('created');
  });

  it('gives the sample its id, which gives it its colour', () => {
    expect(foundedId('Lumen Feiras', 'PT')).toBe('org-lumen-feiras-pt');
    expect(foundedId('  Fête à Lyon ', 'FR')).toBe('org-fete-a-lyon-fr');
  });

  it('founds the organisation as named, with no events yet', () => {
    expect(foundedPlace({ ...sample('ready'), name: ' Lumen Feiras ' })).toEqual({
      id: 'org-lumen-feiras-pt',
      name: 'Lumen Feiras',
      role: 'Owner',
      fresh: true,
    });
  });
});

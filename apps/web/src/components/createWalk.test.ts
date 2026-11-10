import { ApiError, type Membership } from '@soirely/api-client';
import i18next from 'i18next';
import { describe, expect, it } from 'vitest';

import {
  type Walk,
  answered,
  cardLine,
  countriesOf,
  createOrganisation,
  entered,
  freshWalk,
  limitedLine,
  nameRefusal,
  narrowed,
  optionLabel,
  pickLine,
  shrinks,
  stepRefused,
} from './createWalk.ts';

const t = i18next.t;
const LISBON = { country: 'PT', zone: 'Europe/Lisbon' };
const CURRENCIES = new Map<string, string | null>([
  ['PT', 'EUR'],
  ['BR', 'BRL'],
  ['AQ', null],
]);
const countries = countriesOf('en', CURRENCIES, t);
const named: Walk = { ...freshWalk(LISBON), name: 'Lumen Feiras' };

function country(code: string) {
  const found = countries.find((one) => one.code === code);
  if (found == null) throw new Error(`No country ${code}`);

  return found;
}

describe('the countries (sc-30412)', () => {
  it('names each currency the way currencyLabel does, and one with none as none yet', () => {
    expect(optionLabel(country('PT'))).toBe('Portugal, Euro (EUR)');
    expect(optionLabel(country('AQ'))).toBe('Antarctica, None yet');
    expect(country('AQ').currency?.none).toBe(true);
  });

  it('leaves the currency out while it is not yet known, never saying none', () => {
    expect(optionLabel(country('NG'))).toBe('Nigeria');
    expect(countriesOf('en', null, t).every((one) => one.currency == null)).toBe(true);
    expect(pickLine(country('NG'), named, t)).toBe(
      'Time zone, from this device, Lisbon · Europe/Lisbon.',
    );
  });

  it('says the currency and the device’s zone when a pick changes', () => {
    expect(pickLine(country('BR'), named, t)).toBe(
      'Currency, Brazilian Real (BRL). Time zone, from this device, Lisbon · Europe/Lisbon.',
    );
  });

  it('narrows by a case-insensitive includes', () => {
    expect(narrowed(countries, '  PORTU ', 'en').map((one) => one.name)).toEqual(['Portugal']);
    expect(narrowed(countries, '   ', 'en')).toHaveLength(countries.length);
    expect(narrowed(countries, 'zzz', 'en')).toEqual([]);
  });
});

describe('the step checks', () => {
  it('refuses a blank name and one over 100', () => {
    expect(nameRefusal('   ', t)).toBe("Enter the organisation's name.");
    expect(nameRefusal('x'.repeat(101), t)).toBe('That name is 101 characters. Use 100 or fewer.');
    expect(nameRefusal(` ${'x'.repeat(100)} `, t)).toBeNull();
  });

  it('checks only the step Continue is on', () => {
    expect(stepRefused(freshWalk(LISBON), t)).toEqual({
      nameRefused: "Enter the organisation's name.",
      countryRefused: null,
    });
    expect(stepRefused({ ...named, country: null }, t)).toBeNull();
    expect(stepRefused({ ...named, country: null, step: 2 }, t)).toEqual({
      nameRefused: null,
      countryRefused: 'Choose a country.',
    });
    expect(stepRefused({ ...named, step: 2 }, t)).toBeNull();
  });

  it('shrinks the card’s name from 40 characters', () => {
    expect(shrinks('x'.repeat(39))).toBe(false);
    expect(shrinks('x'.repeat(40))).toBe(true);
  });

  it('asks before Cancel only once a name is typed or the country is not the device’s', () => {
    expect(entered(freshWalk(LISBON))).toBe(false);
    expect(entered({ ...freshWalk(LISBON), name: '  ' })).toBe(false);
    expect(entered(named)).toBe(true);
    expect(entered({ ...freshWalk(LISBON), country: 'BR' })).toBe(true);
  });
});

describe('the answer', () => {
  const sending: Walk = { ...named, step: 3, creating: true };

  it('holds too many on Ready, with the time it lifts, or no time when none came', () => {
    const lifts = new Date(2026, 10, 3, 10, 41);
    const limited = answered(sending, { kind: 'limited', until: lifts });

    expect(limited).toMatchObject({ step: 3, creating: false, answer: 'limited' });
    expect(limitedLine(limited, 'en-GB', t)).toBe('Try again at 10:41.');
    expect(limitedLine(answered(sending, { kind: 'limited', until: null }), 'en-GB', t)).toBeNull();
  });

  it('says it did not work on Ready, focus on Create', () => {
    expect(answered(sending, { kind: 'failed' })).toMatchObject({
      step: 3,
      answer: 'failed',
      landing: 'create',
    });
  });

  it('takes a refused field back to its step, with the server’s reason', () => {
    expect(answered(sending, { kind: 'refused', errors: { name: 'Taken.' } })).toMatchObject({
      step: 1,
      nameRefused: 'Taken.',
      countryRefused: null,
      landing: 'field',
    });
    expect(answered(sending, { kind: 'refused', errors: { countryCode: 'No.' } })).toMatchObject({
      step: 2,
      nameRefused: null,
      countryRefused: 'No.',
      landing: 'search',
    });
  });

  it('reads the card as one line, the currency left out while unknown', () => {
    const ready = { ...named, step: 3 as const };

    expect(cardLine(ready, countries, 'folake@ire.events', t)).toBe(
      'Lumen Feiras. Your role · Owner. Country, Portugal. Currency, Euro (EUR). Time zone, Lisbon · Europe/Lisbon. Contact address, folake@ire.events.',
    );
    expect(cardLine(ready, countriesOf('en', null, t), 'folake@ire.events', t)).toBe(
      'Lumen Feiras. Your role · Owner. Country, Portugal. Time zone, Lisbon · Europe/Lisbon. Contact address, folake@ire.events.',
    );
  });
});

describe('sending it', () => {
  const made = { id: 'org_9', name: 'Lumen Feiras' } as Membership;

  function refusal(
    code: string,
    violations: { propertyPath: string; message: string; code: string }[] = [],
  ) {
    return new ApiError({
      type: `https://soirely.com/errors/${code}`,
      title: code,
      status: 422,
      violations,
    });
  }

  it('sends the name trimmed, the country and the device’s zone', async () => {
    const sent: unknown[] = [];

    expect(
      await createOrganisation(
        async (organisation) => {
          sent.push(organisation);
          return made;
        },
        { ...named, name: '  Lumen Feiras ' },
      ),
    ).toEqual({ kind: 'created', made });
    expect(sent).toEqual([{ name: 'Lumen Feiras', countryCode: 'PT', timezone: 'Europe/Lisbon' }]);
  });

  it('answers a refused field, and failed for a refusal naming no field the walk has', async () => {
    const refused = (violations: { propertyPath: string; message: string; code: string }[]) =>
      createOrganisation(() => Promise.reject(refusal('validation_failed', violations)), named);

    expect(await refused([{ propertyPath: 'name', message: 'Taken.', code: 'x' }])).toEqual({
      kind: 'refused',
      errors: { name: 'Taken.' },
    });
    expect(await refused([{ propertyPath: 'contactEmail', message: 'Bad.', code: 'x' }])).toEqual({
      kind: 'failed',
    });
  });

  it('answers too many, and failed for anything else', async () => {
    expect(
      await createOrganisation(() => Promise.reject(refusal('too_many_attempts')), named),
    ).toEqual({ kind: 'limited', until: null });
    expect(await createOrganisation(() => Promise.reject(new Error('offline')), named)).toEqual({
      kind: 'failed',
    });
  });
});

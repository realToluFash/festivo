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
  firstTurn,
  freshWalk,
  nameInSight,
  nameRow,
  rowLabel,
  turnEnded,
  turnTo,
  walkNav,
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

describe('nameInSight', () => {
  const group = { top: 200, fieldEnd: 77, bottom: 320, margin: 16 };

  it('leaves the step where it is when the whole group fits', () => {
    expect(nameInSight({ ...group, viewport: 400 })).toBeNull();
  });

  it('brings the help above the keys when the label still shows', () => {
    expect(nameInSight({ ...group, viewport: 300 })).toBe(36);
  });

  it('stops with the field and its margin below in sight when the help does not fit with them', () => {
    expect(nameInSight({ ...group, viewport: 100 })).toBe(193);
  });

  it('stops at the margin above the label when the help does not fit with it', () => {
    expect(nameInSight({ ...group, viewport: 140 })).toBe(184);
  });

  it('keeps the field whole when the label and field do not both fit', () => {
    expect(nameInSight({ ...group, viewport: 60 })).toBe(233);
  });

  it('waits for the step to be laid out', () => {
    expect(nameInSight({ ...group, viewport: 0 })).toBeNull();
  });
});

describe('Organisation name on a phone on its side with the keys up', () => {
  // QA #39307 measured about 69 above the keys on Soirely_QA2_Phone, under the upright nav.
  const strip = 69 + walkNav(false) - walkNav(true);
  const margin = 12;

  it('fits the label and field with 12 above and below, under the shorter nav', () => {
    expect(walkNav(true)).toBe(44);
    expect(nameRow({ sideways: true, large: false }).height + 2 * margin).toBeLessThanOrEqual(
      strip,
    );
  });

  it('puts the label beside the field only there', () => {
    expect(nameRow({ sideways: true, large: false }).beside).toBe(true);
    expect(nameRow({ sideways: false, large: false })).toMatchObject({ beside: false });
    expect(walkNav(false)).toBe(52);
  });

  it('keeps the label above at the accessibility sizes, where the field comes first', () => {
    expect(nameRow({ sideways: true, large: true }).beside).toBe(false);
  });

  it('keeps the field in sight with its margins on arrival, the help one scroll down', () => {
    const row = nameRow({ sideways: true, large: false }).height;
    const scroll = nameInSight({ viewport: strip, top: 200, fieldEnd: row, bottom: 300, margin });
    expect(scroll).not.toBeNull();
    expect(200 - (scroll ?? 0)).toBeGreaterThanOrEqual(margin);
    expect(strip - (200 + row - (scroll ?? 0))).toBeGreaterThanOrEqual(margin);
  });
});

describe('the walk turning between steps (qa3, #39178)', () => {
  const name: Walk = { ...freshWalk(LISBON), name: 'Lumen Feiras' };
  const country: Walk = { ...name, step: 2 };

  it('gives the arriving step a new turn, with the step it leaves as the one before', () => {
    expect(turnTo(firstTurn(name), country)).toEqual({
      walk: country,
      turn: 1,
      leaving: name,
      dir: 1,
    });
  });

  it('replaces a walk at the same step in place, so no second copy of it leaves', () => {
    const refused: Walk = { ...name, refusal: 'Give it a name' };
    const turned = turnTo(firstTurn(name), refused);

    expect(turned).toEqual({ walk: refused, turn: 0, leaving: null, dir: 1 });
  });

  it('turns back with the step it leaves behind it', () => {
    const back: Walk = { ...name, cameBack: true };

    expect(turnTo(turnTo(firstTurn(name), country), back)).toEqual({
      walk: back,
      turn: 2,
      leaving: country,
      dir: -1,
    });
  });

  it('lets the leaving step go only at the end of the turn on screen', () => {
    const twice = turnTo(turnTo(firstTurn(name), country), { ...country, step: 3 });

    expect(turnEnded(twice, 1)).toBe(twice);
    expect(turnEnded(twice, 2).leaving).toBeNull();
  });
});

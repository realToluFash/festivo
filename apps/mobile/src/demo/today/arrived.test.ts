import { createInstance } from 'i18next';
import { describe, expect, it } from 'vitest';

import en from '../../i18n/locales/en.json';
import { momentOf, sayIn } from '../today.ts';
import { COUNTS, figureOf, readyOf, withArrived } from './arrived.ts';

const i18n = createInstance();
void i18n.init({
  resources: { en: { translation: en } },
  lng: 'en',
  interpolation: { escapeValue: false },
  initAsync: false,
});

const english = new Intl.NumberFormat('en-GB');
const french = new Intl.NumberFormat('fr-FR');

describe('Now’s arrived figure', () => {
  it('reads arrived of expected, beside a ring of the same share', () => {
    expect(figureOf(COUNTS.some, english)).toEqual({
      count: '141',
      of: '152',
      share: 141 / 152,
      spoken: '141 of 152 arrived',
    });
  });

  it('with nobody Coming, reads the arrivals alone, with no ring', () => {
    expect(figureOf(COUNTS.nobodyComing, english)).toEqual({
      count: '37',
      of: null,
      share: null,
      spoken: '37 arrived',
    });
  });

  it('is not there while nobody has arrived', () => {
    expect(figureOf(COUNTS.none, english)).toBeNull();
  });

  it('writes four digits the locale’s way', () => {
    expect(figureOf(COUNTS.thousands, english)?.spoken).toBe('1,204 of 1,250 arrived');
    expect(figureOf(COUNTS.thousands, french)?.count).toBe('1 204');
  });

  it('reads the served expected, so a walk-in at 141 of 152 reads 142 of 153', () => {
    const walkIn = { arrived: 142, coming: 152, expected: 153 };

    expect(figureOf(walkIn, english)).toMatchObject({
      spoken: '142 of 153 arrived',
      share: 142 / 153,
    });
    expect(figureOf({ arrived: 153, coming: 152, expected: 153 }, english)?.spoken).toBe(
      '153 of 153 arrived',
    );
  });
});

describe('the card’s line', () => {
  it('keeps the replies line and bar while nobody has arrived', () => {
    expect(readyOf(COUNTS.none, english)).toEqual({
      words: '152 coming · 91% replied',
      percent: 91,
    });
  });

  it('has no bar with nobody Coming', () => {
    expect(readyOf(COUNTS.nobodyComing, english)).toEqual({ words: '37 arrived', percent: 0 });
  });

  it('fills the bar only once everyone Coming has arrived', () => {
    expect(readyOf({ arrived: 1, coming: 152, expected: 152 }, english)?.percent).toBe(1);
    expect(readyOf({ arrived: 12, coming: 1250, expected: 1250 }, english)?.percent).toBe(1);
    expect(readyOf({ arrived: 1249, coming: 1250, expected: 1250 }, english)?.percent).toBe(99);
    expect(readyOf({ arrived: 152, coming: 152, expected: 152 }, english)?.percent).toBe(100);
  });
});

describe('the built Now with arrivals', () => {
  const day = momentOf('dayNow', sayIn('en-GB'), i18n.t);
  const arrived = withArrived(day, COUNTS.some, english);

  it('puts the line on the wedding’s card and the replies lines on the others', () => {
    expect(arrived.events.map((card) => card.ready?.words ?? null)).toEqual([
      '141 of 152 arrived',
      '44 coming · 80% replied',
      'Invitations not sent',
      null,
    ]);
  });

  it('keeps the built Now: no Next, its ends line and Open the event', () => {
    expect(arrived.now?.ends).toBe(day.now?.ends);
    expect(arrived.figure?.spoken).toBe('141 of 152 arrived');
  });
});

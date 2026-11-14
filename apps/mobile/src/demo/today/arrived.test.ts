import { createInstance } from 'i18next';
import { describe, expect, it } from 'vitest';

import en from '../../i18n/locales/en.json';
import { momentOf, sayIn } from '../today.ts';
import { COUNTS, figureOf, LIVE, readyOf, withArrived } from './arrived.ts';

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
      count: '87',
      of: '99',
      share: 87 / 99,
      spoken: '87 of 99 arrived',
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

  it('counts the door from 16:05 to Guests A’s 3 of 98, and back to nobody', () => {
    expect(LIVE.map((counts) => figureOf(counts, english)?.spoken ?? null)).toEqual([
      null,
      '1 of 96 arrived',
      '2 of 97 arrived',
      '3 of 98 arrived',
      '2 of 97 arrived',
      '1 of 96 arrived',
      null,
    ]);
  });

  it('writes four digits the locale’s way', () => {
    expect(figureOf(COUNTS.thousands, english)?.spoken).toBe('1,204 of 1,250 arrived');
    expect(figureOf(COUNTS.thousands, french)?.count).toBe('1 204');
  });

  it('reads the served expected, so a guest let in at 41 of 98 reads 42 of 99', () => {
    const letIn = { arrived: 42, coming: 96, expected: 99 };

    expect(figureOf(letIn, english)).toMatchObject({
      spoken: '42 of 99 arrived',
      share: 42 / 99,
    });
    expect(figureOf({ arrived: 97, coming: 96, expected: 97 }, english)?.spoken).toBe(
      '97 of 97 arrived',
    );
  });
});

describe('the card’s line', () => {
  it('keeps the replies line and bar while nobody has arrived', () => {
    expect(readyOf(COUNTS.none, english)).toEqual({
      words: '96 coming · 82% replied',
      percent: 82,
    });
  });

  it('has no bar with nobody Coming', () => {
    expect(readyOf(COUNTS.nobodyComing, english)).toEqual({ words: '37 arrived', percent: 0 });
  });

  it('fills the bar only once everyone Coming has arrived', () => {
    expect(readyOf({ arrived: 1, coming: 96, expected: 96 }, english)?.percent).toBe(1);
    expect(readyOf(COUNTS.some, english)?.percent).toBe(87);
    expect(readyOf({ arrived: 12, coming: 1250, expected: 1250 }, english)?.percent).toBe(1);
    expect(readyOf({ arrived: 1249, coming: 1250, expected: 1250 }, english)?.percent).toBe(99);
    expect(readyOf({ arrived: 99, coming: 96, expected: 99 }, english)?.percent).toBe(100);
  });
});

describe('the built Now with arrivals', () => {
  const day = momentOf('dayNow', sayIn('en-GB'), i18n.t);
  const arrived = withArrived(day, COUNTS.some, english);

  it('puts the line on the wedding’s card and the replies lines on the others', () => {
    expect(arrived.events.map((card) => card.ready?.words ?? null)).toEqual([
      '87 of 99 arrived',
      '31 coming · 63% replied',
      '20 coming · 58% replied',
      null,
    ]);
  });

  it('keeps the built Now: no Next, its ends line and Open the event', () => {
    expect(arrived.now?.ends).toBe(day.now?.ends);
    expect(arrived.figure?.spoken).toBe('87 of 99 arrived');
  });
});

describe('the wedding, counted as Guests A and Messaging B count it', () => {
  const wedding = (name: 'plan' | 'day') =>
    momentOf(name, sayIn('en-GB'), i18n.t).events.find((card) => card.event.id === 'wed');

  it('reads the same replies line before anyone has arrived as on the planning day', () => {
    expect(readyOf(COUNTS.none, english)).toEqual(wedding('plan')?.ready);
  });

  it('reads the same figure on the event day’s card, its Now and the arrived part', () => {
    const day = momentOf('day', sayIn('en-GB'), i18n.t);

    expect(readyOf(COUNTS.some, english)).toEqual(wedding('day')?.ready);
    expect(day.now).toMatchObject({ arrived: 87, expected: 99 });
    expect(COUNTS.some).toMatchObject({ arrived: day.now?.arrived, expected: day.now?.expected });
  });
});

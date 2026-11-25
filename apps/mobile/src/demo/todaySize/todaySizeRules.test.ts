import { describe, expect, it } from 'vitest';

import {
  EVENT_DATES,
  EVENT_NAME,
  HEAD,
  ONE_WORD,
  SIZE_TODAY,
  WEEK_DAYS,
  chipsUnderDates,
  dayLineShares,
  daysUntil,
  linkUnder,
  orgName,
  pillNameRoom,
  pillTileAlone,
  pillWaitingRoom,
  piecesOfLine,
  sizeEvents,
  thumbAbove,
  underName,
  wordsSize,
  wordsStart,
} from './todaySizeRules.ts';

const AX1 = 1.786;
const AX5 = 3.571;
const SEVENTH = 1.353;

describe('the greeting’s pieces', () => {
  it('keeps the comma on the word before it', () => {
    expect(piecesOfLine('Bonjour, QA')).toEqual(['Bonjour,', 'QA']);
  });

  it('splits a name only after its own hyphen', () => {
    expect(piecesOfLine('Bonsoir, Maximiliano-Bartholomew')).toEqual([
      'Bonsoir,',
      'Maximiliano-',
      'Bartholomew',
    ]);
  });
});

describe('a heading’s size', () => {
  it('is main’s below AX1, whatever its room', () => {
    expect(wordsSize(HEAD, SEVENTH, Infinity, 500, 100)).toBe(HEAD * SEVENTH);
  });

  it('starts no larger than the greeting from AX1', () => {
    expect(wordsStart(HEAD, AX5, 60)).toBeCloseTo(60);
  });

  it('keeps its start while its widest word fits', () => {
    expect(wordsSize(HEAD, AX5, Infinity, 200, 316)).toBe(HEAD * AX5);
  });

  it('steps down to the largest size its widest word fits', () => {
    expect(wordsSize(HEAD, AX5, Infinity, 400, 200)).toBe(Math.floor((HEAD * AX5 * 200) / 400));
  });

  it('never steps below its default size', () => {
    expect(wordsSize(HEAD, AX5, Infinity, 2000, 100)).toBe(HEAD);
  });
});

describe('a heading’s link', () => {
  it('sits beside the heading at the standard sizes and under it from AX1', () => {
    expect(linkUnder(SEVENTH)).toBe(false);
    expect(linkUnder(AX1)).toBe(true);
  });
});

describe('a row under Your events', () => {
  it('keeps its thumbnail beside its words at the standard sizes and puts it above them from AX1', () => {
    expect(thumbAbove(SEVENTH)).toBe(false);
    expect(thumbAbove(AX1)).toBe(true);
  });

  it('starts its other labels no larger than its name draws', () => {
    expect(underName(60, 40)).toBe(40);
    expect(underName(60, null)).toBe(60);
  });

  it('steps dimanche down alone, never under the dates’ default size', () => {
    expect(wordsSize(EVENT_DATES, AX5, Infinity, 300, 280)).toBe(
      Math.floor((EVENT_DATES * AX5 * 280) / 300),
    );
    expect(wordsSize(EVENT_NAME, AX5, Infinity, 3000, 280)).toBe(EVENT_NAME);
  });
});

describe('a tile on the phone', () => {
  it('puts its chips under the dates from AX1', () => {
    expect(chipsUnderDates(AX1)).toBe(true);
    expect(chipsUnderDates(SEVENTH)).toBe(false);
  });
});

describe('the size demo’s events', () => {
  it('puts the party on a Sunday, so French reads dimanche', () => {
    const party = sizeEvents('sample')[0];

    expect(new Date(`${party?.first}T12:00Z`).getUTCDay()).toBe(0);
    expect(daysUntil(SIZE_TODAY, party?.first ?? '')).toBe(4);
  });

  it('gives the first event the one long word when asked', () => {
    expect(sizeEvents('oneWord')[0]?.name).toBe(ONE_WORD);
    expect(sizeEvents('oneWord')[1]?.name).toBe(sizeEvents('sample')[1]?.name);
  });
});

describe('a This week day line (sc-92250)', () => {
  it('keeps the name and its dotted date on one line while both fit', () => {
    expect(dayLineShares(120, 110, 4, 234)).toBe(true);
  });

  it('sends the date to the line under once one pixel short', () => {
    expect(dayLineShares(120, 110, 4, 233)).toBe(false);
  });

  it('starts every week day on a date this week', () => {
    for (const day of WEEK_DAYS) {
      expect(daysUntil(SIZE_TODAY, day.date)).toBeGreaterThanOrEqual(0);
      expect(daysUntil(SIZE_TODAY, day.date)).toBeLessThan(7);
    }
  });
});

describe('the organisation pill on the phone (sc-92247)', () => {
  it('gives the name 186 on an iPhone 17 Pro, and the invitation line 169', () => {
    expect(pillNameRoom(370)).toBe(186);
    expect(pillWaitingRoom(370)).toBe(169);
  });

  it('steps QA Organisation down until Organisation fits, never under 15', () => {
    const start = wordsStart(15, AX5, Infinity);
    const organisation = 6.6 * start;
    const at = wordsSize(15, AX5, Infinity, organisation, pillNameRoom(370));
    expect(at).toBeLessThan(start);
    expect(at).toBeGreaterThanOrEqual(15);
    expect((organisation * at) / start).toBeLessThanOrEqual(pillNameRoom(370));
  });

  it('is its tile alone only from AX1, and only for a word too wide at 15', () => {
    expect(pillTileAlone(AX5, 380, 186)).toBe(true);
    expect(pillTileAlone(AX5, 99, 186)).toBe(false);
    expect(pillTileAlone(SEVENTH, 380, 186)).toBe(false);
    expect(pillTileAlone(AX1, null, 186)).toBe(false);
  });

  it('names the five organisations the AC renames it to', () => {
    expect(orgName('qa')).toBe('QA Organisation');
    expect(orgName('lumen')).toBe('Lumen Studio');
    expect(orgName('ire')).toBe('Ìrè Events');
    expect(orgName('several')).toBe('Atelier Céleste Réceptions et Mariages');
    expect(orgName('oneWord')).toBe(ONE_WORD);
  });
});

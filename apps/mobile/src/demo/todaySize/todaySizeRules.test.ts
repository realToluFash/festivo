import { describe, expect, it } from 'vitest';

import {
  EVENT_DATES,
  EVENT_NAME,
  HEAD,
  LIVE_CHIP,
  LIVE_ENDS,
  LIVE_NAME,
  ONE_WORD,
  SWITCHER_NAME,
  TODAY_ORGS,
  SIZE_TODAY,
  WEEK_DAYS,
  chipsUnderDates,
  dotKept,
  dayChipRoom,
  dayLineShares,
  daysUntil,
  linkUnder,
  liveChipRoom,
  liveName,
  openRoom,
  piecesKeepingDot,
  switcherOrgs,
  openUnder,
  orgName,
  pillNameRoom,
  pillTileAlone,
  pillWaitingRoom,
  piecesOfLine,
  sizeEvents,
  thumbAbove,
  underName,
  uprightTile,
  uprightTop,
  wordsSize,
  wordsStart,
} from './todaySizeRules.ts';

const AX1 = 1.786;
const NB = String.fromCharCode(0xa0);
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

describe('the upright iPad’s top row (sc-92314)', () => {
  // The iPad Pro 13-inch upright: 1032 wide, 984 inside its side margins.
  const ROW = 984;
  // Today, Events, Calendar and Settings, semibold at 15 × AX1, as macOS draws them.
  const EN_AX1 = [72, 85, 113, 101];
  const EN_AX5 = EN_AX1.map((width) => (width * AX5) / AX1);

  it('at AX1 in English keeps the tabs at their own size and leaves the pill room for Organisation', () => {
    const top = uprightTop(AX1, EN_AX1, ROW);

    expect(top.givesWay).toBe(false);
    expect(top.labelSize).toBeCloseTo(15 * AX1);
    expect(top.pill).toBeCloseTo((ROW - top.capsule) / 2 - 12);
    expect(top.pill).toBeGreaterThanOrEqual(120);
    expect(uprightTile(AX1, top, { nameStart: 0, waitingLine: null })).toBe(false);
    expect(pillTileAlone(AX1, 92, top.nameRoom)).toBe(false);
    expect(wordsSize(15, AX1, Infinity, 92 * AX1, top.nameRoom)).toBeLessThan(15 * AX1);
  });

  it('at AX1 a word too wide even at its default size is the tile alone', () => {
    const top = uprightTop(AX1, EN_AX1, ROW);

    expect(pillTileAlone(AX1, 331, top.nameRoom)).toBe(true);
  });

  it('at AX5 the tabs step under their own size, so the pill gives way to its tile', () => {
    const top = uprightTop(AX5, EN_AX5, ROW);

    expect(top.givesWay).toBe(true);
    expect(uprightTile(AX5, top, { nameStart: 0, waitingLine: null })).toBe(true);
  });

  it('leaves the pill under 120 its tile', () => {
    const top = uprightTop(AX1, [150, 140, 140, 130], ROW);

    expect(top.pill).toBeLessThan(120);
    expect(uprightTile(AX1, top, { nameStart: 0, waitingLine: null })).toBe(true);
  });

  it('below AX1 is main’s: the first word and its “…” on one line, or the tile', () => {
    const top = uprightTop(SEVENTH, [55, 64, 85, 76], ROW);

    expect(uprightTile(SEVENTH, top, { nameStart: 40, waitingLine: null })).toBe(false);
    expect(uprightTile(SEVENTH, top, { nameStart: top.pill, waitingLine: null })).toBe(true);
  });
});

describe('the live cover on its side (sc-92312)', () => {
  it('has a live event only once one is chosen', () => {
    expect(liveName('none')).toBeNull();
    expect(liveName('dinner')).toBe('Dîner en direct');
    expect(liveName('oneWord')).toBe(ONE_WORD);
  });

  it('puts Open the event under the words from AX1 only', () => {
    expect(openUnder(SEVENTH)).toBe(false);
    expect(openUnder(AX1)).toBe(true);
    expect(openUnder(AX5)).toBe(true);
  });

  it('breaks the name only between its words', () => {
    expect(piecesOfLine('Dîner en direct')).toEqual(['Dîner', 'en', 'direct']);
  });

  it('steps the name down until direct fits, never under 48', () => {
    const start = wordsStart(LIVE_NAME, AX5, Infinity);
    expect(wordsSize(LIVE_NAME, AX5, Infinity, 600, 1000)).toBe(start);
    expect(wordsSize(LIVE_NAME, AX5, Infinity, 1200, 1000)).toBe(Math.floor((start * 1000) / 1200));
    expect(wordsSize(LIVE_NAME, AX5, Infinity, 9000, 1000)).toBe(LIVE_NAME);
  });

  it('starts the end line and the chips no larger than the name draws', () => {
    expect(wordsStart(LIVE_ENDS, AX5, 40)).toBeCloseTo(40);
    expect(wordsStart(LIVE_ENDS, AX5, Infinity)).toBe(LIVE_ENDS * AX5);
    expect(wordsStart(LIVE_CHIP, AX5, 30)).toBeCloseTo(30);
    expect(wordsStart(LIVE_ENDS, 1, 48)).toBe(LIVE_ENDS);
  });

  it('gives each chip and the button the column less what they hold', () => {
    expect(dayChipRoom(500)).toBe(476);
    expect(liveChipRoom(500)).toBe(456);
    expect(openRoom(500)).toBe(430);
    expect(liveChipRoom(10)).toBe(0);
  });
});

describe('the switcher’s rows from AX1 (sc-92465)', () => {
  it('puts the organisation you are in first, then every other once each', () => {
    expect(switcherOrgs('several')).toEqual(['several', 'qa', 'lumen', 'ire', 'oneWord']);
    expect(switcherOrgs('lumen')).toEqual(['lumen', 'qa', 'ire', 'several', 'oneWord']);
  });

  it('keeps every organisation reachable from any of them', () => {
    for (const { key } of TODAY_ORGS)
      expect([...switcherOrgs(key)].sort()).toEqual(TODAY_ORGS.map((one) => one.key).sort());
  });

  it('keeps the role line’s dot on the word before it', () => {
    expect(dotKept('Votre rôle · Owner')).toBe(`Votre rôle${NB}· Owner`);
    expect(piecesKeepingDot(dotKept('Your role · Owner'))).toEqual(['Your', `role${NB}·`, 'Owner']);
  });

  it('steps a name only as far as its widest word needs, never under its default size', () => {
    const start = wordsStart(SWITCHER_NAME, 3.571, Infinity);
    expect(wordsSize(SWITCHER_NAME, 3.571, Infinity, 100, 238)).toBe(start);
    expect(wordsSize(SWITCHER_NAME, 3.571, Infinity, 311, 238)).toBe(
      Math.floor((start * 238) / 311),
    );
    expect(wordsSize(SWITCHER_NAME, 3.571, Infinity, 2000, 238)).toBe(SWITCHER_NAME);
  });
});

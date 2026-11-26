import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';
import { waitingRoomUnder, wholeTileAlone } from '../../layout/pillFit.ts';
import { dotKept } from '../../layout/textSize.ts';

import {
  ARRIVING_EVERY,
  FIGURE_RING,
  TODAY_ARRIVEDS,
  arrivedCount,
  figureRing,
  figureRoom,
  EVENT_DATES,
  EVENT_NAME,
  HEAD,
  LIVE_CHIP,
  LIVE_ENDS,
  LIVE_NAME,
  ONE_WORD,
  SWITCHER_NAME,
  TODAY_ORGS,
  TODAY_VENUES,
  SIZE_TODAY,
  STRIP_LABEL,
  STRIP_TRACKING,
  WEEK_DAYS,
  chipsUnderDates,
  daysUntil,
  stripDays,
  stripLabelSize,
  linkUnder,
  liveName,
  piecesKeepingDot,
  switcherOrgs,
  uprightChipSize,
  venueName,
  openUnder,
  orgName,
  pillNameRoom,
  tileRoom,
  pillWaitingRoom,
  piecesOfLine,
  sizeEvents,
  thumbAbove,
  underName,
  uprightTile,
  uprightTop,
  waitingFirstLine,
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

  it('gives the app’s tile rule its line only from AX1, so below it the pill keeps its words', () => {
    expect(tileRoom(AX5, 186)).toBe(186);
    expect(tileRoom(AX1, 186)).toBe(186);
    expect(tileRoom(SEVENTH, 186)).toBeUndefined();
  });

  it('is its tile alone only for a word too wide at 15', () => {
    expect(wholeTileAlone(380, 186)).toBe(true);
    expect(wholeTileAlone(99, 186)).toBe(false);
  });

  it('is its tile alone too where the invitation line’s widest word at 12.5 is wider than the room under the name, as the app (sc-92314)', () => {
    expect(wholeTileAlone(50, 93, waitingRoomUnder(93) + 1)).toBe(true);
    expect(wholeTileAlone(50, 93, waitingRoomUnder(93))).toBe(false);
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
    expect(top.pill).toBeCloseTo((ROW - top.capsule) / 2 - 8);
    expect(top.pill).toBeGreaterThanOrEqual(120);
    expect(uprightTile(AX1, top, { nameStart: 0, waitingLine: null })).toBe(false);
    expect(wholeTileAlone(92, top.nameRoom)).toBe(false);
    expect(wordsSize(15, AX1, Infinity, 92 * AX1, top.nameRoom)).toBeLessThan(15 * AX1);
  });

  it('at AX1 in English keeps QA Organisation in words with the tabs as Instrument Sans draws them', () => {
    const measured = EN_AX1.map((width) => (width * 383) / 371);
    const top = uprightTop(AX1, measured, ROW);

    expect(top.givesWay).toBe(false);
    expect(wholeTileAlone(91.8, top.nameRoom)).toBe(false);
  });

  it('at AX1 a word too wide even at its default size is the tile alone', () => {
    const top = uprightTop(AX1, EN_AX1, ROW);

    expect(wholeTileAlone(331, top.nameRoom)).toBe(true);
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
});

describe('the live cover upright (sc-93578)', () => {
  const live = readFileSync(join('src', 'demo', 'todaySize', 'TodaySizeLive.tsx'), 'utf8');

  it('draws Open the event inside the words column upright, as on its side, never beside the name', () => {
    const words = /\n {2}const words = \([\s\S]*?\n {2}\);\n/u.exec(live)?.[0] ?? '';
    const upright = /\n {2}if \(upright\)[\s\S]*?\n {4}\);\n/u.exec(live)?.[0] ?? '';

    expect(words).toMatch(
      /\{under && <View style=\{phone \? styles\.openFlush : styles\.openUnder\}>\{open\}<\/View>\}\n {6}\{under && !phone && arrived != null && \([\s\S]*?<SizeFigure[\s\S]*?\)\}\n {4}<\/View>\n/u,
    );
    expect(live).toMatch(/\n {2}openFlush: \{ alignItems: 'flex-start' \},\n/u);
    expect(live).toMatch(/\n {2}const block = under \? \(\n {4}words\n {2}\) : \(/u);
    expect(upright).toMatch(/<View style=\{styles\.uprightNow\}>\{block\}<\/View>/u);
  });

  it('moves Open the event under the end line from AX1, as on its side', () => {
    expect(openUnder(SEVENTH)).toBe(false);
    expect(openUnder(AX1)).toBe(true);
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

  it('centres the ring on the invitation line’s first line, the height of one line at its drawn size', () => {
    expect(waitingFirstLine(12.5)).toBe(17);
    expect(waitingFirstLine(23)).toBe(30);
  });

  it("draws an upright chip at main's size at every stand-in size, never stepped down (sc-93211)", () => {
    for (const scale of [1, 1.353, 2.118, 3.118])
      expect(uprightChipSize(scale)).toBe(LIVE_CHIP * scale);
  });

  it("puts the long venue on the day's chip only when chosen, and keeps its dot on the word before (sc-93211)", () => {
    expect(TODAY_VENUES.map((one) => one.key)).toEqual(['none', 'chantilly']);
    expect(venueName('none')).toBeNull();
    expect(venueName('chantilly')).toBe('Salle des fêtes du Château de Chantilly');
    expect(dotKept('Jour 1 sur 1 · Salle des fêtes du Château de Chantilly')).toBe(
      'Jour 1 sur 1\u00a0· Salle des fêtes du Château de Chantilly',
    );
  });
});

describe('the live cover with a guest arrived (sc-94022)', () => {
  it('counts 1 of 12 and 141 of 152, and nobody until one is chosen', () => {
    expect(TODAY_ARRIVEDS.map((one) => one.key)).toEqual(['none', 'one', 'many', 'live']);
    expect(arrivedCount('none', 0)).toBeNull();
    expect(arrivedCount('one', 0)).toEqual({ arrived: 1, expected: 12 });
    expect(arrivedCount('many', 0)).toEqual({ arrived: 141, expected: 152 });
  });

  it('brings the first arrival in and undoes it again, inside 10 seconds', () => {
    expect([0, 1, 2, 3].map((step) => arrivedCount('live', step))).toEqual([
      null,
      { arrived: 1, expected: 12 },
      null,
      { arrived: 1, expected: 12 },
    ]);
    expect(ARRIVING_EVERY).toBeLessThanOrEqual(10_000);
  });

  it('keeps main’s ring below AX1 and grows it to the two lines from AX1', () => {
    expect(figureRing(18, 12.5)).toBe(FIGURE_RING);
    expect(figureRing(18 * AX5, 12.5 * AX5)).toBe(
      Math.ceil(18 * AX5 * 1.2) + Math.ceil(12.5 * AX5 * 1.3),
    );
  });

  it('draws the figure from AX1 under Open the event, last in the words column, below AX1 over it at the right, and on the phone over its hairline as main does', () => {
    const live = readFileSync(join('src', 'demo', 'todaySize', 'TodaySizeLive.tsx'), 'utf8');
    const words = /\n {2}const words = \([\s\S]*?\n {2}\);\n/u.exec(live)?.[0] ?? '';
    const block = /\n {2}const block = [\s\S]*?\n {2}\);\n/u.exec(live)?.[0] ?? '';

    expect(words.lastIndexOf('<SizeFigure')).toBeGreaterThan(words.indexOf('styles.openUnder'));
    expect(words.indexOf('<SizeFigure')).toBeLessThan(words.indexOf('styles.hair'));
    expect(words).toMatch(/\{phone && arrived != null && \(\s+<View>\s+<SizeFigure/u);
    expect(block).toMatch(/<View style=\{styles\.right\}>\s+<SizeFigure[^>]*\/>\s+\{open\}/u);
  });

  it('gives the figure’s words the column less the ring and its gap', () => {
    expect(figureRoom(968, 136, 10)).toBe(822);
    expect(figureRoom(100, 136, 10)).toBe(0);
  });
});

describe('This week’s strip, a day’s label (sc-94682)', () => {
  const seventh = STRIP_LABEL * 1.353;

  it('keeps the step’s size while the label fits its column', () => {
    expect(stripLabelSize(seventh, 40, 3, 47)).toBe(seventh);
    expect(stripLabelSize(seventh, 47, 5, 47)).toBe(seventh);
  });

  it('steps TODAY down to the largest whole size at which it fits its column', () => {
    const drawn = stripLabelSize(seventh, 52, 5, 47);
    const tracking = 5 * STRIP_TRACKING;
    const at = (size: number) => ((52 - tracking) * size) / seventh + tracking;

    expect(drawn).toBe(13);
    expect(at(drawn)).toBeLessThanOrEqual(47);
    expect(at(drawn + 1)).toBeGreaterThan(47);
  });

  it('never draws a label under its default size, even where it is too wide there', () => {
    expect(stripLabelSize(seventh, 120, 5, 47)).toBe(STRIP_LABEL);
    expect(stripLabelSize(STRIP_LABEL, 60, 5, 47)).toBe(STRIP_LABEL);
  });

  it('draws seven days from today, a dot only where an event has a row', () => {
    const days = stripDays('days');

    expect(days.map((day) => day.date)).toEqual([
      SIZE_TODAY,
      '2026-11-26',
      '2026-11-27',
      '2026-11-28',
      '2026-11-29',
      '2026-11-30',
      '2026-12-01',
    ]);
    expect(days.map((day) => day.dots)).toEqual([['ireti'], ['wed'], [], [], ['party'], [], []]);
    expect(stripDays('quiet').every((day) => day.dots.length === 0)).toBe(true);
  });
});

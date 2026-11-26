import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  BAND_COMES,
  OPEN_ABOVE_SHEET,
  TAB_FADE,
  WORDS_GO,
  type Fold,
  foldAt,
  reachAt,
  restingPlaces,
  wordsGoFrom,
} from './todayFoldRules.ts';

const SHEET_RISE = 28;

const mainDefault: Fold = {
  coverFoot: 62 + 376,
  sheetRise: SHEET_RISE,
  bandFoot: 62 + 84,
  screen: 874,
};
const proAx5: Fold = { coverFoot: 1150, sheetRise: SHEET_RISE, bandFoot: 240, screen: 874 };
const seAx5: Fold = { coverFoot: 1220, sheetRise: SHEET_RISE, bandFoot: 260, screen: 667 };

function openFoot(fold: Fold, scroll: number) {
  return fold.coverFoot - fold.sheetRise - OPEN_ABOVE_SHEET - scroll;
}

describe('where Today comes to rest on the phone (sc-95084)', () => {
  it('rests open and folded only, as on main, while the cover fits above the tabs', () => {
    expect(reachAt(mainDefault)).toBeNull();
    expect(restingPlaces(mainDefault)).toEqual([0, foldAt(mainDefault)]);
    expect(wordsGoFrom(mainDefault)).toBe(foldAt(mainDefault) - BAND_COMES - WORDS_GO);
  });

  it.each([
    ['the 17 Pro at AX5', proAx5],
    ['the SE at AX5', seAx5],
  ])('rests between them on %s, Open the event whole above the fade', (_, fold) => {
    const places = restingPlaces(fold);
    const reach = places[1] ?? 0;

    expect(places).toEqual([0, reach, foldAt(fold)]);
    expect(openFoot(fold, reach)).toBeLessThanOrEqual(fold.screen - TAB_FADE);
    expect(openFoot(fold, reach)).toBeGreaterThan(fold.screen - TAB_FADE - 1);
    expect(reach).toBeLessThan(foldAt(fold) - BAND_COMES);
  });

  it('keeps the cover’s words at full ink where Open the event rests', () => {
    for (const fold of [proAx5, seAx5]) {
      expect(wordsGoFrom(fold)).toBeGreaterThanOrEqual(reachAt(fold) ?? Infinity);
    }

    const tall: Fold = { coverFoot: 1000, sheetRise: SHEET_RISE, bandFoot: 120, screen: 300 };
    expect(reachAt(tall)).toBe(800);
    expect(wordsGoFrom(tall)).toBe(800);
  });

  it('adds no resting place the band would cover', () => {
    const short: Fold = { coverFoot: 600, sheetRise: SHEET_RISE, bandFoot: 300, screen: 400 };

    expect(reachAt(short)).toBeNull();
    expect(restingPlaces(short)).toEqual([0, foldAt(short)]);
  });
});

describe('the numbers the rule follows are main’s (sc-95084)', () => {
  const components = join(import.meta.dirname, '..', '..', 'components');
  const read = (file: string) => readFileSync(join(components, file), 'utf8');

  it('parks Open the event at the top of the fade main draws', () => {
    expect(read('TodayCover.tsx')).toMatch(
      new RegExp(`\\bfade: \\{[^}]*\\bheight: ${TAB_FADE}\\b`),
    );
  });

  it('brings the band and takes the words away over main’s spans', () => {
    const today = read('TodayScreen.tsx');

    expect(today).toMatch(/const bandFrom = foldAt - tokens\.space3xl;/);
    expect(today).toMatch(new RegExp(`const WORDS_GO = ${WORDS_GO};`));
  });
});

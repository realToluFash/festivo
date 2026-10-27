import { describe, expect, it } from 'vitest';

import {
  PAGE_BESIDE_MIN_WIDTH,
  SIDE_MIN_WIDTH,
  TABLET_MIN_DIMENSION,
  UPRIGHT_MIN_WIDTH,
  classifyLayout,
  isTablet,
  listAndPageKind,
  listFitsBeside,
  sectionWidth,
} from './classify.ts';

/**
 * The classifier, against the sizes real devices actually report.
 *
 * Written against measurements rather than against the implementation, because
 * the bug this guards is specific: classifying by width alone makes a phone in
 * landscape report as a tablet, and the two want completely different layouts.
 */
describe('phones', () => {
  it.each([
    ['iPhone SE portrait', 375, 667],
    ['iPhone SE landscape', 667, 375],
    ['iPhone 16 Pro Max portrait', 440, 956],
    ['iPhone 16 Pro Max landscape', 956, 440],
    ['a small Android portrait', 360, 800],
  ])('%s is a phone', (_name, width, height) => {
    expect(classifyLayout({ width, height })).toBe('phone');
  });

  /**
   * The one that matters. A 956pt-wide phone is WIDER than an 834pt-wide iPad
   * in portrait, so any threshold on width alone gets this backwards.
   */
  it('does not mistake a wide phone in landscape for a tablet', () => {
    const phone = classifyLayout({ width: 956, height: 440 });
    const tablet = classifyLayout({ width: 834, height: 1194 });

    expect(phone).toBe('phone');
    expect(tablet).toBe('tabletPortrait');
    expect(956).toBeGreaterThan(834);
  });
});

describe('tablets', () => {
  it.each([
    ['iPad mini portrait', 744, 1133, 'tabletPortrait'],
    ['iPad mini landscape', 1133, 744, 'tabletLandscape'],
    ['iPad Pro portrait', 1024, 1366, 'tabletPortrait'],
    ['iPad Pro landscape', 1366, 1024, 'tabletLandscape'],
    ['iPad 11-inch portrait', 834, 1194, 'tabletPortrait'],
    ['iPad 11-inch landscape', 1194, 834, 'tabletLandscape'],
    ['the Android tablet portrait', 800, 1280, 'tabletPortrait'],
    ['the Android tablet landscape', 1280, 800, 'tabletLandscape'],
    ['a 7-inch Android portrait', 600, 960, 'phone'],
    ['a 7-inch Android landscape', 960, 600, 'tabletPortrait'],
    ['the narrowest tablet window', 600, 800, 'phone'],
    ['beside another app on the Android tablet', 640, 800, 'phone'],
    ['iPad mini landscape in half the screen', 566, 744, 'phone'],
  ])('%s is %s', (_name, width, height, expected) => {
    expect(classifyLayout({ width, height })).toBe(expected);
  });

  /** A square window has to land somewhere, and landscape is the wider shape. */
  it('treats a square window wide enough for the rail as landscape', () => {
    expect(classifyLayout({ width: 1000, height: 1000 })).toBe('tabletLandscape');
    expect(classifyLayout({ width: 800, height: 800 })).toBe('tabletPortrait');
  });
});

describe('the thresholds', () => {
  it('takes the smaller side first, exclusive below and inclusive at the boundary', () => {
    const below = TABLET_MIN_DIMENSION - 1;

    expect(classifyLayout({ width: 1000, height: below })).toBe('phone');
    expect(classifyLayout({ width: 1000, height: TABLET_MIN_DIMENSION })).toBe('tabletLandscape');
  });

  /** Width only ever steps a window down, so the windows sc-12241 lists land in the next narrower layout. */
  it.each([
    [743, 800, 'phone'],
    [744, 800, 'tabletPortrait'],
    [700, 620, 'phone'],
    [800, 620, 'tabletPortrait'],
    [960, 600, 'tabletPortrait'],
    [963, 620, 'tabletPortrait'],
    [964, 620, 'tabletLandscape'],
  ])('%i×%i is %s', (width, height, expected) => {
    expect(classifyLayout({ width, height })).toBe(expected);
  });

  it('is built from the columns each layout holds', () => {
    expect(UPRIGHT_MIN_WIDTH).toBe(320 + 64 + PAGE_BESIDE_MIN_WIDTH);
    expect(SIDE_MIN_WIDTH).toBe(UPRIGHT_MIN_WIDTH + 220);
  });
});

/** Roles' list is 236 with 16 between and margins of 64; Members' is 300 with 20 and 48; Events' 360 with 20 and 48. */
describe('a list beside its page', () => {
  const ROLES = { margins: 64, list: 236, between: 16 };
  const MEMBERS = { margins: 48, list: 300, between: 20 };
  const side = (width: number, fontScale = 1) => ({ width, height: 800, fontScale });

  it.each([
    ['an iPad mini on its side', 1133, 'tabletPortrait', 'tabletPortrait'],
    ['an 11-inch iPad on its side', 1180, 'tabletPortrait', 'tabletPortrait'],
    ['1240 wide', 1240, 'tabletLandscape', 'tabletPortrait'],
    ['the Android tablet on its side', 1280, 'tabletLandscape', 'tabletLandscape'],
    ['a 13-inch iPad on its side', 1376, 'tabletLandscape', 'tabletLandscape'],
  ])('%s in Settings: Roles %s, Members %s', (_name, width, roles, members) => {
    expect(listAndPageKind(side(width), 'settingsList', ROLES)).toBe(roles);
    expect(listAndPageKind(side(width), 'settingsList', MEMBERS)).toBe(members);
  });

  it('keeps a page its 360 at the boundary', () => {
    expect(listAndPageKind(side(1216), 'settingsList', ROLES)).toBe('tabletLandscape');
    expect(listAndPageKind(side(1215), 'settingsList', ROLES)).toBe('tabletPortrait');
    expect(listAndPageKind(side(1268), 'settingsList', MEMBERS)).toBe('tabletLandscape');
    expect(listAndPageKind(side(1267), 'settingsList', MEMBERS)).toBe('tabletPortrait');
  });

  it('gives a section the window less the rail, and less the Settings list in Settings', () => {
    expect(sectionWidth(side(1133), 'nothing')).toBe(1133 - 220);
    expect(sectionWidth(side(1133), 'settingsList')).toBe(1133 - 220 - 320);
    expect(sectionWidth({ width: 834, height: 1194, fontScale: 1 }, 'settingsList')).toBe(
      834 - 320,
    );
    expect(sectionWidth({ width: 430, height: 932, fontScale: 1 }, 'settingsList')).toBe(430);
  });

  it('widens the rail and the lists at the accessibility sizes', () => {
    expect(sectionWidth(side(1376, 2), 'settingsList')).toBe(1376 - 300 - Math.round(1076 * 0.4));
    expect(listAndPageKind(side(1376, 2), 'settingsList', ROLES)).toBe('tabletPortrait');
  });

  it('leaves Events, with nothing beside it, its list beside the page from 1133', () => {
    const EVENTS = { margins: 48, list: 360, between: 20 };

    expect(listAndPageKind(side(1133), 'nothing', EVENTS)).toBe('tabletLandscape');
  });

  it('decides one at a time from the arithmetic it shows', () => {
    expect(listFitsBeside(1216 - 220 - 320, ROLES)).toBe(true);
    expect(listFitsBeside(1215 - 220 - 320, ROLES)).toBe(false);
  });

  it('leaves the phone and upright layouts as they are', () => {
    expect(listAndPageKind({ width: 834, height: 1194, fontScale: 1 }, 'settingsList', ROLES)).toBe(
      'tabletPortrait',
    );
    expect(listAndPageKind({ width: 932, height: 430, fontScale: 1 }, 'settingsList', ROLES)).toBe(
      'phone',
    );
  });
});

/**
 * A window measured before layout, a hidden frame, a web container with no
 * height yet. Phone is the safe answer: it is the narrowest layout so it fits
 * anywhere, whereas guessing tablet puts a two-column layout into 320pt.
 */
describe('degenerate sizes', () => {
  it.each([
    ['zero', 0, 0],
    ['no height', 1024, 0],
    ['negative', -1, -1],
    ['not a number', Number.NaN, 800],
    ['infinite', Number.POSITIVE_INFINITY, 800],
  ])('%s falls back to phone rather than guessing', (_name, width, height) => {
    expect(classifyLayout({ width, height })).toBe('phone');
  });
});

describe('isTablet', () => {
  it('is true for both tablet orientations and false for a phone', () => {
    expect(isTablet('tabletPortrait')).toBe(true);
    expect(isTablet('tabletLandscape')).toBe(true);
    expect(isTablet('phone')).toBe(false);
  });
});

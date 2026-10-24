import { describe, expect, it } from 'vitest';

import { TABLET_MIN_DIMENSION, classifyLayout, isTablet } from './classify.ts';

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
    ['a 7-inch Android portrait', 600, 960, 'tabletPortrait'],
  ])('%s is %s', (_name, width, height, expected) => {
    expect(classifyLayout({ width, height })).toBe(expected);
  });

  /** A square window has to land somewhere, and landscape is the wider shape. */
  it('treats a square window as landscape', () => {
    expect(classifyLayout({ width: 800, height: 800 })).toBe('tabletLandscape');
  });
});

describe('the threshold', () => {
  it('is exclusive below and inclusive at the boundary', () => {
    const below = TABLET_MIN_DIMENSION - 1;

    expect(classifyLayout({ width: below, height: 1000 })).toBe('phone');
    expect(classifyLayout({ width: TABLET_MIN_DIMENSION, height: 1000 })).toBe('tabletPortrait');
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

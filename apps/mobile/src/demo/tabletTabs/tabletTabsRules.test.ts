import { describe, expect, it } from 'vitest';

import {
  CAPSULE_CHROME,
  capsuleLabelSize,
  capsuleRoom,
  capsuleWidth,
  languageOf,
  pillGivesWay,
  scaleFor,
  sizeOf,
} from './tabletTabsRules.ts';

const ROW_800 = 800 - 2 * 28;

describe('the capsule’s labels', () => {
  it('leaves 628 for the capsule on an 800-wide upright tablet', () => {
    expect(capsuleRoom(ROW_800)).toBe(628);
  });

  it('keeps the text size’s own size where the capsule fits at it', () => {
    expect(capsuleLabelSize(1, 330, 628)).toBe(15);
    expect(capsuleLabelSize(2, 2 * 180, 628)).toBe(30);
  });

  it('takes the largest size that fits, one size for all four', () => {
    const size = capsuleLabelSize(2, 2 * 330, 628);

    expect(size).toBe(17);
    expect(capsuleWidth(2 * 330, 30, size)).toBeLessThanOrEqual(628);
    expect(capsuleWidth(2 * 330, 30, size + 1)).toBeGreaterThan(628);
  });

  it('never goes under the default size', () => {
    expect(capsuleLabelSize(2, 2 * 330, 400)).toBe(15);
  });

  it('never goes over the text size’s own size', () => {
    expect(capsuleLabelSize(1.3, 1.3 * 330, 10_000)).toBe(19.5);
  });

  it('draws its own size until it has measured', () => {
    expect(capsuleLabelSize(2, 0, 628)).toBe(30);
    expect(capsuleLabelSize(2, 660, 0)).toBe(30);
  });

  it('counts the capsule’s chrome', () => {
    expect(CAPSULE_CHROME).toBe(234);
  });
});

describe('the pill beside the tabs', () => {
  it('is its tile while the labels are under their own size', () => {
    expect(pillGivesWay(2, 17)).toBe(true);
    expect(pillGivesWay(2, 30)).toBe(false);
    expect(pillGivesWay(1, 15)).toBe(false);
  });
});

describe('the board’s choices', () => {
  it('falls back to this device’s size and English', () => {
    expect(sizeOf(undefined)).toBe('device');
    expect(sizeOf('android')).toBe('android');
    expect(languageOf('de')).toBe('en');
    expect(languageOf('fr')).toBe('fr');
    expect(scaleFor('device', 1.3)).toBe(1.3);
    expect(scaleFor('android', 1.3)).toBe(2);
    expect(scaleFor('iphone', 1)).toBe(2.14);
  });
});

import { describe, expect, it } from 'vitest';

import { capsuleChrome, capsuleLabelSize, capsuleRoom, pillGivesWay } from './capsuleFit.ts';

const ROW_800 = 800 - 2 * 24;

function capsuleWidth(tabs: number, labels: number, own: number, size: number): number {
  return capsuleChrome(tabs) + (labels * size) / own;
}

describe('the upright tablet’s capsule', () => {
  it('leaves the row less the tile with its ring, the bell and a 12 gap beside each', () => {
    expect(capsuleRoom(ROW_800)).toBe(ROW_800 - 2 * 58);
  });

  it('counts the chrome of four tabs as the capsule draws it', () => {
    expect(capsuleChrome(4)).toBe(234);
  });

  it('keeps the text size’s own size where the capsule fits at it', () => {
    expect(capsuleLabelSize(1, 4, 330, 636)).toBe(15);
    expect(capsuleLabelSize(2, 4, 2 * 180, 636)).toBe(30);
  });

  it('takes the largest size that fits, one size for every label', () => {
    const size = capsuleLabelSize(2, 4, 2 * 330, 636);

    expect(capsuleWidth(4, 660, 30, size)).toBeLessThanOrEqual(636);
    expect(capsuleWidth(4, 660, 30, size + 1)).toBeGreaterThan(636);
  });

  it('never goes under the default size', () => {
    expect(capsuleLabelSize(2, 4, 2 * 330, 400)).toBe(15);
  });

  it('never goes over the text size’s own size', () => {
    expect(capsuleLabelSize(1.3, 4, 1.3 * 330, 10_000)).toBe(19.5);
  });

  it('never grows a text size smaller than the default', () => {
    expect(capsuleLabelSize(0.85, 4, 600, 300)).toBe(12.75);
  });

  it('draws its own size until the labels and the row are measured', () => {
    expect(capsuleLabelSize(2, 4, 0, 636)).toBe(30);
    expect(capsuleLabelSize(2, 4, 660, 0)).toBe(30);
  });
});

describe('the pill beside the capsule', () => {
  it('is its tile while the labels are under their own size', () => {
    expect(pillGivesWay(2, 17)).toBe(true);
    expect(pillGivesWay(2, 30)).toBe(false);
    expect(pillGivesWay(1, 15)).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';

import {
  capsuleChrome,
  capsuleGrowth,
  capsuleLabelSize,
  capsuleRoom,
  fittedLabelSize,
  pillGivesWay,
} from './capsuleFit.ts';

const ROW_800 = 800 - 2 * 24;

function capsuleWidth(tabs: number, labels: number, own: number, size: number): number {
  return capsuleChrome(tabs) + (labels * size) / own;
}

describe('the upright tablet’s capsule', () => {
  it('leaves the row less the tile with its ring, the bell and a 12 gap beside each', () => {
    expect(capsuleRoom(ROW_800)).toBe(ROW_800 - 2 * 58);
  });

  it('stops 12 short of Search and the bell where they end the row, on each side as it is centred', () => {
    expect(capsuleRoom(ROW_800, 96)).toBe(ROW_800 - 2 * 108);
    expect(capsuleRoom(ROW_800, 40)).toBe(capsuleRoom(ROW_800));
  });

  it('grows its row only by what a taller label adds to its 46', () => {
    expect(capsuleGrowth(0)).toBe(0);
    expect(capsuleGrowth(46)).toBe(0);
    expect(capsuleGrowth(61)).toBe(15);
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

describe('the capsule’s labels as their measurements arrive, at AX5', () => {
  const AX5 = 3.12;
  const labels = [180, 160, 170, 150].map((width) => width * AX5);
  const settled = capsuleLabelSize(AX5, 4, 660 * AX5, capsuleRoom(ROW_800, 92));

  it('has no size, and so no capsule, until each label, the row and its end are laid out, whichever comes last', () => {
    expect(fittedLabelSize(AX5, [labels[0], undefined, labels[2], labels[3]], ROW_800, 92)).toBe(
      undefined,
    );
    expect(fittedLabelSize(AX5, labels, 0, 92)).toBe(undefined);
    expect(fittedLabelSize(AX5, labels, ROW_800, undefined)).toBe(undefined);
    expect(fittedLabelSize(AX5, [], ROW_800, 92)).toBe(undefined);
  });

  it('is never drawn at its own size on the way to the usual one', () => {
    expect(settled).toBeLessThan(15 * AX5);
    expect(fittedLabelSize(AX5, labels, ROW_800, 92)).toBe(settled);
  });

  it('settles on the usual size after a cold launch’s transient row and an end drawn before Search', () => {
    expect(fittedLabelSize(AX5, labels, 1194 - 48, 40)).not.toBe(settled);
    expect(fittedLabelSize(AX5, labels, ROW_800, 92)).toBe(settled);
  });
});

describe('the pill beside the capsule', () => {
  it('is its tile while the labels are under their own size', () => {
    expect(pillGivesWay(2, 17)).toBe(true);
    expect(pillGivesWay(2, 30)).toBe(false);
    expect(pillGivesWay(1, 15)).toBe(false);
  });
});

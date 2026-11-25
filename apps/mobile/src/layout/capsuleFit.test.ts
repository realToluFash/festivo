import { describe, expect, it } from 'vitest';

import {
  capsuleChrome,
  capsuleWidth as laidOut,
  capsuleLabelSize,
  capsuleRoom,
  CAPSULE_HEIGHT,
  fittedLabelSize,
  LABEL_IN_BAND,
  openerRoom,
  pillGivesWay,
} from './capsuleFit.ts';
import { tokens } from '../theme/tokens.ts';

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

  it('grows its band only by what a taller label adds to its 46', () => {
    const capsule = (line: number) => Math.max(CAPSULE_HEIGHT, 2 * tokens.spaceXxs + line);
    const band = (line: number) => Math.max(tokens.sizeHit, line + 2 * LABEL_IN_BAND);

    for (const line of [18, 38, 53, 80])
      expect(band(line) - tokens.sizeHit).toBe(capsule(line) - CAPSULE_HEIGHT);
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

describe('the capsule’s width, upright (sc-91290)', () => {
  it('is its chrome and its labels at the fitted size, from their widths at their own', () => {
    expect(laidOut(2, [60, 80, 100, 120], 20)).toBe(capsuleWidth(4, 360, 30, 20));
  });

  it('is nothing before the labels are measured and fitted', () => {
    expect(laidOut(2, [60, undefined], 20)).toBe(0);
    expect(laidOut(2, [60, 80], undefined)).toBe(0);
  });
});

describe('the upright opener beside the capsule (sc-92188)', () => {
  it('stops short of the capsule centred in the row, inside the row’s margin', () => {
    expect(openerRoom(800, 400)).toBe(200 - tokens.space3xl - tokens.spaceSm);
  });

  it('has no limit before the row is laid out or the capsule is drawn', () => {
    expect(openerRoom(undefined, 400)).toBeUndefined();
    expect(openerRoom(800, 0)).toBeUndefined();
  });

  it('is never under nothing', () => {
    expect(openerRoom(400, 400)).toBe(0);
  });
});

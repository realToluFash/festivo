import { describe, expect, it } from 'vitest';

import { type RowMeasure, filterScale, keptWhole, rowDrawn, rowStarts } from './filterSizeRules.ts';
import { frameTitleCap } from '../frameTitleCap.ts';

const AX1 = filterScale('ax1', 1);
const AX5 = filterScale('ax5', 1);
const PHONE = 402;

const row = (over: Partial<RowMeasure>): RowMeasure => {
  const scale = over.scale ?? AX5;

  return {
    scale,
    cap: frameTitleCap(false, PHONE, scale),
    room: 220,
    gap: 12,
    title: 120,
    titleWidest: 120,
    valueWidestAt: () => 150,
    count: 1,
    besideAt: () => 200,
    underAt: () => 200,
    ...over,
  };
};

describe('rowStarts', () => {
  it('stops the title and the value at the Events title, both at 43 at AX5', () => {
    expect(rowStarts(AX5, frameTitleCap(false, PHONE, AX5))).toEqual({ title: 43, value: 43 });
  });

  it('leaves the words under the cap at the person’s size at AX1', () => {
    const starts = rowStarts(AX1, frameTitleCap(false, PHONE, AX1));

    expect(starts.title).toBeCloseTo(16 * AX1);
    expect(starts.value).toBeCloseTo(15 * AX1);
  });

  it('caps nothing at the standard sizes', () => {
    const seventh = filterScale('seventh', 1);
    const starts = rowStarts(seventh, frameTitleCap(false, PHONE, seventh));

    expect(starts.title).toBeCloseTo(16 * seventh);
    expect(starts.value).toBeCloseTo(15 * seventh);
  });
});

describe('rowDrawn at the standard sizes', () => {
  it('keeps main’s one line, its first pick allowed to end in "…"', () => {
    const drawn = rowDrawn(row({ scale: 1, title: 40, besideAt: () => 500 }));

    expect(drawn).toEqual({ stacked: false, shown: 1, titleSize: 16, valueSize: 15 });
  });

  it('stays on one line at the seventh step', () => {
    expect(rowDrawn(row({ scale: filterScale('seventh', 1), besideAt: () => 500 })).stacked).toBe(
      false,
    );
  });

  it('counts the picks beside the title by the line measured as its two texts', () => {
    const drawn = rowDrawn(
      row({
        scale: 1,
        title: 40,
        count: 2,
        besideAt: (shown) => (shown === 1 ? 169 : 300),
        underAt: () => 100,
      }),
    );

    expect(drawn.shown).toBe(1);
  });
});

describe('rowDrawn at the accessibility sizes', () => {
  it('keeps the row on one line while its value fits whole beside its title', () => {
    expect(rowDrawn(row({ besideAt: () => 80 }))).toMatchObject({
      stacked: false,
      shown: 1,
      titleSize: 43,
      valueSize: 43,
    });
  });

  it('puts a value that cannot fit beside its title on the line under it, at the cap', () => {
    const drawn = rowDrawn(row({ besideAt: () => 200 }));

    expect(drawn).toMatchObject({ stacked: true, titleSize: 43, valueSize: 43 });
  });

  it('stacks when the line under shows more whole picks than beside', () => {
    const widths = [0, 60, 150, 230];
    const at = (shown: number) => widths[shown] ?? 0;
    const drawn = rowDrawn(row({ count: 3, besideAt: at, underAt: at }));

    expect(drawn).toMatchObject({ stacked: true, shown: 2 });
  });

  it('shows the first pick alone, to wrap, when even it does not fit on one line', () => {
    const at = (shown: number) => (shown === 1 ? 420 : 380);
    const drawn = rowDrawn(row({ count: 2, besideAt: at, underAt: at }));

    expect(drawn).toMatchObject({ stacked: true, shown: 1 });
  });

  it('steps a word wider than the line down from the cap to the largest size it fits, never under 15', () => {
    expect(rowDrawn(row({ valueWidestAt: () => 440 })).valueSize).toBe(21);
    expect(rowDrawn(row({ valueWidestAt: () => 4000 })).valueSize).toBe(15);
  });

  it('steps down only for the picks the line shows, not for a hidden pick’s long word', () => {
    const at = (shown: number) => (shown === 1 ? 210 : 400);
    const drawn = rowDrawn(
      row({
        count: 2,
        besideAt: at,
        underAt: at,
        valueWidestAt: (shown) => (shown === 1 ? 150 : 600),
      }),
    );

    expect(drawn).toMatchObject({ stacked: true, shown: 1, valueSize: 43 });
  });

  it('steps a title word wider than the line down the same way, never under 16', () => {
    expect(rowDrawn(row({ title: 300, titleWidest: 4000 })).titleSize).toBe(16);
  });
});

describe('keptWhole', () => {
  it('keeps "+N more" on one line', () => {
    expect(keptWhole('+1 autre')).toBe('+1\u00a0autre');
  });
});

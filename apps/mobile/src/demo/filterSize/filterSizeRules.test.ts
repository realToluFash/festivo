import { describe, expect, it } from 'vitest';

import { type RowMeasure, filterScale, keptWhole, rowDrawn } from './filterSizeRules.ts';

const AX5 = filterScale('ax5', 1);

const row = (over: Partial<RowMeasure>): RowMeasure => ({
  scale: AX5,
  room: 220,
  gap: 12,
  title: 120,
  titleWidest: 120,
  valueWidest: 150,
  count: 1,
  widthAt: () => 200,
  ...over,
});

describe('rowDrawn at the standard sizes', () => {
  it('keeps main’s one line, its first pick allowed to end in "…"', () => {
    const drawn = rowDrawn(row({ scale: 1, title: 40, widthAt: () => 500 }));

    expect(drawn).toEqual({ stacked: false, shown: 1, titleSize: 16, valueSize: 15 });
  });

  it('stays on one line at the seventh step', () => {
    expect(rowDrawn(row({ scale: filterScale('seventh', 1), widthAt: () => 500 })).stacked).toBe(
      false,
    );
  });
});

describe('rowDrawn at the accessibility sizes', () => {
  it('keeps the row on one line while its value fits whole beside its title', () => {
    expect(rowDrawn(row({ widthAt: () => 80 }))).toMatchObject({ stacked: false, shown: 1 });
  });

  it('puts a value that cannot fit beside its title on the line under it, at its start', () => {
    const drawn = rowDrawn(row({ widthAt: () => 200 }));

    expect(drawn.stacked).toBe(true);
    expect(drawn.valueSize).toBeCloseTo(15 * AX5);
  });

  it('stacks when the line under shows more whole picks than beside', () => {
    const widths = [0, 60, 150, 230];
    const drawn = rowDrawn(row({ count: 3, widthAt: (shown) => widths[shown] ?? 0 }));

    expect(drawn).toMatchObject({ stacked: true, shown: 2 });
  });

  it('shows the first pick alone, to wrap, when even it does not fit on one line', () => {
    const drawn = rowDrawn(row({ count: 2, widthAt: (shown) => (shown === 1 ? 420 : 380) }));

    expect(drawn).toMatchObject({ stacked: true, shown: 1 });
  });

  it('steps a word wider than the line down to the largest size it fits, never under 15', () => {
    expect(rowDrawn(row({ valueWidest: 440 })).valueSize).toBe(26);
    expect(rowDrawn(row({ valueWidest: 4000 })).valueSize).toBe(15);
  });

  it('steps a title word wider than the line down the same way, never under 16', () => {
    expect(rowDrawn(row({ title: 300, titleWidest: 4000 })).titleSize).toBe(16);
  });
});

describe('keptWhole', () => {
  it('keeps "+N more" on one line', () => {
    expect(keptWhole('+1 autre')).toBe('+1\u00A0autre');
  });
});

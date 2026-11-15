import { describe, expect, it } from 'vitest';

import { labelFits } from './TitleFit.ts';

const row = { room: 400, title: 140, extra: 0, labelled: 170, gap: 16 };

describe('the primary beside a title', () => {
  it('keeps its label where the title and the label both fit', () => {
    expect(labelFits(row)).toBe(true);
  });

  it('gives way to the round plus where they do not', () => {
    expect(labelFits({ ...row, title: 230 })).toBe(false);
  });

  it('fits on exactly the width the row has', () => {
    expect(labelFits({ ...row, room: 140 + 16 + 170 })).toBe(true);
    expect(labelFits({ ...row, room: 140 + 16 + 170 - 1 })).toBe(false);
  });

  it('counts what stands beside the title, with its own gap', () => {
    expect(labelFits({ ...row, extra: 60, room: 402 })).toBe(true);
    expect(labelFits({ ...row, extra: 60, room: 401 })).toBe(false);
  });

  it('keeps the label until the row is measured', () => {
    expect(labelFits({ ...row, room: 0 })).toBe(true);
    expect(labelFits({ ...row, title: 0 })).toBe(true);
  });
});

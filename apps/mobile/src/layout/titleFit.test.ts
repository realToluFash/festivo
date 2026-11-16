import { describe, expect, it } from 'vitest';

import { labelFits, rowRoom } from './titleFit.ts';

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

describe('the row a title stands in', () => {
  const sides = { gap: 16, labelled: 170, round: 44 };

  it('adds back the labelled primary when that is what was drawn', () => {
    expect(rowRoom({ ...sides, slot: 214, drawn: 'labelled' })).toBe(400);
  });

  it('adds back the round primary when that is what was drawn', () => {
    expect(rowRoom({ ...sides, slot: 340, drawn: 'round' })).toBe(400);
  });

  it('is the same row whichever primary took its share, so a flip settles', () => {
    const labelled = rowRoom({ ...sides, slot: 400 - 16 - 170, drawn: 'labelled' });
    const round = rowRoom({ ...sides, slot: 400 - 16 - 44, drawn: 'round' });
    expect(labelled).toBe(round);
  });

  it('is unmeasured until the slot is', () => {
    expect(rowRoom({ ...sides, slot: 0, drawn: 'labelled' })).toBe(0);
  });
});

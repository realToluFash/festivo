import { describe, expect, it } from 'vitest';

import { eventBarLabelSize, eventBarStart } from './eventBarSize.ts';

describe('the event bar on a phone (sc-71148)', () => {
  it('draws at the default size where every word fits', () => {
    expect(eventBarLabelSize(1, 52, 70)).toBe(12);
  });

  it('steps every label down together until the widest word fits', () => {
    expect(eventBarLabelSize(1, 76, 70)).toBe(11);
  });

  it('steps below the default at the largest sizes, from a start capped at 20', () => {
    expect(eventBarStart(2)).toBe(20);
    expect(eventBarLabelSize(2, 127, 70)).toBe(11);
  });

  it('never draws under 10, so a word too wide even at 10 breaks there', () => {
    expect(eventBarLabelSize(1, 120, 70)).toBe(10);
    expect(eventBarLabelSize(2, 300, 70)).toBe(10);
  });

  it('keeps its start until the words and the tab are measured', () => {
    expect(eventBarLabelSize(1.3, 0, 70)).toBeCloseTo(15.6);
    expect(eventBarLabelSize(1.3, 90, 0)).toBeCloseTo(15.6);
  });
});

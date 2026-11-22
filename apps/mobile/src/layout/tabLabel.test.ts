import { describe, expect, it } from 'vitest';

import { EVENT_BAR_LEAST, TAB_LABEL, eventBarLabelSize, tabLabelStart } from './tabLabel.ts';

describe('the event bar on a phone (sc-71148)', () => {
  it('draws at the default size where every word fits, as on main', () => {
    expect(eventBarLabelSize(1, 52, 70)).toBe(TAB_LABEL);
  });

  it('steps every label down together until the widest word fits', () => {
    expect(eventBarLabelSize(1, 76, 70)).toBe(11);
  });

  it('starts from a size capped at 20 and steps below the default at the largest sizes', () => {
    expect(tabLabelStart(2)).toBe(20);
    expect(eventBarLabelSize(2, 127, 70)).toBe(11);
  });

  it('never draws under 10, so a word too wide even at 10 breaks there', () => {
    expect(eventBarLabelSize(1, 120, 70)).toBe(EVENT_BAR_LEAST);
    expect(eventBarLabelSize(2, 300, 70)).toBe(EVENT_BAR_LEAST);
  });

  it('keeps its start until the words and the tab are measured', () => {
    expect(eventBarLabelSize(1.3, 0, 70)).toBeCloseTo(15.6);
    expect(eventBarLabelSize(1.3, 90, 0)).toBeCloseTo(15.6);
  });
});

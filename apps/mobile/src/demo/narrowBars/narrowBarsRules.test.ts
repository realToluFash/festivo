import { describe, expect, it } from 'vitest';

import {
  barGeometry,
  eventLabelSize,
  staysWhole,
  tabWidth,
  todayLabelSize,
  widthOf,
} from './narrowBarsRules.ts';

// Instrument Sans SemiBold advance widths at 12, as sc-71148 and #99270 measured them.
const CONVIDADOS = 67.7;
const EVENEMENTS = 71.3;

describe('the phone bars under 360dp (sc-99214)', () => {
  it('keeps main’s geometry from 360 up', () => {
    expect(barGeometry(360)).toEqual({ side: 18, padSides: 5, padEnds: 5, gap: 2 });
    expect(tabWidth(360, 5)).toBeCloseTo(60.8);
  });

  it('sits 8 from each side with 3 padding and no gap under 360', () => {
    expect(barGeometry(359)).toEqual({ side: 8, padSides: 3, padEnds: 5, gap: 0 });
    expect(tabWidth(320, 5)).toBeCloseTo(59.2);
    expect(tabWidth(320, 4)).toBeCloseTo(74);
  });

  it('keeps Convidados whole at 10 on an event’s bar at 320, at 100 and 200 percent', () => {
    const slot = tabWidth(320, 5);

    expect(eventLabelSize(1, CONVIDADOS, slot)).toBe(10);
    expect(staysWhole(CONVIDADOS, 12, 10, slot)).toBe(true);
    expect(eventLabelSize(2, (CONVIDADOS * 20) / 12, slot)).toBe(10);
  });

  it('would still break Convidados at 10 on main’s geometry at 320', () => {
    expect(staysWhole(CONVIDADOS, 12, 10, (320 - 56) / 5)).toBe(false);
  });

  it('keeps Événements whole at 12 on Today’s bar at 320, at 100 and 200 percent', () => {
    const slot = tabWidth(320, 4);

    expect(todayLabelSize(1, EVENEMENTS, slot)).toBe(12);
    expect(todayLabelSize(2, (EVENEMENTS * 20) / 12, slot)).toBe(12);
    expect(staysWhole(EVENEMENTS, 12, 12, slot)).toBe(true);
  });

  it('never draws Today’s labels under 12, even where a word cannot fit', () => {
    expect(todayLabelSize(1, 200, 74)).toBe(12);
  });

  it('opens on 320 when the board names no width', () => {
    expect(widthOf(undefined)).toBe('narrow');
    expect(widthOf('main')).toBe('main');
  });
});

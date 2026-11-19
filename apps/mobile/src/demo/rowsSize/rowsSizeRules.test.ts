import { describe, expect, it } from 'vitest';

import {
  labelSize,
  labelStart,
  lineStart,
  rowType,
  rowsScale,
  settingsCap,
} from './rowsSizeRules.ts';

const AX5 = rowsScale('twelfth', 1);

describe('settingsCap', () => {
  it('caps the list at the page title’s 43 at the twelfth step, on a phone and a tablet', () => {
    expect(settingsCap(false, AX5)).toBe(43);
    expect(settingsCap(true, AX5)).toBe(43);
  });

  it('caps nothing a row draws at the default size', () => {
    expect(settingsCap(false, 1)).toBe(34);
  });
});

describe('labelStart', () => {
  it('grows a title to the cap and no further', () => {
    expect(labelStart(rowType(false).title, AX5, 43)).toBe(43);
  });

  it('keeps main’s size below the cap', () => {
    expect(labelStart(16, 1, 34)).toBe(16);
    expect(labelStart(16, 2.143, 43)).toBeCloseTo(34.29, 2);
  });
});

describe('labelSize', () => {
  it('keeps the start while the widest word fits', () => {
    expect(labelSize(16, 43, 200, 246)).toBe(43);
  });

  it('steps down to the largest size at which the widest word fits', () => {
    // Notifications measures about 300 at 43 in a 246 room.
    expect(labelSize(16, 43, 300, 246)).toBe(35);
  });

  it('never draws a label under its default size, so a word too wide even there breaks alone', () => {
    expect(labelSize(16, 43, 1400, 246)).toBe(16);
  });
});

describe('lineStart', () => {
  it('starts the line no larger than its title draws', () => {
    expect(lineStart(rowType(false).line, AX5, 43, 35)).toBe(35);
  });

  it('starts the line at the cap when its title draws at the cap', () => {
    expect(lineStart(13.5, AX5, 43, 43)).toBe(43);
  });

  it('keeps main’s line at the default size', () => {
    expect(lineStart(13.5, 1, 34, 16)).toBe(13.5);
  });
});

import { describe, expect, it } from 'vitest';

import { tokens } from '../theme/tokens.ts';
import { sheetPadding } from './sheet.ts';

const notched = { top: 59, bottom: 34, left: 0, right: 0 };
const sideways = { top: 0, bottom: 21, left: 59, right: 59 };

describe('a phone sheet', () => {
  it('stays below the status bar', () => {
    expect(sheetPadding({ phone: true, typing: false, insets: notched }).scrimTop).toBe(59);
  });

  it('pads its content above the home indicator while the keys are down', () => {
    expect(sheetPadding({ phone: true, typing: false, insets: notched }).frameBottom).toBe(34);
  });

  it('meets the keys with the keys up', () => {
    expect(sheetPadding({ phone: true, typing: true, insets: notched }).frameBottom).toBe(0);
  });

  it('keeps clear of the side insets on its side', () => {
    expect(sheetPadding({ phone: true, typing: false, insets: sideways })).toMatchObject({
      scrimLeft: 59,
      scrimRight: 59,
    });
  });
});

describe('a tablet card', () => {
  it('keeps the scrim padding where the insets are smaller', () => {
    expect(sheetPadding({ phone: false, typing: false, insets: notched })).toEqual({
      scrimTop: 59,
      scrimLeft: tokens.spaceXxl,
      scrimRight: tokens.spaceXxl,
      frameBottom: 0,
    });
  });
});

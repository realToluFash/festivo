import { describe, expect, it } from 'vitest';

import { tokens } from '../theme/tokens.ts';
import { sheetKeysCover, sheetPadding, sheetUnderKeys } from './sheet.ts';

const notched = { top: 59, bottom: 34, left: 0, right: 0 };
const sideways = { top: 0, bottom: 21, left: 59, right: 59 };
const keys = { keysUp: true, windowHeight: 800, keysTop: 509 };

describe('a sheet and the keys', () => {
  it('runs on under the keys on an Android phone', () => {
    expect(sheetUnderKeys('android', true)).toBe(true);
  });

  it('lifts with the avoiding view on an iPhone and on either tablet', () => {
    expect(sheetUnderKeys('ios', true)).toBe(false);
    expect(sheetUnderKeys('android', false)).toBe(false);
    expect(sheetUnderKeys('ios', false)).toBe(false);
  });

  it('pads an Android phone sheet by as much of its window as the keys cover', () => {
    expect(sheetKeysCover({ underKeys: sheetUnderKeys('android', true), ...keys })).toBe(291);
  });

  it('pads an iPhone sheet nothing for the keys, which the avoiding view clears', () => {
    expect(sheetKeysCover({ underKeys: sheetUnderKeys('ios', true), ...keys })).toBe(0);
  });

  it('pads nothing for keys that stop short of its window', () => {
    expect(sheetKeysCover({ underKeys: true, ...keys, keysTop: 801 })).toBe(0);
  });

  it('has no cover while the keys are down', () => {
    expect(sheetKeysCover({ underKeys: true, ...keys, keysUp: false })).toBeNull();
  });
});

describe('a phone sheet', () => {
  it('stays below the status bar', () => {
    expect(sheetPadding({ phone: true, keysCover: null, insets: notched }).scrimTop).toBe(59);
  });

  it('pads its content above the home indicator while the keys are down', () => {
    expect(sheetPadding({ phone: true, keysCover: null, insets: notched }).frameBottom).toBe(34);
  });

  it('pads its content above the keys with the keys up', () => {
    expect(sheetPadding({ phone: true, keysCover: 291, insets: notched }).frameBottom).toBe(291);
  });

  it('pads nothing at the foot when the avoiding view lifts it above the keys', () => {
    expect(sheetPadding({ phone: true, keysCover: 0, insets: notched }).frameBottom).toBe(0);
  });

  it('keeps clear of the side insets on its side', () => {
    expect(sheetPadding({ phone: true, keysCover: null, insets: sideways })).toMatchObject({
      scrimLeft: 59,
      scrimRight: 59,
    });
  });
});

describe('a tablet card', () => {
  it('keeps the scrim padding where the insets are smaller', () => {
    expect(sheetPadding({ phone: false, keysCover: null, insets: notched })).toEqual({
      scrimTop: 59,
      scrimLeft: tokens.spaceXxl,
      scrimRight: tokens.spaceXxl,
      frameBottom: 0,
    });
  });
});

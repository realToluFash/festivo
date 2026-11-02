import { describe, expect, it } from 'vitest';

import { tokens } from '../theme/tokens.ts';
import {
  sheetDragCloses,
  sheetDragSpeed,
  sheetDragStarts,
  sheetKeysCover,
  sheetPadding,
  sheetUnderKeys,
  sheetWindows,
} from './sheet.ts';

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

describe('one sheet window at a time', () => {
  it('lets the first sheet up at once', () => {
    expect(sheetWindows().waits('create')).toBe(false);
  });

  it('holds a sheet opened while the switcher’s window is still up, until it has gone', () => {
    const windows = sheetWindows();
    windows.raise('switcher');

    expect(windows.waits('create')).toBe(true);
    windows.lower('switcher');
    expect(windows.waits('create')).toBe(false);
  });

  it('never holds a sheet whose own window is up', () => {
    const windows = sheetWindows();
    windows.raise('create');
    windows.raise('switcher');

    expect(windows.waits('create')).toBe(false);
  });

  it('tells its listeners only when a window comes or goes', () => {
    const windows = sheetWindows();
    let heard = 0;
    windows.subscribe(() => (heard += 1));

    windows.raise('switcher');
    windows.raise('switcher');
    windows.lower('switcher');
    windows.lower('switcher');

    expect(heard).toBe(2);
  });
});

describe('dragging a sheet down', () => {
  it('starts only in the strip at its top, and only down or up', () => {
    expect(sheetDragStarts({ from: 10, dx: 0, dy: 20 })).toBe(true);
    expect(sheetDragStarts({ from: 44, dx: 2, dy: -20 })).toBe(true);
    expect(sheetDragStarts({ from: 45, dx: 0, dy: 20 })).toBe(false);
    expect(sheetDragStarts({ from: -10, dx: 0, dy: 20 })).toBe(false);
    expect(sheetDragStarts({ from: 10, dx: 30, dy: 20 })).toBe(false);
    expect(sheetDragStarts({ from: 10, dx: 0, dy: 4 })).toBe(false);
  });

  it('reads the speed over the last tenth of a second before the finger lifts', () => {
    const flick = [0, 20, 40, 60, 80].map((t) => ({ y: t, t }));
    expect(sheetDragSpeed(flick, { y: 100, t: 100 })).toBe(1);
    const slow = [
      { y: 0, t: 0 },
      { y: 90, t: 900 },
    ];
    expect(sheetDragSpeed(slow, { y: 100, t: 1000 })).toBe(0.1);
    const held = [
      { y: 0, t: 0 },
      { y: 60, t: 50 },
    ];
    expect(sheetDragSpeed(held, { y: 60, t: 1050 })).toBe(0);
    expect(sheetDragSpeed([], { y: 5, t: 0 })).toBe(0);
  });

  it('closes at half the height or on a 1,000 pt/s flick, and springs back short of both', () => {
    const sheet = { height: 400, keysCover: null, held: false };
    expect(sheetDragCloses({ ...sheet, dy: 200, vy: 0 })).toBe(true);
    expect(sheetDragCloses({ ...sheet, dy: 100, vy: 1 })).toBe(true);
    expect(sheetDragCloses({ ...sheet, dy: 100, vy: 0.1 })).toBe(false);
  });

  it('never closes a held sheet', () => {
    expect(sheetDragCloses({ dy: 400, vy: 3, height: 400, keysCover: null, held: true })).toBe(
      false,
    );
  });

  it('takes half of what the keys leave showing, not of the card under them', () => {
    const sheet = { height: 550, keysCover: 300, vy: 0, held: false };
    expect(sheetDragCloses({ ...sheet, dy: 125 })).toBe(true);
    expect(sheetDragCloses({ ...sheet, dy: 124 })).toBe(false);
  });
});

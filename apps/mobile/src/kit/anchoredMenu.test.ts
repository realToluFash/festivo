import { describe, expect, it } from 'vitest';

import { inModal, menuInModal, menuMost, menuSide } from './anchoredMenu.ts';
import { keyboardInWindow } from './keyboard.ts';

describe('menuInModal', () => {
  it('hangs 4 under its opener on Android, whose window starts below the status bar', () => {
    expect(menuInModal({ under: 120, below: 4, floor: null, origin: -24 })).toEqual({
      top: 148,
      floor: null,
    });
  });

  it('ends 8 above the keys, whose screenY is read into the window first', () => {
    const screenY = 500;
    const floor = keyboardInWindow(screenY, -24) - 8;

    expect(menuInModal({ under: 120, below: 4, floor, origin: -24 }).floor).toBe(screenY - 8);
  });

  it('sits where it sat on an iPhone, whose window and Modal share their top', () => {
    expect(menuInModal({ under: 120, below: 8, floor: 500, origin: 0 })).toEqual({
      top: 128,
      floor: 500,
    });
  });
});

describe('inModal', () => {
  it('moves a window y below the status bar into the Modal, and leaves an iPhone y as it is', () => {
    expect(inModal(38, -24)).toBe(62);
    expect(inModal(62, 0)).toBe(62);
  });
});

describe('menuMost', () => {
  it('ends above the gesture handle on a phone on its side, though that leaves less than a menu of three', () => {
    expect(menuMost({ top: 224, floor: null }, 360 - 24)).toBe(112);
  });

  it('ends at its floor when the keys give one', () => {
    expect(menuMost({ top: 128, floor: 500 }, 900)).toBe(372);
  });

  it('is nothing, never less, under a button at the foot', () => {
    expect(menuMost({ top: 340, floor: null }, 336)).toBe(0);
  });
});

describe('menuSide', () => {
  const sideways = { gap: 4, floor: null, origin: 0, ceiling: 0, foot: 360 - 24 };

  it('stays below when its whole height fits there', () => {
    expect(menuSide({ ...sideways, under: 100, over: 60, tall: 200 })).toEqual({
      top: 104,
      most: 232,
      above: false,
    });
  });

  it('opens above, its foot the gap over the button, when below is short and above is larger', () => {
    expect(menuSide({ ...sideways, under: 280, over: 240, tall: 200 })).toEqual({
      top: 36,
      most: 236,
      above: true,
    });
  });

  it('is capped at the room above, its top at the safe area, when its rows do not all fit', () => {
    expect(menuSide({ ...sideways, ceiling: 20, under: 280, over: 240, tall: 400 })).toEqual({
      top: 20,
      most: 216,
      above: true,
    });
  });

  it('stays below, capped, when the room above is no larger', () => {
    expect(menuSide({ ...sideways, foot: 344, under: 192, over: 152, tall: 400 })).toEqual({
      top: 196,
      most: 148,
      above: false,
    });
  });

  it('measures above from the Modal top on Android, not off by the status bar', () => {
    const android = menuSide({ ...sideways, origin: -24, under: 256, over: 216, tall: 200 });

    expect(android.top + 200).toBe(216 + 24 - 4);
  });

  it('keeps the side it took while open, though what it holds has changed', () => {
    expect(menuSide({ ...sideways, under: 280, over: 240, tall: 40, above: true }).above).toBe(
      true,
    );
  });

  it('goes below until it has measured itself', () => {
    expect(menuSide({ ...sideways, under: 280, over: 240, tall: null }).above).toBe(false);
  });
});

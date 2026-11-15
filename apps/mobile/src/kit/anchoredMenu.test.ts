import { describe, expect, it } from 'vitest';

import {
  inModal,
  keptSide,
  menuButton,
  menuInModal,
  menuMost,
  menuSide,
  menuTall,
  nextHeld,
  type HeldSide,
} from './anchoredMenu.ts';
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

describe('an open menu, render by render', () => {
  const upright = { gap: 4, floor: null, origin: 0, ceiling: 0, foot: 800 - 24 };
  const sideways = { ...upright, foot: 360 - 24 };

  function render(
    room: typeof upright,
    at: { x: number; top: number; y: number } | null,
    seen: { head: number; content: number },
    held: HeldSide | null,
  ) {
    const button = menuButton(at);
    const side = menuSide({
      ...room,
      under: at?.y ?? 0,
      over: at?.top ?? 0,
      tall: menuTall(seen, 1),
      above: keptSide(held, button),
    });

    return { side, held: nextHeld(held, button, side, seen.content > 0) };
  }

  it('counts its search field and its border, so rows that fit below with no head open above', () => {
    const at = { x: 300, top: 160, y: 200 };

    expect(render(sideways, at, { head: 0, content: 120 }, null).side.above).toBe(false);
    expect(render(sideways, at, { head: 48, content: 120 }, null).side.above).toBe(true);
    expect(menuTall({ head: 48, content: 120 }, 1)).toBe(170);
  });

  it('is capped at the room above, head and all, once it has gone there', () => {
    const at = { x: 300, top: 240, y: 280 };
    const { side } = render(sideways, at, { head: 48, content: 400 }, null);

    expect(side).toEqual({ top: 0, most: 236, above: true });
  });

  it('keeps above while open at its button, though a search leaves one row', () => {
    const at = { x: 300, top: 240, y: 280 };
    const first = render(sideways, at, { head: 48, content: 400 }, null);
    const searched = render(sideways, at, { head: 48, content: 40 }, first.held);

    expect(searched.side.above).toBe(true);
    expect(searched.held).toBe(first.held);
  });

  it('takes its side afresh when the phone turns upright under it, its button moved', () => {
    const first = render(sideways, { x: 300, top: 240, y: 280 }, { head: 48, content: 400 }, null);
    const turned = render(
      upright,
      { x: 140, top: 120, y: 160 },
      { head: 48, content: 400 },
      first.held,
    );

    expect(first.side.above).toBe(true);
    expect(turned.side).toEqual({ top: 164, most: 612, above: false });
    expect(turned.held).toEqual({ button: '140,120,160', above: false });
  });

  it('holds nothing until its rows are measured, and nothing once closed', () => {
    const at = { x: 300, top: 240, y: 280 };

    expect(render(sideways, at, { head: 48, content: 0 }, null).held).toBeNull();
    expect(
      render(sideways, null, { head: 48, content: 400 }, { button: '1,2,3', above: true }).held,
    ).toBeNull();
  });
});

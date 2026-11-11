import { describe, expect, it } from 'vitest';

import { inModal, menuInModal } from './anchoredMenu.ts';
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

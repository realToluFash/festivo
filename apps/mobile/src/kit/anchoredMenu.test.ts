import { describe, expect, it } from 'vitest';

import { menuInModal } from './anchoredMenu.ts';

describe('menuInModal', () => {
  it('hangs 4 under its opener on Android, whose window starts below the status bar', () => {
    expect(menuInModal({ under: 120, below: 4, floor: null, origin: -24 })).toEqual({
      top: 148,
      floor: null,
    });
  });

  it('keeps the floor above the keys in the same frame as the top', () => {
    expect(menuInModal({ under: 120, below: 4, floor: 500, origin: -24 }).floor).toBe(524);
  });

  it('sits where it sat on an iPhone, whose window and Modal share their top', () => {
    expect(menuInModal({ under: 120, below: 8, floor: 500, origin: 0 })).toEqual({
      top: 128,
      floor: 500,
    });
  });
});

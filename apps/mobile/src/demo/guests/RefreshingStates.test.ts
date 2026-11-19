import { describe, expect, it } from 'vitest';

import { titleRowOf, guestsStateOf, refreshingAt } from './GuestsModel.ts';
import { GUESTS_BOARDS } from './GuestsBoards.ts';

describe('Refreshing… held on screen (sc-71821)', () => {
  it('opens its two states with Refreshing… held on screen, English and Portuguese', () => {
    for (const state of ['refreshing', 'refreshingPt'] as const) {
      expect(guestsStateOf(state)).toBe(state);
      expect(refreshingAt(state)).toBe(true);
      expect(GUESTS_BOARDS.some((b) => b.href === `/demo/guests?state=${state}`)).toBe(true);
    }
    expect(titleRowOf('refreshing')).toEqual({ locale: 'en', export: true });
    expect(titleRowOf('refreshingPt')).toEqual({ locale: 'pt', export: true });
    expect(refreshingAt('inUse')).toBe(false);
    expect(refreshingAt('exportPt')).toBe(false);
    expect(refreshingAt(null)).toBe(false);
  });
});

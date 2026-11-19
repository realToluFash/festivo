import { describe, expect, it } from 'vitest';

import { titleRowOf, guestsStateOf, refreshingAt } from './GuestsModel.ts';
import { GUESTS_BOARDS } from './GuestsBoards.ts';
import { statusFits } from './RefreshingPlace.ts';

describe('Refreshing… gives way (sc-71821)', () => {
  it('stays beside the Back pill at the default size, where the pill, it and the bell fit', () => {
    expect(statusFits({ room: 318, lead: 110, ends: [], status: 99, gap: 10 })).toBe(true);
  });

  it('takes its own line at the twelfth step on a phone rather than shrink the Back pill', () => {
    expect(statusFits({ room: 318, lead: 259, ends: [], status: 238, gap: 10 })).toBe(false);
  });

  it('counts the title as drawn and every control, so on its side at the twelfth step it goes under them', () => {
    expect(statusFits({ room: 360, lead: 103, ends: [139, 44, 44], status: 191, gap: 10 })).toBe(
      false,
    );
  });

  it('stays on the title row upright at the ninth step, where the title keeps its size beside it', () => {
    expect(statusFits({ room: 770, lead: 141, ends: [142, 224], status: 184, gap: 10 })).toBe(true);
  });

  it('is exact at the edge: fitting to the point stays, one over goes under', () => {
    expect(statusFits({ room: 300, lead: 100, ends: [80], status: 100, gap: 10 })).toBe(true);
    expect(statusFits({ room: 299, lead: 100, ends: [80], status: 100, gap: 10 })).toBe(false);
  });

  it('takes its own line until every width is measured', () => {
    expect(statusFits({ room: 0, lead: 100, ends: [44], status: 90, gap: 10 })).toBe(false);
    expect(statusFits({ room: 800, lead: 0, ends: [44], status: 90, gap: 10 })).toBe(false);
    expect(statusFits({ room: 800, lead: 100, ends: [0], status: 90, gap: 10 })).toBe(false);
    expect(statusFits({ room: 800, lead: 100, ends: [44], status: 0, gap: 10 })).toBe(false);
  });

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

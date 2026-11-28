import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { titleRowOf, guestsStateOf, refreshingAt } from './GuestsModel.ts';
import { GUESTS_BOARDS } from './GuestsBoards.ts';

const frame = readFileSync(join('src', 'demo', 'events', 'EventFrame.tsx'), 'utf8');

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

describe('BackSlot draws Refreshing… out of the row’s flow (sc-74113)', () => {
  it('places the drawn status inside styles.atEnd', () => {
    expect(frame).toMatch(
      /\{fits && <View style=\{\[styles\.offBell, styles\.atEnd\]\}>\{capped\(beside\.node\)\}<\/View>\}/u,
    );
  });

  it('keeps styles.atEnd absolute, so a late-growing Back is never squeezed', () => {
    expect(frame).toMatch(/\n {2}atEnd: \{ position: 'absolute', top: 0, right: 0, bottom: 0,/u);
  });
});

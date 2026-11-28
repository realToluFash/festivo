import { describe, expect, it } from 'vitest';

import {
  TOP_ROW,
  bellStartOf,
  firstItemTop,
  fixedAbove,
  frameSides,
  listRoom,
} from './bellRules.ts';

describe('Notifications on a phone on its side, in the B frame (sc-62023)', () => {
  it('reads its state from the route', () => {
    expect(bellStartOf('shown', 'scrolled')).toEqual({ ask: true, at: 'scrolled' });
    expect(bellStartOf(undefined, 'nope')).toEqual({ ask: false, at: 'top' });
  });

  it('keeps only the status bar and the B top row above the list', () => {
    expect(TOP_ROW).toBe(48);
    expect(fixedAbove({ top: 24 })).toBe(72);
    expect(fixedAbove({ top: 0 })).toBe(48);
  });

  it('scrolls to the first item, past the push ask when it shows', () => {
    expect(firstItemTop({ y: 50, height: 700 }, 700)).toBe(50);
    expect(firstItemTop({ y: 50, height: 836 }, 700)).toBe(186);
  });

  it('gives the Android phone on its side at least half its height, with either navigation', () => {
    const threeButton = listRoom(360, fixedAbove({ top: 24 }), 0);
    const gesture = listRoom(360, fixedAbove({ top: 24 }), 24);

    expect(threeButton.least).toBe(180);
    expect(threeButton.list).toBe(288);
    expect(gesture.list).toBe(264);
    expect(gesture.list).toBeGreaterThanOrEqual(gesture.least);
  });

  it('gives the iPhone 17 Pro on its side at least half its height', () => {
    const room = listRoom(402, fixedAbove({ top: 0 }), 21);

    expect(room.least).toBe(201);
    expect(room.list).toBe(333);
    expect(room.list).toBeGreaterThanOrEqual(room.least);
  });

  it('moves the frame in past Android’s bar or the Dynamic Island, 20 from it', () => {
    expect(frameSides({ left: 48, right: 0 })).toEqual({ paddingLeft: 68, paddingRight: 20 });
    expect(frameSides({ left: 62, right: 62 })).toEqual({ paddingLeft: 82, paddingRight: 82 });
    expect(frameSides({ left: 0, right: 0 })).toEqual({ paddingLeft: 20, paddingRight: 20 });
  });
});

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  FADE_REACH,
  bellStartOf,
  fixedAboveOnSide,
  listRoom,
  listSides,
  topScrolls,
  topSides,
} from './bellRules.ts';

describe('Notifications on a phone on its side (sc-62023)', () => {
  it('reads its state from the route', () => {
    expect(bellStartOf('shown', 'scrolled')).toEqual({ ask: true, at: 'scrolled' });
    expect(bellStartOf(undefined, 'nope')).toEqual({ ask: false, at: 'top' });
  });

  it('scrolls its top away only on its side', () => {
    expect(topScrolls({ width: 640, height: 360 })).toBe(true);
    expect(topScrolls({ width: 360, height: 640 })).toBe(false);
  });

  it('gives the Android phone on its side at least half its height', () => {
    const room = listRoom(360, 24, 80);

    expect(room.list).toBe(256);
    expect(room.list).toBeGreaterThanOrEqual(room.least);
    expect(room.least).toBe(180);
    expect(room.clear).toBe(186);
  });

  it('gives the iPhone 17 Pro on its side at least half its height', () => {
    const room = listRoom(402, 0, 81);

    expect(room.list).toBe(321);
    expect(room.least).toBe(201);
    expect(room.list).toBeGreaterThanOrEqual(room.least);
  });

  it('keeps the top in line with upright on its side, past each bar once', () => {
    const bars = [
      { top: 24, left: 48, right: 0 },
      { top: 0, left: 62, right: 62 },
      { top: 24, left: 0, right: 0 },
    ];

    for (const insets of bars) {
      const inList = listSides(insets).paddingLeft + topSides(true, insets).paddingLeft;
      const inListRight = listSides(insets).paddingRight + topSides(true, insets).paddingRight;

      expect(inList).toBe(topSides(false, insets).paddingLeft);
      expect(inListRight).toBe(topSides(false, insets).paddingRight);
    }
    const navBar = { left: 48, right: 0 };

    expect(listSides(navBar).paddingLeft + topSides(true, navBar).paddingLeft).toBe(68);
  });

  it('keeps only the status strip above the list on its side', () => {
    expect(fixedAboveOnSide({ top: 24 })).toBe(24);
    expect(listRoom(360, fixedAboveOnSide({ top: 24 }), 80).list).toBe(256);
  });

  it('reaches as far up as the fade TodayCover draws', () => {
    const cover = readFileSync(join('src', 'components', 'TodayCover.tsx'), 'utf8');
    const fade = /\bfade:\s*\{[^}]*\bheight:\s*(\d+)/.exec(cover);

    expect(fade).not.toBeNull();
    expect(Number(fade?.[1])).toBe(FADE_REACH);
  });
});

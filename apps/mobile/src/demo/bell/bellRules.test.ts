import { describe, expect, it } from 'vitest';

import { bellStartOf, listRoom, topScrolls } from './bellRules.ts';

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
});

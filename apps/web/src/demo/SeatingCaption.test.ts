import { describe, expect, it } from 'vitest';

import { roomCaption } from './seatingText.ts';

const LONG = 'Grand Ballroom, Eko Hotel and Suites, Victoria Island, Lagos';
const seven = (text: string) => Array.from(text).length * 7;

describe("The room's caption stays inside the frame (sc-92246)", () => {
  it('starts at the left wall, or 12 px in from the frame when the wall is outside it', () => {
    // 320 CSS px: frame 16 to 304, Main hall drawn from 10 to 310, so its wall is at -6 in the frame.
    expect(roomCaption('Main hall', '24 m', '18 m', -6, 288, seven)).toEqual({
      x: 12,
      text: 'Main hall · 24 m × 18 m',
    });
    // 375 CSS px: frame 16 to 359, the wall at 32, as before.
    expect(roomCaption('Main hall', '24 m', '18 m', 16, 343, seven).x).toBe(16);
    // A 40 m room at 641 CSS px: frame 252 to 631, the wall at 191.5.
    expect(roomCaption('Main hall', '40 m', '18 m', -60.5, 379, seven).x).toBe(12);
    // Zoomed and panned at 1280: the wall 4 px in is left of 12, 30 px in is right of it.
    expect(roomCaption('Main hall', '24 m', '18 m', 4, 700, seven).x).toBe(12);
    expect(roomCaption('Main hall', '24 m', '18 m', 30, 700, seven).x).toBe(30);
  });

  it('shortens only the name, with "…", to end 12 px in from the right, and keeps the size whole', () => {
    for (const [ox, frame] of [
      [-6, 288],
      [16, 343],
    ] as const) {
      const { x, text } = roomCaption(LONG, '24 m', '18 m', ox, frame, seven);

      expect(text.endsWith('… · 24 m × 18 m')).toBe(true);
      expect(LONG.startsWith(text.slice(0, text.indexOf('…')))).toBe(true);
      expect(x + seven(text)).toBeLessThanOrEqual(frame - 12);
      expect(x + seven(text)).toBeGreaterThan(frame - 12 - 14);
    }
  });

  it('never shortens a caption that fits, nor a size with no name', () => {
    expect(roomCaption(LONG, '24 m', '18 m', 40, 1000, seven).text).toBe(`${LONG} · 24 m × 18 m`);
    expect(roomCaption('', '24 m', '18 m', -6, 288, seven).text).toBe('24 m × 18 m');
    expect(roomCaption('  ', '24 m', '18 m', -6, 40, seven).text).toBe('24 m × 18 m');
  });
});

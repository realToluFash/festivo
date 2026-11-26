import { describe, expect, it } from 'vitest';

import { type CaptionWords, roomCaption } from './seatingCaption.ts';

const LONG = 'Grand Ballroom, Eko Hotel and Suites, Victoria Island, Lagos';
const seven = (text: string) => Array.from(text).length * 7;
const words: CaptionWords = {
  line: (name) => (name == null ? '24 m × 18 m' : `${name} · 24 m × 18 m`),
  cut: (name) => `${name}…`,
};

describe("The room's caption stays inside the frame (sc-92246)", () => {
  it('starts at the left wall, or 12 px in from the frame when the wall is further left', () => {
    expect(roomCaption('Main hall', words, -6, 288, seven)).toEqual({
      x: 12,
      text: 'Main hall · 24 m × 18 m',
    });
    expect(roomCaption('Main hall', words, 16, 343, seven).x).toBe(16);
    expect(roomCaption('Main hall', words, -106, 288, seven).x).toBe(12);
    expect(roomCaption('Main hall', words, -60.5, 379, seven).x).toBe(12);
    expect(roomCaption('Main hall', words, 4, 1000, seven).x).toBe(12);
    expect(roomCaption('Main hall', words, 30, 1000, seven).x).toBe(30);
  });

  it('shortens only the name, with "…", to end 12 px in from the right, and keeps the size whole', () => {
    for (const [ox, frame] of [
      [-6, 288],
      [16, 343],
    ] as const) {
      const { x, text } = roomCaption(LONG, words, ox, frame, seven);

      expect(text.endsWith('… · 24 m × 18 m')).toBe(true);
      expect(text).not.toContain(' … ·');
      expect(LONG.startsWith(text.slice(0, text.indexOf('…')))).toBe(true);
      expect(x + seven(text)).toBeLessThanOrEqual(frame - 12);
      expect(x + seven(text)).toBeGreaterThan(frame - 12 - 14);
    }
  });

  it('keeps the size whole when not even the name’s first character fits', () => {
    expect(roomCaption(LONG, words, 12, 100, seven).text).toBe('… · 24 m × 18 m');
  });

  it('never shortens a caption that fits, nor a size with no name', () => {
    expect(roomCaption(LONG, words, 40, 1000, seven).text).toBe(`${LONG} · 24 m × 18 m`);
    expect(roomCaption(null, words, -6, 288, seven).text).toBe('24 m × 18 m');
    expect(roomCaption('  ', words, -6, 40, seven).text).toBe('24 m × 18 m');
  });
});

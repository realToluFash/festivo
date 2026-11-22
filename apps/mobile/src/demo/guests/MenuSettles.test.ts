import { describe, expect, it } from 'vitest';

import { hasSettled } from './MenuSettles.ts';

const at = (x: number, y: number, width: number) => ({ x, y: y + 44, width, top: y });

describe('a demo state that opens its menu by itself', () => {
  it('waits while the Filter button is not laid out yet, which measures as nothing at the top left', () => {
    expect(hasSettled(at(0, 0, 0), at(0, 0, 0))).toBe(false);
  });

  it('waits on the first measure, and while the screen is still sliding in', () => {
    expect(hasSettled(null, at(280, 212, 96))).toBe(false);
    expect(hasSettled(at(280, 412, 96), at(280, 212, 96))).toBe(false);
  });

  it('opens once two measures in a row agree, under the button', () => {
    expect(hasSettled(at(280, 212, 96), at(280, 212, 96))).toBe(true);
  });
});

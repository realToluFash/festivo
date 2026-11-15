import { describe, expect, it } from 'vitest';

import { leastUsedColour } from './seatingSections.ts';

describe('seating sections', () => {
  it('picks the colour fewest sections wear, the first on a tie', () => {
    expect(leastUsedColour(['blue', 'plum', 'teal'], ['blue', 'plum'])).toBe('teal');
    expect(leastUsedColour(['blue', 'plum', 'teal'], ['blue', 'teal'])).toBe('plum');
    expect(leastUsedColour(['blue', 'plum'], [])).toBe('blue');
  });
});

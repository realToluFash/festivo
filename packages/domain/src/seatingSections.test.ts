import { describe, expect, it } from 'vitest';

import { leastUsedColour, sectionHoldingName } from './seatingSections.ts';

describe('seating sections', () => {
  it('names the section that holds a name, leaving out the one being renamed', () => {
    const sections = [
      { id: 'a', name: 'Terrace' },
      { id: 'b', name: 'Stage' },
    ];

    expect(sectionHoldingName(sections, 'TÉRRACE', null)?.name).toBe('Terrace');
    expect(sectionHoldingName(sections, 'terrace', 'a')).toBeNull();
  });

  it('picks the colour fewest sections wear, the first on a tie', () => {
    expect(leastUsedColour(['blue', 'plum', 'teal'], ['blue', 'plum'])).toBe('teal');
    expect(leastUsedColour(['blue', 'plum', 'teal'], ['blue', 'teal'])).toBe('plum');
    expect(leastUsedColour(['blue', 'plum'], [])).toBe('blue');
  });
});

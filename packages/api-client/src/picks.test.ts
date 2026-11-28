import { describe, expect, it } from 'vitest';

import { asEventPicks } from './picks.ts';

const row = (allergens: unknown) => ({
  id: 'r1',
  kind: 'dish',
  name: 'Puff-puff',
  allergens,
  chosen: 1,
  defaulted: 0,
});

const rowsOf = (allergens: unknown) =>
  asEventPicks({ room: 4, courses: [{ id: 'c1', name: 'Dessert', rows: [row(allergens)] }] })
    ?.courses[0]?.rows[0]?.allergens;

describe('asEventPicks', () => {
  it('keeps allergens never stated apart from none of the 14', () => {
    expect(rowsOf(null)).toBeNull();
    expect(rowsOf([])).toEqual([]);
    expect(rowsOf(['gluten', 'eggs'])).toEqual(['gluten', 'eggs']);
  });
});

import { describe, expect, it } from 'vitest';

import { titleGoesUnder } from './deskNavForm.ts';

describe('titleGoesUnder', () => {
  it('keeps one row while every word fits whole in two lines', () => {
    expect(titleGoesUnder([60, 20, 70], 5, 100)).toBe(false);
  });

  it('puts the title under when a word is wider than its room', () => {
    expect(titleGoesUnder([140], 5, 44)).toBe(true);
  });

  it('puts the title under when it would take three lines', () => {
    expect(titleGoesUnder([60, 60, 60], 5, 100)).toBe(true);
  });

  it('keeps an empty title on the row', () => {
    expect(titleGoesUnder([], 5, 0)).toBe(false);
  });
});

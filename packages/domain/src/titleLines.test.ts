import { describe, expect, it } from 'vitest';

import { titleFitsBeside, titleLines } from './titleLines.ts';

describe('titleLines', () => {
  it('fills each line with whole words', () => {
    expect(titleLines([60, 20, 70], 5, 100)).toBe(2);
    expect(titleLines([60, 60, 60], 5, 100)).toBe(3);
  });

  it('breaks only at spaces', () => {
    const words = [68.3, 14.3, 33.6, 20.4, 47.3].map((width) => width * 3.12);
    expect(titleLines(words, 3.2 * 3.12, 362)).toBe(2);
  });

  it('gives a word wider than the room a line of its own', () => {
    expect(titleLines([500], 10, 362)).toBe(1);
  });
});

describe('titleFitsBeside', () => {
  it('holds while every word fits whole in two lines', () => {
    expect(titleFitsBeside([60, 20, 70], 5, 100)).toBe(true);
  });

  it('fails when a word is wider than the slot', () => {
    expect(titleFitsBeside([140], 5, 44)).toBe(false);
  });

  it('fails when the title would take three lines', () => {
    expect(titleFitsBeside([60, 60, 60], 5, 100)).toBe(false);
  });

  it('holds to one line when asked', () => {
    expect(titleFitsBeside([60, 20, 70], 5, 100, 1)).toBe(false);
    expect(titleFitsBeside([60, 20], 5, 100, 1)).toBe(true);
  });

  it('holds for an empty title', () => {
    expect(titleFitsBeside([], 5, 0)).toBe(true);
  });
});

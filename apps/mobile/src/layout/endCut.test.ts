import { describe, expect, it } from 'vitest';

import { endCuts, endCutWidth } from './endCut.ts';

const charWidth = (text: string) => Array.from(text).length * 10;

describe('endCuts', () => {
  it('cuts after every character but the last', () => {
    expect(endCuts('Ann')).toEqual(['…', 'A…', 'An…']);
  });

  it('never splits a character in two', () => {
    expect(endCuts('a😀b')).toEqual(['…', 'a…', 'a😀…']);
  });
});

describe('endCutWidth', () => {
  it('is the whole width when the text fits', () => {
    expect(endCutWidth('Adaeze Obi', 120, charWidth)).toBe(100);
  });

  it('is the longest cut that fits, cut inside a word', () => {
    expect(endCutWidth('Anniversaire de mariage', 125, charWidth)).toBe(120);
  });

  it('waits for every width it needs', () => {
    expect(endCutWidth('Ann', 20, (text) => (text === 'Ann' ? 30 : undefined))).toBeNull();
    expect(endCutWidth('Ann', 20, () => undefined)).toBeNull();
  });
});

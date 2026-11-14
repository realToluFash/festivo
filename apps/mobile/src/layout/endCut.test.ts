import { describe, expect, it } from 'vitest';

import { endCut, endCuts } from './endCut.ts';

const charWidth = (text: string) => Array.from(text).length * 10;

describe('endCuts', () => {
  it('cuts after every character but the last', () => {
    expect(endCuts('Ann')).toEqual(['…', 'A…', 'An…']);
  });

  it('never splits a character in two', () => {
    expect(endCuts('a😀b')).toEqual(['…', 'a…', 'a😀…']);
  });
});

describe('endCut', () => {
  it('is the whole text when it fits', () => {
    expect(endCut('Adaeze Obi', 120, charWidth)).toBe('Adaeze Obi');
  });

  it('is the longest cut that fits, cut inside a word', () => {
    expect(endCut('Anniversaire de mariage', 125, charWidth)).toBe('Anniversair…');
  });

  it('is the ellipsis alone when no letter fits', () => {
    expect(endCut('Ann', 5, charWidth)).toBe('…');
  });

  it('waits for every width it needs', () => {
    expect(endCut('Ann', 20, (text) => (text === 'Ann' ? 30 : undefined))).toBeNull();
    expect(endCut('Ann', 20, () => undefined)).toBeNull();
  });
});

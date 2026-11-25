import { describe, expect, it } from 'vitest';

import { HEAD, linkUnder, piecesOfLine, wordsSize, wordsStart } from './todaySizeRules.ts';

const AX1 = 1.786;
const AX5 = 3.571;
const SEVENTH = 1.353;

describe('the greeting’s pieces', () => {
  it('keeps the comma on the word before it', () => {
    expect(piecesOfLine('Bonjour, QA')).toEqual(['Bonjour,', 'QA']);
  });

  it('splits a name only after its own hyphen', () => {
    expect(piecesOfLine('Bonsoir, Maximiliano-Bartholomew')).toEqual([
      'Bonsoir,',
      'Maximiliano-',
      'Bartholomew',
    ]);
  });
});

describe('a heading’s size', () => {
  it('is main’s below AX1, whatever its room', () => {
    expect(wordsSize(HEAD, SEVENTH, Infinity, 500, 100)).toBe(HEAD * SEVENTH);
  });

  it('starts no larger than the greeting from AX1', () => {
    expect(wordsStart(HEAD, AX5, 60)).toBeCloseTo(60);
  });

  it('keeps its start while its widest word fits', () => {
    expect(wordsSize(HEAD, AX5, Infinity, 200, 316)).toBe(HEAD * AX5);
  });

  it('steps down to the largest size its widest word fits', () => {
    expect(wordsSize(HEAD, AX5, Infinity, 400, 200)).toBe(Math.floor((HEAD * AX5 * 200) / 400));
  });

  it('never steps below its default size', () => {
    expect(wordsSize(HEAD, AX5, Infinity, 2000, 100)).toBe(HEAD);
  });
});

describe('a heading’s link', () => {
  it('sits beside the heading at the standard sizes and under it from AX1', () => {
    expect(linkUnder(SEVENTH)).toBe(false);
    expect(linkUnder(AX1)).toBe(true);
  });
});

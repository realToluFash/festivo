import { describe, expect, it } from 'vitest';

import { SIGN_OUT_TEXT_COLUMN, signOutRoom, signOutTextSize } from './signOutSizeRules.ts';

// The iPhone 17 Pro's page is 402 less 20 to each side.
const ROOM = 362;

describe('signOutTextSize', () => {
  it('keeps the label at 16 at the default size', () => {
    expect(signOutTextSize(1, 40, ROOM)).toBe(16);
  });

  it('keeps Sign at its full size at the twelfth step', () => {
    expect(signOutTextSize(3.12, 100, ROOM)).toBeCloseTo(49.92, 2);
  });

  it('steps déconnecter down until it fits beside the glyph at the twelfth step', () => {
    expect(signOutTextSize(3.12, 290, ROOM)).toBe(44);
  });

  it('never draws the label under the default size', () => {
    expect(signOutTextSize(3.12, 2000, ROOM)).toBe(16);
  });
});

describe('signOutRoom', () => {
  it('gives the phone its page less 20 to each side', () => {
    expect(signOutRoom('phone', 402)).toBe(ROOM);
  });

  it('gives an upright iPad the left of main’s two columns', () => {
    expect(signOutRoom('portrait', 820)).toBe(366);
  });

  it('gives an iPad on its side main’s list column', () => {
    expect(signOutRoom('landscape', 1180)).toBe(329);
  });

  it('keeps the label at 15 in that column at the default size', () => {
    expect(signOutTextSize(1, 30, signOutRoom('landscape', 1180), SIGN_OUT_TEXT_COLUMN)).toBe(15);
  });
});

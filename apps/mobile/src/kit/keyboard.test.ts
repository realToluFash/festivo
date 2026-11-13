import { describe, expect, it } from 'vitest';

import { bottomOverKeys, focusWaitsForArrival } from './keyboard.ts';

describe('bottomOverKeys', () => {
  it('rests where it was asked to while the keys are down', () => {
    expect(bottomOverKeys(120, 800, null, 16)).toBe(120);
  });

  it('rides the gap above keys that rise past its rest', () => {
    expect(bottomOverKeys(120, 800, 500, 16)).toBe(316);
  });

  it('stays at its rest over keys too low to reach it', () => {
    expect(bottomOverKeys(120, 800, 760, 16)).toBe(120);
  });
});

describe('focusWaitsForArrival', () => {
  it('holds the opening field until the screen has slid in on Android', () => {
    expect(focusWaitsForArrival('android')).toBe(true);
  });

  it('leaves autoFocus to raise the keys with the slide on iOS', () => {
    expect(focusWaitsForArrival('ios')).toBe(false);
  });
});

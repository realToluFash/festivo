import { describe, expect, it } from 'vitest';

import { bottomOverKeys, focusWaitsForArrival, offsetShowingFoot } from './keyboard.ts';

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

describe('offsetShowingFoot', () => {
  const sight = { offset: 0, shown: 300, margin: 16 };

  it('brings a field that fits wholly into sight, as offsetIntoView', () => {
    expect(offsetShowingFoot({ ...sight, contentY: 400, height: 120 })).toBe(236);
    expect(offsetShowingFoot({ ...sight, contentY: 100, height: 120 })).toBeNull();
  });

  it('shows the foot of a field taller than the sight, where its error comes', () => {
    expect(offsetShowingFoot({ ...sight, contentY: 400, height: 340 })).toBe(456);
  });

  it('leaves a tall field whose foot is already in sight where it is', () => {
    expect(offsetShowingFoot({ ...sight, offset: 300, contentY: 200, height: 340 })).toBeNull();
  });
});

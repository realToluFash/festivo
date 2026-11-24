import { describe, expect, it } from 'vitest';

import { sideWidths } from './sideWidths.ts';

describe("the sidebar's word widths", () => {
  it('gives a sidebar drawn anew the width another sidebar read, so a turn fits words as a launch does', () => {
    const widths = sideWidths();
    widths.keep(45, 'semibold', 'Today', 131.5);

    expect(widths.width(45, 'semibold', 'Today')).toBe(131.5);
  });

  it('keeps a width under its size and its weight alone', () => {
    const widths = sideWidths();
    widths.keep(45, 'semibold', 'Calendar', 210);

    expect(widths.width(45, 'medium', 'Calendar')).toBeUndefined();
    expect(widths.width(36, 'semibold', 'Calendar')).toBeUndefined();
  });

  it('never takes a word laid out at no width for its width', () => {
    const widths = sideWidths();

    expect(widths.keep(45, 'medium', 'Search', 0)).toBe(false);
    expect(widths.width(45, 'medium', 'Search')).toBeUndefined();
  });

  it('takes a new reading over an old one, and says when nothing changed', () => {
    const widths = sideWidths();
    widths.keep(45, 'medium', 'Paramètres', 250);

    expect(widths.keep(45, 'medium', 'Paramètres', 250)).toBe(false);
    expect(widths.keep(45, 'medium', 'Paramètres', 262)).toBe(true);
    expect(widths.width(45, 'medium', 'Paramètres')).toBe(262);
  });
});

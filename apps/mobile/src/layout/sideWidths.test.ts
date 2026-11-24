import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { sideReadings, sideWidths } from './sideWidths.ts';

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

  it('never takes a word laid out at no width for its width, and tells no sidebar of it', () => {
    const widths = sideWidths();
    let told = 0;
    widths.subscribe(() => (told += 1));
    widths.keep(45, 'medium', 'Search', 0);

    expect(widths.width(45, 'medium', 'Search')).toBeUndefined();
    expect(told).toBe(0);
  });

  it('takes a new reading over an old one, and tells the sidebars only when it changed', () => {
    const widths = sideWidths();
    let told = 0;
    widths.subscribe(() => (told += 1));
    widths.keep(45, 'medium', 'Paramètres', 250);
    widths.keep(45, 'medium', 'Paramètres', 250);
    widths.keep(45, 'medium', 'Paramètres', 262);

    expect(told).toBe(2);
    expect(widths.width(45, 'medium', 'Paramètres')).toBe(262);
  });

  it('fits two sidebars measuring the same word in one turn, whichever reads it first', () => {
    const widths = sideWidths();
    let first = 0;
    let second = 0;
    widths.subscribe(() => (first += 1));
    widths.subscribe(() => (second += 1));

    expect(sideReadings(widths, 'Calendar', 45, 'medium', 'label').read).toBeNull();

    widths.keep(45, 'medium', 'Calendar', 210);
    widths.keep(45, 'medium', '\nCalendar', 210);
    widths.keep(45, 'medium', 'Calendar', 210);
    widths.keep(45, 'medium', '\nCalendar', 210);

    expect([first, second]).toEqual([2, 2]);
    expect(sideReadings(widths, 'Calendar', 45, 'medium', 'label').read).toEqual({
      words: [{ width: 210, letters: 8 }],
      whole: { width: 210, letters: 8 },
    });
  });

  it('waits for every piece of a name over two lines before it fits', () => {
    const widths = sideWidths();
    widths.keep(45, 'semibold', '\nAda Lovelace', 300);
    widths.keep(45, 'semibold', 'Ada', 80);

    expect(sideReadings(widths, 'Ada Lovelace', 45, 'semibold', 'lines').read).toBeNull();
  });

  it('is what every sidebar reads and redraws on, not a copy of its own', () => {
    const hook = readFileSync(new URL('../components/sideFit.tsx', import.meta.url), 'utf8');

    expect(hook).toMatch(/useSyncExternalStore\(SIDE_WIDTHS\.subscribe, SIDE_WIDTHS\.version\)/u);
    expect(hook).toMatch(/sideReadings\(SIDE_WIDTHS,/u);
    expect(hook).not.toMatch(/useState/u);
  });
});

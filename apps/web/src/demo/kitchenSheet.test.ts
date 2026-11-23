import { describe, expect, it } from 'vitest';

import { KSW, sheetAt, sheetOf, sheetStart, worldOf } from './kitchenSheet.ts';
import { courseFigures, menuFigures, shownCourses } from './seePicks.ts';

const roomOf = (rows: readonly { kind: string; count: number }[]) =>
  rows
    .filter((row) => row.kind !== 'variant' && row.kind !== 'side')
    .reduce((n, row) => n + row.count, 0);

describe('sc-3911’s kitchen sheet, from See picks’ figures', () => {
  it.each(['open', 'closed', 'noAllergies'] as const)(
    'counts each dish and variant as See picks does, %s',
    (state) => {
      const world = worldOf(state);
      const sheet = sheetOf(world);
      const picks = menuFigures(world);

      for (const course of sheet.courses)
        for (const row of course.rows)
          if (row.kind === 'dish' || row.kind === 'variant')
            expect(row.count, row.name).toBe(picks.get(row.id)?.count);
    },
  );

  it.each(['open', 'closed'] as const)('adds each course up to the room, %s', (state) => {
    const sheet = sheetOf(worldOf(state));

    for (const course of sheet.courses) expect(roomOf(course.rows)).toBe(course.room);
    expect(sheet.coming).toBe(48);
  });

  it('lists the people with allergies by name, each course in order', () => {
    const world = worldOf('open');
    const sheet = sheetOf(world);
    const names = sheet.allergic.map((one) => one.name);

    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'en')));
    expect(names).toContain('Kwame Asante');
    expect(sheet.allergic.find((one) => one.name === 'Kwame Asante')?.allergens).toBe(
      'Peanuts, Celery',
    );
    for (const person of sheet.allergic)
      expect(person.cells).toHaveLength(shownCourses(world).length);
  });

  it('says not chosen yet before the close, and never given the default after it', () => {
    const before = sheetOf(worldOf('open')).courses.flatMap((one) => one.rows);
    const after = sheetOf(worldOf('closed'));

    expect(before.some((row) => row.kind === 'none' && row.name.endsWith('not chosen yet'))).toBe(
      true,
    );
    const main = after.courses.find((one) => one.course.id === 'k2');
    expect(main?.rows.find((row) => row.kind === 'none')?.name).toMatch(
      /never given the default$/u,
    );
    expect(main?.given).toMatch(
      /given the default, .*, when picks closed\. They are in its count\.$/u,
    );
    expect(after.allergic.some((one) => one.cells.some((cell) => cell.kind === 'never'))).toBe(
      true,
    );
  });

  it('counts the never given as See picks does after the close', () => {
    const world = worldOf('closed');
    const sheet = sheetOf(world);

    for (const course of shownCourses(world)) {
      const none = sheet.courses
        .find((one) => one.course.id === course.id)
        ?.rows.find((row) => row.kind === 'none');
      expect(none?.count ?? 0).toBe(courseFigures(world, course).none);
    }
  });

  it('has no allergies to list when none are recorded', () => {
    const sheet = sheetOf(worldOf('noAllergies'));

    expect(sheet.allergic).toEqual([]);
    expect(sheet.allergyCounts).toEqual([]);
  });

  it('reads its state, access and paper from the link', () => {
    const start = sheetStart(
      new URL(`https://x${sheetAt('closed', 'counts', 'letter')}`).searchParams,
    );

    expect(start).toEqual({ state: 'closed', access: 'counts', paper: 'letter' });
    expect(sheetStart(new URLSearchParams('state=nope'))).toEqual({
      state: 'open',
      access: 'manage',
      paper: null,
    });
    expect(KSW.namesNeed).toBe('Names need Guests manage.');
  });
});

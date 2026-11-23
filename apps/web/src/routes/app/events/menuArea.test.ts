import type { MenuCourse, MenuDish } from '@soirely/api-client';
import { describe, expect, it } from 'vitest';

import {
  canAddCourse,
  canSame,
  closeDay,
  closeTime,
  courseProblems,
  coursePicked,
  firstCourseProblem,
  menuClose,
  menuCounts,
  moveTarget,
  servedTime,
  zoneCity,
} from './menuArea.ts';

const dish = (id: string, picked = false): MenuDish => ({
  id,
  name: id,
  description: null,
  allergens: [],
  diets: [],
  libraryDishId: null,
  variants: [],
  choices: [],
  offered: true,
  items: [],
  picked,
});

const course = (id: string, dishes: MenuDish[] = []): MenuCourse => ({
  id,
  name: id,
  servedAt: null,
  answer: 'choose',
  skippable: false,
  dishes,
  ownItems: [],
  items: [],
  picksClose: null,
  default: null,
});

describe('the course form', () => {
  it('refuses a blank name, a name over 60 and a time that is not 24-hour', () => {
    expect(courseProblems({ name: '  ', servedAt: '' })).toEqual({ name: 'blank', servedAt: null });
    expect(courseProblems({ name: 'a'.repeat(61), servedAt: '11pm' })).toEqual({
      name: 'long',
      servedAt: 'wrong',
    });
    expect(courseProblems({ name: 'a'.repeat(60), servedAt: '23:59' })).toEqual({
      name: null,
      servedAt: null,
    });
  });

  it('puts focus on the first field refused', () => {
    expect(firstCourseProblem({ name: null, servedAt: 'wrong' })).toBe('mc-served');
    expect(firstCourseProblem({ name: 'blank', servedAt: 'wrong' })).toBe('mc-name');
  });

  it('keeps a served time as the API does', () => {
    expect(servedTime('8:05')).toBe('08:05');
    expect(servedTime('')).toBeNull();
  });
});

describe('the menu', () => {
  it('counts its courses, its dishes and the courses ready', () => {
    expect(menuCounts([course('a', [dish('x'), dish('y')]), course('b')])).toEqual({
      courses: 2,
      dishes: 2,
      ready: 1,
    });
  });

  it('stops at ten courses', () => {
    const nine = Array.from({ length: 9 }, (_, n) => course(`c${n}`));

    expect(canAddCourse(nine)).toBe(true);
    expect(canAddCourse([...nine, course('ten')])).toBe(false);
  });

  it('offers Everyone gets the same only with exactly one dish', () => {
    expect(canSame(course('a', [dish('x')]))).toBe(true);
    expect(canSame(course('a', [dish('x'), dish('y')]))).toBe(false);
    expect(canSame(course('a'))).toBe(false);
  });

  it('knows a course guests have picked from', () => {
    expect(coursePicked(course('a', [dish('x'), dish('y', true)]))).toBe(true);
    expect(coursePicked(course('a', [dish('x')]))).toBe(false);
  });

  it('counts an answer to a choice as a pick of its course', () => {
    const asked: MenuDish = {
      ...dish('x'),
      choices: [
        {
          id: 'side',
          question: 'And a side?',
          pick: 1,
          required: false,
          draft: false,
          noneAnswers: 1,
          options: [],
        },
      ],
    };

    expect(coursePicked(course('a', [asked]))).toBe(true);
  });

  it('moves nowhere past either end', () => {
    expect(moveTarget(0, -1, 3)).toBeNull();
    expect(moveTarget(2, 3, 3)).toBeNull();
    expect(moveTarget(1, 0, 3)).toBe(0);
  });

  it('names the zone by its city', () => {
    expect(zoneCity('Africa/Lagos')).toBe('Lagos');
    expect(zoneCity('America/Argentina/Buenos_Aires')).toBe('Buenos Aires');
  });

  it('writes the close day in the event’s zone as each locale writes it', () => {
    const at = '2026-10-19T23:59:59+01:00';

    expect(closeDay(at, 'Africa/Lagos', 'en-US')).toBe('Monday, Oct 19');
    expect(closeDay(at, 'Africa/Lagos', 'fr-FR')).toBe('lundi 19 oct.');
    expect(closeDay(at, 'Africa/Lagos', 'es-ES')).toBe('lunes, 19 oct');
    expect(closeDay(at, 'Africa/Lagos', 'pt-BR')).toBe('segunda-feira, 19 de out.');
    expect(closeTime(at, 'Africa/Lagos', 'en-US')).toBe('23:59');
    expect(closeTime('2026-11-14T16:00:00+01:00', 'Africa/Lagos', 'en-US')).toBe('16:00');
  });

  it('heads the Menu with the earliest close still open, or the last once all have closed', () => {
    const closing = (at: string, closed: boolean): MenuCourse => ({
      ...course(at),
      picksClose: { at, source: 'replyBy', closed },
    });

    expect(menuClose([course('a')])).toBeNull();
    expect(
      menuClose([
        closing('2026-10-19T23:59:59+01:00', false),
        course('b'),
        closing('2026-10-16T23:59:59+01:00', false),
      ])?.at,
    ).toBe('2026-10-16T23:59:59+01:00');
    expect(
      menuClose([
        closing('2026-10-19T23:59:59+01:00', true),
        closing('2026-10-16T23:59:59+01:00', true),
      ]),
    ).toEqual({ at: '2026-10-19T23:59:59+01:00', source: 'replyBy', closed: true });
  });
});

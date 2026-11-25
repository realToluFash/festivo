import { describe, expect, it } from 'vitest';

import {
  COURSE_MAX,
  CW,
  type EvCourse,
  addedAllergenLine,
  canAddCourse,
  checkCourse,
  copyOf,
  courseLine,
  coursesStart,
  headerLines,
  moveCourse,
  sampleCourses,
  servedTime,
  tastingCourses,
  withDishes,
} from './menuCourses.ts';
import { libraryJollof } from './dishVariants.ts';
import { type DishAllergen, type LibDish, SAMPLE_DISHES } from './menuLibrary.ts';

const main = (): EvCourse => sampleCourses()[1] as EvCourse;
const moiMoi = (): LibDish => ({
  ...(SAMPLE_DISHES.find((one) => one.id === 'd-moimoi') as LibDish),
});

describe('a course’s fields (sc-3902)', () => {
  it('needs a name of at most 60 characters', () => {
    expect(checkCourse({ name: ' ', servedAt: '' }).name).toBe(CW.courseBlank);
    expect(checkCourse({ name: 'x'.repeat(60), servedAt: '' }).name).toBeNull();
    expect(checkCourse({ name: 'x'.repeat(61), servedAt: '' }).name).toBe(CW.courseLong);
  });

  it('takes an optional 24-hour served time', () => {
    expect(checkCourse({ name: 'Main', servedAt: '' }).servedAt).toBeNull();
    expect(checkCourse({ name: 'Main', servedAt: '20:30' }).servedAt).toBeNull();
    expect(checkCourse({ name: 'Main', servedAt: '24:00' }).servedAt).toBe(CW.timeWrong);
    expect(checkCourse({ name: 'Main', servedAt: '8pm' }).servedAt).toBe(CW.timeWrong);
    expect(servedTime('9:05')).toBe('09:05');
    expect(servedTime('')).toBeNull();
  });

  it('refuses an 11th course', () => {
    const ten = tastingCourses();
    expect(ten).toHaveLength(COURSE_MAX);
    expect(canAddCourse(ten)).toBe(false);
    expect(canAddCourse(ten.slice(1))).toBe(true);
  });
});

describe('the header and each course’s line', () => {
  it('counts courses and dishes, and the ready ones only while a course is empty', () => {
    expect(headerLines(sampleCourses())).toEqual({
      counts: '4 courses · 6 dishes',
      ready: '3 of 4 courses ready',
    });
    expect(headerLines(sampleCourses().slice(0, 3)).ready).toBeNull();
    expect(headerLines(tastingCourses()).ready).toBe('8 of 10 courses ready');
    expect(headerLines([main()]).counts).toBe('1 course · 3 dishes');
  });

  it('leaves served out when a course has no time', () => {
    expect(courseLine(1, 3, '20:00')).toBe('Course 2 of 3 · served 20:00');
    expect(courseLine(3, 4, null)).toBe('Course 4 of 4');
  });
});

describe('reordering', () => {
  it('moves a course and says where it went', () => {
    const moved = moveCourse(sampleCourses(), 1, 0);
    expect(moved?.courses.map((one) => one.name)).toEqual([
      'Main',
      'Starter',
      'Dessert',
      'Late-night bites',
    ]);
    expect(moved?.said).toBe('Main moved to course 1 of 4.');
    expect(moveCourse(sampleCourses(), 3, 0)?.courses[0]?.name).toBe('Late-night bites');
    expect(moveCourse(sampleCourses(), 0, -1)).toBeNull();
  });
});

describe('Everyone gets the same', () => {
  it('goes back to Guests choose with a second dish, and says so', () => {
    const starter = sampleCourses()[0] as EvCourse;
    const moi = copyOf(moiMoi());
    const result = withDishes(starter, [...starter.dishes, moi]);

    expect(result.course.answer).toBe('choose');
    expect(result.said).toBe('Starter has 2 dishes now, so guests choose.');
    expect(withDishes(main(), main().dishes.slice(0, 1)).said).toBeNull();
  });
});

describe('the event’s copy of a library dish', () => {
  it('is its own: editing the library afterwards changes nothing here', () => {
    const contains: DishAllergen[] = ['eggs'];
    const library: LibDish = { ...moiMoi(), contains };
    const copy = copyOf(library);
    contains.push('milk');
    library.name = 'Moi moi with pepper';

    expect(copy.contains).toEqual(['eggs']);
    expect(copy.name).toBe('Moi moi');
    expect(copy.libraryId).toBe('d-moimoi');
  });

  it('gives each copy its own variant ids, so two courses never share one', () => {
    const jollof: LibDish = { ...moiMoi(), variants: libraryJollof('EUR') };
    const ids = (dish: { variants?: readonly { id: string }[] }) =>
      (dish.variants ?? []).map((one) => one.id);
    const main = ids(copyOf(jollof));
    const late = ids(copyOf(jollof));

    expect(main).toHaveLength(3);
    expect(main.filter((id) => late.includes(id))).toEqual([]);
  });
});

describe('an allergen added to a picked dish (pm, 31 Oct)', () => {
  const picked = {
    name: 'Jollof rice',
    pickers: [['milk'], ['milk', 'eggs'], ['other'], [], ['sesame']] as const,
  };

  it('counts each person once and names only the added allergens they have', () => {
    expect(addedAllergenLine(picked, ['celery'], ['celery', 'milk', 'eggs'])).toBe(
      '2 guests who picked Jollof rice have Eggs and Milk recorded, and nobody has told them.',
    );
    expect(addedAllergenLine(picked, ['celery'], ['celery', 'sesame', 'mustard'])).toBe(
      '1 guest who picked Jollof rice has Sesame recorded, and nobody has told them.',
    );
  });

  it('adds no line with nobody counted, for Other, or when an allergen comes off', () => {
    expect(addedAllergenLine(picked, ['celery'], ['celery', 'lupin'])).toBeNull();
    expect(addedAllergenLine({ ...picked, pickers: [['other']] }, [], ['milk'])).toBeNull();
    expect(addedAllergenLine(picked, ['celery', 'milk'], ['celery'])).toBeNull();
    expect(addedAllergenLine(picked, ['milk'], 'none')).toBeNull();
    expect(addedAllergenLine({ ...picked, pickers: [] }, [], ['milk'])).toBeNull();
  });

  it('counts a not-stated dish’s every allergen as added', () => {
    expect(addedAllergenLine(picked, null, ['milk'])).toMatch(/^2 guests/u);
  });
});

describe('the states', () => {
  it('the saved state carries the line the rule gives', () => {
    expect(coursesStart('editDishAllergenSaved').saidMore).toBe(
      '4 guests who picked Jollof rice have Sesame recorded, and nobody has told them.',
    );
  });
});

import type { MealCourse, MealDish } from './mealStep.ts';
import { type Close, type PicksDates, SAMPLE_PICKS, closeOf } from './picksClose.ts';

/** sc-3905 on the guest's meal step (board MealStep, page e32): a row per course with its close, Change while it is open, and a send refused per course. */
export type CourseId = 'starter' | 'main' | 'dessert';

export type Saved = Readonly<Record<CourseId, string | null>>;

export interface SummaryCourse {
  id: CourseId;
  course: MealCourse;
}

export const MSW = {
  forName: (name: string) => `For ${name}`,
  title: '[Your meal picks]',
  notChosen: '[Not chosen yet]',
  notSent: '[Not sent yet]',
  change: 'Change',
  changeAria: (course: string, name: string) =>
    `Change ${course.toLocaleLowerCase('en')} for ${name}`,
  send: '[Send my changes]',
  nothingToSend: '[Nothing has changed, so there is nothing to send.]',
  saved: '[Your changes are saved.]',
  otherSaved: '[Your other changes are saved.]',
  askHosts: '[To change a pick now, ask Amara and Tomi.]',
  refused: (course: string, date: string) =>
    `Picks for ${course} closed on ${date}, so your change was not saved.`,
  yourCourse: (course: string) => `[Your ${course.toLocaleLowerCase('en')}]`,
} as const;

const dish = (
  id: string,
  name: string,
  desc: string,
  contains: MealDish['contains'],
): MealDish => ({
  id,
  name,
  desc,
  contains,
  ways: [],
  choices: [],
});

export const SUMMARY_COURSES: readonly SummaryCourse[] = [
  {
    id: 'starter',
    course: {
      name: 'Starter',
      set: false,
      skip: false,
      dishes: [
        dish('canape', 'Canapé selection', 'Small bites of puff-puff, suya and plantain.', [
          'gluten',
          'peanuts',
        ]),
        dish('pepper', 'Pepper soup', 'Goat meat in a light, spiced broth.', 'none'),
      ],
    },
  },
  {
    id: 'main',
    course: {
      name: 'Main',
      set: false,
      skip: false,
      dishes: [
        dish(
          'jollof',
          'Jollof rice',
          'Long-grain rice cooked in a tomato and pepper base.',
          'none',
        ),
        dish('croaker', 'Grilled croaker', 'Whole croaker grilled with pepper and onion.', [
          'fish',
        ]),
      ],
    },
  },
  {
    id: 'dessert',
    course: {
      name: 'Dessert',
      set: false,
      skip: true,
      dishes: [
        dish('chinchin', 'Chin chin', 'Crunchy fried dough with nutmeg.', [
          'gluten',
          'eggs',
          'milk',
        ]),
        dish('fruit', 'Fruit salad', 'Pineapple, pawpaw and watermelon.', 'none'),
      ],
    },
  },
];

export const courseOf = (id: CourseId): SummaryCourse =>
  SUMMARY_COURSES.find((one) => one.id === id) as SummaryCourse;

export function pickName(id: CourseId, dishId: string | null): string | null {
  return courseOf(id).course.dishes.find((one) => one.id === dishId)?.name ?? null;
}

export const summaryClose = (id: CourseId, dates: PicksDates): Close => closeOf(id, dates);

export interface SendResult {
  saved: Saved;
  refused: CourseId[];
  savedOther: boolean;
}

/** The API's answer to a send that arrives on `on`: a 409 for each changed course closed by then, which saves nothing for it; every open course's change is saved. */
export function sendPicks(
  saved: Saved,
  changed: Partial<Saved>,
  dates: PicksDates,
  on: string,
): SendResult {
  const at = { ...dates, today: on };
  const ids = SUMMARY_COURSES.map((one) => one.id).filter((id) => Object.hasOwn(changed, id));
  const refused = ids.filter((id) => closeOf(id, at).closed);
  const kept = ids.filter((id) => !refused.includes(id));
  const next = { ...saved };
  for (const id of kept) next[id] = changed[id] ?? null;

  return { saved: next, refused, savedOther: kept.length > 0 };
}

/** The guest's sample: Starter on its own choose-by date, Friday, Oct 16 (sc-1362's, sample only); Main and Dessert on the reply-by date, Monday, Oct 19. */
export const GUEST_PICKS: PicksDates = { ...SAMPLE_PICKS, own: { starter: '2026-10-16' } };

export interface SummaryStart {
  today: string;
  saved: Saved;
  /** Changes made on the page and not sent yet. */
  changed: Partial<Saved>;
  /** The day the send arrives at the API, when it is later than the page was opened. */
  sendOn: string | null;
  screen: CourseId | null;
}

export const EARLIER: Saved = { starter: 'canape', main: 'jollof', dessert: 'chinchin' };

import {
  type MenuCourse,
  type PicksClose,
  MENU_COURSE_MAXIMUM,
  MENU_COURSE_NAME_MAXIMUM,
} from '@soirely/api-client';
import { courseReady, dishPicked, visibleLength } from '@soirely/domain';

/** The event's Menu page (sc-3902): what it checks before sending, and what it counts. */

export interface CourseForm {
  name: string;
  servedAt: string;
}

export interface CourseProblems {
  name: 'blank' | 'long' | null;
  servedAt: 'wrong' | null;
}

const TIME = /^([01]?\d|2[0-3]):([0-5]\d)$/u;

export const courseLength = (text: string): number => visibleLength(text.trim());

export function courseProblems(form: CourseForm): CourseProblems {
  const length = courseLength(form.name);
  const time = form.servedAt.trim();

  return {
    name: length === 0 ? 'blank' : length > MENU_COURSE_NAME_MAXIMUM ? 'long' : null,
    servedAt: time === '' || TIME.test(time) ? null : 'wrong',
  };
}

export function firstCourseProblem(problems: CourseProblems): string | null {
  if (problems.name != null) return 'mc-name';
  if (problems.servedAt != null) return 'mc-served';

  return null;
}

/** "8:05" as the API keeps it, "08:05"; blank is no time. */
export function servedTime(typed: string): string | null {
  const found = TIME.exec(typed.trim());
  if (found == null) return null;

  return `${(found[1] ?? '').padStart(2, '0')}:${found[2] ?? ''}`;
}

export const canAddCourse = (courses: readonly MenuCourse[]): boolean =>
  courses.length < MENU_COURSE_MAXIMUM;

export const isReady = (course: MenuCourse): boolean => courseReady(course);

export const coursePicked = (course: MenuCourse): boolean => course.dishes.some(dishPicked);

export const canSame = (course: MenuCourse): boolean => course.dishes.length === 1;

export function menuCounts(courses: readonly MenuCourse[]): {
  courses: number;
  dishes: number;
  ready: number;
} {
  return {
    courses: courses.length,
    dishes: courses.reduce((sum, one) => sum + one.dishes.length, 0),
    ready: courses.filter(isReady).length,
  };
}

/** The place in the order a drop or a Move button asks for, or null when it would not move. */
export function moveTarget(at: number, to: number, all: number): number | null {
  if (to === at || to < 0 || to >= all) return null;

  return to;
}

/** "Lagos" for Africa/Lagos: the city the event's zone is named for. */
export function zoneCity(timeZone: string): string {
  return (timeZone.split('/').pop() ?? timeZone).replaceAll('_', ' ');
}

export function onCourse(course: MenuCourse, libraryDishId: string): boolean {
  return course.dishes.some((dish) => dish.libraryDishId === libraryDishId);
}

/** "Monday, Oct 19", "lundi 19 oct.": the day a course's picks close, in the event's zone, as the reader's locale writes it (sc-3905). */
export function closeDay(at: string, timeZone: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    timeZone,
  }).format(new Date(at));
}

/** "23:59" for a Reply by, the event's start time for its start, on the 24-hour clock in the event's zone. */
export function closeTime(at: string, timeZone: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  }).format(new Date(at));
}

/** The Menu header's close: the earliest of the courses still open, or the last once all have closed; null while no course asks guests anything. */
export function menuClose(courses: readonly MenuCourse[]): PicksClose | null {
  const closes = courses
    .flatMap((course) => (course.picksClose == null ? [] : [course.picksClose]))
    .sort((one, other) => Date.parse(one.at) - Date.parse(other.at));
  const open = closes.filter((close) => !close.closed);

  return open[0] ?? closes.at(-1) ?? null;
}

import type {
  DishAllergen,
  EventMenu,
  PicksClose,
  PicksWaiting,
  EventPicks,
  MenuCourse,
  MenuDish,
  PicksCourse,
  PicksRoomPerson,
} from '@soirely/api-client';

export const shareOf = (n: number, room: number): number =>
  room === 0 ? 0 : Math.floor((n * 100) / room);

export function against(
  plate: readonly string[] | null,
  allergens: readonly string[],
): DishAllergen[] {
  return (
    plate == null ? allergens : allergens.filter((code) => plate.includes(code))
  ) as DishAllergen[];
}

export function plateOf(
  dish: MenuDish,
  variantId: string | null,
  optionIds: readonly string[],
): string[] | null {
  const variant = dish.variants.find((one) => one.id === variantId);
  const base = dish.variants.length > 0 ? (variant?.allergens ?? []) : dish.allergens;
  if (base == null) return null;
  const options = dish.choices
    .flatMap((choice) => choice.options)
    .filter((option) => optionIds.includes(option.id))
    .flatMap((option) => option.allergens);

  return [...new Set([...base, ...options])];
}

export function dishRuledOut(dish: MenuDish, person: PicksRoomPerson): DishAllergen[] {
  if (dish.variants.length === 0) return against(plateOf(dish, null, []), person.allergens);
  const each = dish.variants
    .filter((variant) => variant.for === 'everyone')
    .map((variant) => against(variant.allergens, person.allergens));

  return each.length > 0 && each.every((one) => one.length > 0) ? [...new Set(each.flat())] : [];
}

export function mealPickName(
  dish: MenuDish,
  variantId: string | null,
  optionIds: readonly string[],
) {
  const variant = dish.variants.find((one) => one.id === variantId);
  const options = dish.choices
    .flatMap((choice) => choice.options)
    .filter((option) => optionIds.includes(option.id))
    .map((option) => option.name);

  return [dish.name, variant?.name, ...options].filter(Boolean).join(', ');
}

export const menuCourseOf = (menu: EventMenu, courseId: string): MenuCourse | undefined =>
  menu.courses.find((one) => one.id === courseId);

export const picksCourseOf = (picks: EventPicks, courseId: string): PicksCourse | undefined =>
  picks.courses.find((one) => one.id === courseId);

export function sumOf(course: PicksCourse): number {
  return (
    course.rows
      .filter((row) => row.kind === 'dish')
      .reduce((sum, row) => sum + row.chosen + row.defaulted, 0) +
    course.kitchen +
    course.skipped +
    course.needsHost +
    course.notChosen
  );
}

/** Who is in Needs the host for a course: those the host must choose for, and those a menu change flagged for an added allergen. */
export const courseHostCount = (course: PicksCourse): number =>
  course.needsHost + course.menuChangedAllergen;

export const hostCount = (picks: EventPicks): number =>
  picks.courses.reduce((sum, course) => sum + courseHostCount(course), 0);

export const clockOf = (at: string): string => at.slice(11, 16);

/** A course default's words, "Jollof rice, Chicken": the dish, its variant and its options, from the menu. */
export function defaultPick(
  menu: EventMenu,
  given: { course: string; dish: string; variant: string | null; options: readonly string[] },
): string {
  const dish = menuCourseOf(menu, given.course)?.dishes.find((one) => one.id === given.dish);

  return dish == null ? '' : mealPickName(dish, given.variant, given.options);
}

/** Why a person is never given a default: an allergy, an Other diet, or a named diet the default doesn't meet. */
export const excludedOf = (reason: string): 'allergy' | 'other' | 'diet' =>
  reason === 'allergy' ? 'allergy' : reason === 'other' ? 'other' : 'diet';

/** The Menu header's close (sc-3905): the earliest of the courses still open, or the last once all have closed; null while no course asks guests anything. */
export function menuClose(
  courses: readonly { picksClose: PicksClose | null }[],
): PicksClose | null {
  const closes = courses
    .flatMap((course) => (course.picksClose == null ? [] : [course.picksClose]))
    .sort((one, other) => Date.parse(one.at) - Date.parse(other.at));
  const open = closes.filter((close) => !close.closed);

  return open[0] ?? closes.at(-1) ?? null;
}

/** The open courses close on different days (sc-1362): the header reads "picks close from {date}". */
export function menuCloseFrom(courses: readonly { picksClose: PicksClose | null }[]): boolean {
  const open = courses.flatMap((course) =>
    course.picksClose == null || course.picksClose.closed ? [] : [course.picksClose.at],
  );

  return new Set(open).size > 1;
}

export type WaitingPerson = PicksWaiting['people'][number];

/** Who hasn't picked, split as sc-1362 shows it: the people never given a default first, apart from the parties, then each party's others. */
export function waitingSplit(waiting: readonly PicksWaiting[]): {
  never: WaitingPerson[];
  parties: PicksWaiting[];
} {
  return {
    never: waiting.flatMap((party) => party.people.filter((one) => one.excluded.length > 0)),
    parties: waiting
      .map((party) => ({
        ...party,
        people: party.people.filter((one) => one.excluded.length === 0),
      }))
      .filter((party) => party.people.length > 0),
  };
}

/** How many on a course were given its default: the defaulted figures of its dish rows. */
export const defaultedOn = (course: PicksCourse): number =>
  course.rows.filter((row) => row.kind === 'dish').reduce((sum, row) => sum + row.defaulted, 0);

/** A course shows the Defaulted column once it has a default, or anyone defaulted on it. */
export const showsDefaulted = (course: PicksCourse): boolean =>
  course.default != null || course.rows.some((row) => row.defaulted > 0);

/** Where a person unticked on Choose who gets it goes (sc-3909): the course's Everyone variant on a course that asks nothing, Needs the host when that rules them out too, else not chosen. */
export function goesBackTo(
  course: Pick<PicksCourse, 'asksNothing'>,
  dish: MenuDish | undefined,
  person: Pick<PicksRoomPerson, 'allergens'>,
): { kind: 'notChosen' } | { kind: 'needsHost' } | { kind: 'dish'; name: string } {
  if (!course.asksNothing || dish == null) return { kind: 'notChosen' };
  const everyone = dish.variants.find((one) => one.for === 'everyone');
  const plate = everyone == null ? dish.allergens : everyone.allergens;
  if (against(plate, person.allergens).length > 0) return { kind: 'needsHost' };

  return { kind: 'dish', name: everyone?.name ?? dish.name };
}

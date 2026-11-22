import type {
  DishAllergen,
  EventMenu,
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

export function pickName(dish: MenuDish, variantId: string | null, optionIds: readonly string[]) {
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

export const hostCount = (picks: EventPicks): number =>
  picks.courses.reduce((sum, course) => sum + course.needsHost, 0);

export const clockOf = (at: string): string => at.slice(11, 16);

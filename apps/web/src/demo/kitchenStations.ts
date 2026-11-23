import type { ChoiceOption } from './dishChoices.ts';
import { variantsOf } from './dishVariants.ts';
import type { EvCourse, EvDish } from './menuCourses.ts';
import { type PicksWorld, type Spot, spotOf } from './seePicks.ts';

/** sc-34244's By station under each course of sc-3911's sheet, on the tray model: each item counted on the plates that hold it, under the station that serves it, in the walking order. */
export type SheetItem =
  { kind: 'fixed'; name: string } | { kind: 'variant' } | { kind: 'choice'; choiceId: string };

export interface Place {
  id: string;
  name: string;
}

export interface ItemsMenu {
  /** A dish's Items (sc-34230), by dish id; a dish not here has none and is one item by its name. */
  items: Readonly<Record<string, readonly SheetItem[]>>;
  own: Readonly<Record<string, readonly string[]>>;
  /** Served from (sc-3910), by `courseId|item`; an item not here is served from the Pass. */
  servedFrom: Readonly<Record<string, string>>;
  places: readonly Place[];
  walk: readonly string[];
}

export interface StationLine {
  name: string;
  count: number;
  chefs: boolean;
}

export interface StationBlock {
  place: Place;
  lines: readonly StationLine[];
}

export const PASS = 'pass';

const key = (name: string): string => name.trim().toLowerCase();

export const servedKey = (courseId: string, item: string): string => `${courseId}|${key(item)}`;

const optionsOf = (dish: EvDish, choiceId: string): readonly ChoiceOption[] =>
  (dish.choices ?? []).find((one) => one.id === choiceId)?.options ?? [];

export function courseItems(menu: ItemsMenu, course: EvCourse): string[] {
  const names = course.dishes.flatMap((dish) => {
    const items = menu.items[dish.id] ?? [];
    if (items.length === 0) return [dish.name];

    return items.flatMap((item) => {
      if (item.kind === 'fixed') return [item.name];
      if (item.kind === 'variant') return variantsOf(dish).map((one) => one.name);

      return optionsOf(dish, item.choiceId).map((one) => one.name);
    });
  });
  const seen = new Set<string>();

  return [...names, ...(menu.own[course.id] ?? [])].flatMap((name) => {
    if (seen.has(key(name))) return [];
    seen.add(key(name));

    return [name.trim()];
  });
}

type Plate = { chefs: boolean; names: readonly string[] };

/** What one guest's tray holds on a course (sc-4005's order rules); null for a guest who skipped it. */
function plateOf(menu: ItemsMenu, course: EvCourse, spot: Spot): Plate | null {
  const own = menu.own[course.id] ?? [];
  if (spot.kind === 'skipped') return null;
  if (spot.kind !== 'dish') return { chefs: true, names: own };

  const dish = course.dishes.find((one) => one.id === spot.dishId) as EvDish;
  const items = menu.items[dish.id] ?? [];
  if (items.length === 0) return { chefs: false, names: [dish.name, ...own] };

  let chefs = false;
  const names = items.flatMap((item) => {
    if (item.kind === 'fixed') return [item.name];
    if (item.kind === 'variant')
      return variantsOf(dish)
        .filter((one) => one.id === spot.variantId)
        .map((one) => one.name);

    const choice = (dish.choices ?? []).find((one) => one.id === item.choiceId);
    const picked = (choice?.options ?? []).filter((one) => spot.optionIds.includes(one.id));
    if (picked.length === 0 && choice?.required === true) chefs = true;

    return picked.map((one) => one.name);
  });

  return { chefs, names: [...names, ...own] };
}

export function hasByStation(menu: ItemsMenu, course: EvCourse): boolean {
  return (
    course.dishes.some((dish) => (menu.items[dish.id] ?? []).length > 0) ||
    (menu.own[course.id] ?? []).length > 0 ||
    courseItems(menu, course).some((name) => servedFrom(menu, course.id, name) !== PASS)
  );
}

export function servedFrom(menu: ItemsMenu, courseId: string, item: string): string {
  return menu.servedFrom[servedKey(courseId, item)] ?? PASS;
}

export function byStation(
  menu: ItemsMenu,
  world: PicksWorld,
  course: EvCourse,
): StationBlock[] | null {
  if (!hasByStation(menu, course)) return null;

  const plates = world.people
    .map((person) => plateOf(menu, course, spotOf(world, course, person)))
    .filter((plate): plate is Plate => plate != null);
  const countOf = (name: string): number =>
    plates.filter((plate) => plate.names.some((one) => key(one) === key(name))).length;
  const chefs = plates.filter((plate) => plate.chefs).length;
  const items = courseItems(menu, course);

  return [PASS, ...menu.walk].flatMap((placeId): StationBlock[] => {
    const place = menu.places.find((one) => one.id === placeId);
    const lines: StationLine[] = items
      .filter((name) => servedFrom(menu, course.id, name) === placeId)
      .map((name) => ({ name, count: countOf(name), chefs: false }));
    if (placeId === PASS && chefs > 0) lines.push({ name: '', count: chefs, chefs: true });

    return place == null || lines.length === 0 ? [] : [{ place, lines }];
  });
}

const fixed = (name: string): SheetItem => ({ kind: 'fixed', name });

const PLACES: readonly Place[] = [
  { id: PASS, name: 'Pass' },
  { id: 'kitchen', name: 'Kitchen' },
  { id: 'grill', name: 'Grill' },
  { id: 'pastry', name: 'Pastry' },
];

/** The sheet's menu with items and stations. The Starter has none and is served from the Pass, so it keeps sc-3911's block. The Main: Jollof rice is Jollof rice and Plantain; Coconut rice is Coconut rice, its variant and its side, so Plantain is one item across the two dishes; the Suya wrap is its variant and Flatbread, so Chicken is one item across Coconut rice and the wrap; Pepper sauce is served with the course. The Dessert's dishes have no items and are served from Pastry. */
export function sampleMenu(walk: readonly string[] = ['kitchen', 'grill', 'pastry']): ItemsMenu {
  return {
    items: {
      'k2-jollof': [fixed('Jollof rice'), fixed('Plantain')],
      'k2-coconut': [
        fixed('Coconut rice'),
        { kind: 'variant' },
        { kind: 'choice', choiceId: 'c-side' },
      ],
      'ev-wrap': [{ kind: 'variant' }, fixed('Flatbread')],
    },
    own: { k2: ['Pepper sauce'] },
    servedFrom: {
      [servedKey('k2', 'Jollof rice')]: 'kitchen',
      [servedKey('k2', 'Coconut rice')]: 'kitchen',
      [servedKey('k2', 'Plantain')]: 'kitchen',
      [servedKey('k2', 'Moi moi')]: 'kitchen',
      [servedKey('k2', 'Fried yam')]: 'kitchen',
      [servedKey('k2', 'Fish')]: 'grill',
      [servedKey('k2', 'Chicken')]: 'grill',
      [servedKey('k2', 'Beef')]: 'grill',
      [servedKey('k2', 'Flatbread')]: 'kitchen',
      [servedKey('k3', 'Chin chin')]: 'pastry',
      [servedKey('k3', 'Zobo sorbet')]: 'pastry',
    },
    places: PLACES,
    walk,
  };
}

/** Fried yam joins Coconut rice's side with nobody having picked it, so one item is listed at 0. */
export function withFriedYam(world: PicksWorld): PicksWorld {
  const yam: ChoiceOption = { id: 'c-side-yam', name: 'Fried yam', contains: 'none', pickers: [] };

  return {
    ...world,
    courses: world.courses.map((course) => ({
      ...course,
      dishes: course.dishes.map((dish) =>
        dish.id !== 'k2-coconut'
          ? dish
          : {
              ...dish,
              choices: (dish.choices ?? []).map((choice) =>
                choice.id === 'c-side' ? { ...choice, options: [...choice.options, yam] } : choice,
              ),
            },
      ),
    })),
  };
}

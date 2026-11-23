import { type ChoiceOption, choice, option } from './dishChoices.ts';
import { variantsOf } from './dishVariants.ts';
import type { EvCourse, EvDish } from './menuCourses.ts';
import { eachOnce, sameKey } from './menuServed.ts';
import { type PicksWorld, type Spot, spotOf } from './seePicks.ts';
import { PASS, dishedAt, itemKey } from './stations.ts';

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
  /** Served from (sc-3910), keyed and read as What each station serves keys it (`itemKey`, `dishedAt`); an item not here is served from the Pass. */
  dishedAt: Readonly<Record<string, string>>;
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

const optionsOf = (dish: EvDish, choiceId: string): readonly ChoiceOption[] =>
  (dish.choices ?? []).find((one) => one.id === choiceId)?.options ?? [];

/** The course's items, by sc-34230's rule in `eachOnce`; See picks' dishes carry options as objects, so the names are read here and the rule is Menu's. */
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
  return eachOnce([...names, ...(menu.own[course.id] ?? [])]);
}

type Plate = { chefs: boolean; names: readonly string[] };

/** What one guest's tray holds on a course (sc-4005's order rules); null for a guest who skipped it. A guest's own pick answers every choice, an optional one with None for me; a default names only the required ones (sc-1362), so a defaulted guest has no answer to an optional choice item and is Chef's choice. */
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
    if (picked.length === 0 && spot.defaulted) chefs = true;

    return picked.map((one) => one.name);
  });

  return { chefs, names: [...names, ...own] };
}

export function hasByStation(menu: ItemsMenu, course: EvCourse): boolean {
  return (
    course.dishes.some((dish) => (menu.items[dish.id] ?? []).length > 0) ||
    (menu.own[course.id] ?? []).length > 0 ||
    courseItems(menu, course).some((name) => dishedAt(menu, course.id, name) !== PASS)
  );
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
    plates.filter((plate) => plate.names.some((one) => sameKey(one) === sameKey(name))).length;
  const chefs = plates.filter((plate) => plate.chefs).length;
  const items = courseItems(menu, course);

  return [PASS, ...menu.walk].flatMap((placeId): StationBlock[] => {
    const place = menu.places.find((one) => one.id === placeId);
    const lines: StationLine[] = items
      .filter((name) => dishedAt(menu, course.id, name) === placeId)
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

/** The sheet's menu with items and stations. The Starter has none and is served from the Pass, so it keeps sc-3911's block. The Main: Jollof rice is Jollof rice and Plantain; Coconut rice is Coconut rice, its variant and its side, so Plantain is one item across the two dishes; the Suya wrap is its variant and Flatbread, so Chicken is one item across Coconut rice and the wrap; Pepper sauce is served with the course. The Dessert's Chin chin has no items; Zobo sorbet is Zobo sorbet and its optional side, which the default names none of. Both are served from Pastry. */
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
      'k3-zobo': [fixed('Zobo sorbet'), { kind: 'choice', choiceId: 'c-zobo-side' }],
    },
    own: { k2: ['Pepper sauce'] },
    dishedAt: {
      [itemKey('k2', 'Jollof rice')]: 'kitchen',
      [itemKey('k2', 'Coconut rice')]: 'kitchen',
      [itemKey('k2', 'Plantain')]: 'kitchen',
      [itemKey('k2', 'Moi moi')]: 'kitchen',
      [itemKey('k2', 'Fried yam')]: 'kitchen',
      [itemKey('k2', 'Fish')]: 'grill',
      [itemKey('k2', 'Chicken')]: 'grill',
      [itemKey('k2', 'Beef')]: 'grill',
      [itemKey('k2', 'Flatbread')]: 'kitchen',
      [itemKey('k3', 'Chin chin')]: 'pastry',
      [itemKey('k3', 'Zobo sorbet')]: 'pastry',
      [itemKey('k3', 'Fruit salad')]: 'pastry',
      [itemKey('k3', 'Puff-puff')]: 'pastry',
    },
    places: PLACES,
    walk,
  };
}

/** The menu with items in See picks' room: Fried yam joins Coconut rice's side with nobody having picked it, so one item is listed at 0; Zobo sorbet asks an optional "And a side?" that every guest who picked it answered None for me, so after the close only the guests given it by default have no answer. */
export function withItems(world: PicksWorld): PicksWorld {
  const yam: ChoiceOption = { id: 'c-side-yam', name: 'Fried yam', contains: 'none', pickers: [] };
  const zoboSide = choice(
    'c-zobo-side',
    'And a side?',
    [
      option('c-zobo-side-fruit', 'Fruit salad', 'none'),
      option('c-zobo-side-puff', 'Puff-puff', 'none'),
    ],
    { required: false },
  );

  return {
    ...world,
    courses: world.courses.map((course) => ({
      ...course,
      dishes: course.dishes.map((dish) => {
        if (dish.id === 'k3-zobo') return { ...dish, choices: [...(dish.choices ?? []), zoboSide] };
        if (dish.id !== 'k2-coconut') return dish;

        return {
          ...dish,
          choices: (dish.choices ?? []).map((one) =>
            one.id === 'c-side' ? { ...one, options: [...one.options, yam] } : one,
          ),
        };
      }),
    })),
  };
}

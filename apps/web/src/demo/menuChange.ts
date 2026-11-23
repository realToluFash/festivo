import type { Allergen } from './guestKitchenWords.ts';
import {
  type Contains,
  type DishAllergen,
  type Lang,
  DISH_ALLERGENS,
  allergenName,
  listOf,
} from './menuLibrary.ts';
import { hasVariants, variantsOf } from './dishVariants.ts';
import type { EvCourse, EvDish, Picker } from './menuCourses.ts';

/** sc-3913's MenuChange dialog (boards MenuChange-*, page e32): a change to a menu guests have picked from asks the host first, naming who it asks again and for which course. */
export type MenuChange =
  | { kind: 'dish'; courseId: string; dishId: string }
  | { kind: 'variant'; courseId: string; dishId: string; variantId: string }
  | { kind: 'firstDish'; courseId: string; dish: EvDish }
  | { kind: 'allergen'; courseId: string; dishId: string; next: EvDish };

export interface ChangeAsks {
  title: string;
  count: string;
  stays: string;
  done: string;
  /** The people asked again, which the done note and the tests count. */
  people: number;
}

const guests = (n: number) => (n === 1 ? '1 guest' : `${n} guests`);

export const MCW = {
  go: 'Change and ask them',
  cancel: 'Cancel',
  close: 'Close',
  nobodyMessaged: 'Nobody is messaged from here.',
  removeDish: (dish: string, course: string) => `Remove ${dish} from ${course}?`,
  removeVariant: (variant: string, dish: string) => `Remove ${variant} from ${dish}?`,
  addFirst: (dish: string, course: string) => `Add ${dish} to ${course}?`,
  addAllergens: (allergens: string, dish: string) => `Add ${allergens} to ${dish}?`,
  pickedDish: (n: number, course: string) =>
    `${n === 1 ? '1 guest picked this dish. They’ll' : `${n} guests picked this dish. They’ll`} be asked to pick again for ${course}.`,
  pickedVariant: (n: number, course: string) =>
    `${n === 1 ? '1 guest picked this variant. They’ll' : `${n} guests picked this variant. They’ll`} be asked to pick again for ${course}.`,
  allComing: (n: number, course: string) =>
    `All ${guests(n)} coming will be asked to pick for ${course}.`,
  pickedWith: (n: number, allergens: string, course: string) =>
    `${n === 1 ? '1 guest who picked this dish has' : `${n} guests who picked this dish have`} ${allergens} recorded. They’ll be asked to pick again for ${course}, and will appear in Needs the host.`,
  staysAgain: (course: string) =>
    `Only ${course} is asked again. Everything else they answered stays, and their old pick is kept on their RSVP.`,
  staysNew: (course: string) => `Only ${course} is asked. Everything else they answered stays.`,
  doneDish: (dish: string, course: string, n: number) =>
    `${dish} removed from ${course}. ${guests(n)} will be asked to pick again.`,
  doneVariant: (variant: string, dish: string, n: number) =>
    `${variant} removed from ${dish}. ${guests(n)} will be asked to pick again.`,
  doneFirst: (dish: string, course: string, n: number) =>
    `${dish} added to ${course}. ${guests(n)} will be asked to pick.`,
  doneAllergens: (dish: string, n: number) =>
    `${dish} saved. ${guests(n)} will be asked to pick again.`,
  refusedWord: 'Not changed',
  pastDate: (event: string, day: string) =>
    `${event} was on ${day}. Its menu can’t change after the date. Nothing was changed.`,
};

type Picked = Pick<EvDish, 'pickers' | 'variants'>;

/** Everyone on the dish, with the allergies they recorded: on its variants when it has them. */
export const pickersOf = (dish: Picked): readonly Picker[] =>
  hasVariants(dish) ? variantsOf(dish).flatMap((one) => one.pickers) : dish.pickers;

export const pickedBy = (dish: Picked): number => pickersOf(dish).length;

/** The allergens just added to a dish's Contains; ticking Contains none of these, or removing one, adds none. */
export function addedAllergens(before: Contains, after: Contains): DishAllergen[] {
  if (!Array.isArray(after)) return [];
  const had: readonly DishAllergen[] = Array.isArray(before) ? before : [];

  return after.filter((code) => !had.includes(code));
}

/** The people who picked the dish, or one of its variants, and have one of the added allergens recorded, each once; an Other allergy is never matched. */
export function pickedWithAdded(dish: Picked, added: readonly DishAllergen[]): readonly Picker[] {
  return pickersOf(dish).filter((one) => added.some((code) => one.includes(code as Allergen)));
}

/** The added allergens somebody counted has recorded, in the house order. */
export function recordedOf(
  added: readonly DishAllergen[],
  counted: readonly Picker[],
): DishAllergen[] {
  return DISH_ALLERGENS.filter(
    (code) => added.includes(code) && counted.some((one) => one.includes(code as Allergen)),
  );
}

/** A course's first dish asks everyone coming, once somebody has picked anything; before that a change asks nothing. */
export function asksAtFirstDish(courses: readonly EvCourse[], course: EvCourse): boolean {
  return (
    course.dishes.length === 0 &&
    course.answer === 'choose' &&
    !course.skip &&
    courses.some((one) => one.dishes.some((dish) => pickedBy(dish) > 0))
  );
}

export function changeAsks(
  change: MenuChange,
  courses: readonly EvCourse[],
  coming: number,
  lang: Lang = 'en',
): ChangeAsks | null {
  const course = courses.find((one) => one.id === change.courseId);
  if (course == null) return null;
  const again = MCW.staysAgain(course.name);

  if (change.kind === 'firstDish') {
    return {
      title: MCW.addFirst(change.dish.name, course.name),
      count: MCW.allComing(coming, course.name),
      stays: MCW.staysNew(course.name),
      done: MCW.doneFirst(change.dish.name, course.name, coming),
      people: coming,
    };
  }

  const dish = course.dishes.find((one) => one.id === change.dishId);
  if (dish == null) return null;

  if (change.kind === 'dish') {
    const n = pickedBy(dish);

    return {
      title: MCW.removeDish(dish.name, course.name),
      count: MCW.pickedDish(n, course.name),
      stays: again,
      done: MCW.doneDish(dish.name, course.name, n),
      people: n,
    };
  }

  if (change.kind === 'variant') {
    const variant = variantsOf(dish).find((one) => one.id === change.variantId);
    if (variant == null) return null;
    const n = variant.pickers.length;

    return {
      title: MCW.removeVariant(variant.name, dish.name),
      count: MCW.pickedVariant(n, course.name),
      stays: again,
      done: MCW.doneVariant(variant.name, dish.name, n),
      people: n,
    };
  }

  const added = addedAllergens(dish.contains, change.next.contains);
  const counted = pickedWithAdded(dish, added);
  const n = counted.length;
  const names = (codes: readonly DishAllergen[]) =>
    listOf(
      codes.map((code) => allergenName(code, lang)),
      lang,
    );

  return {
    title: MCW.addAllergens(names(added), dish.name),
    count: MCW.pickedWith(n, names(recordedOf(added, counted)), course.name),
    stays: again,
    done: MCW.doneAllergens(change.next.name, n),
    people: n,
  };
}

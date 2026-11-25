import type { Allergen } from './guestKitchenWords.ts';
import {
  type Contains,
  type DishAllergen,
  type Lang,
  DISH_ALLERGENS,
  allergenName,
  listOf,
} from './menuLibrary.ts';
import { hasVariants, isForEveryone, variantsOf } from './dishVariants.ts';
import { type Choice, type ChoiceOption, choicesOf } from './dishChoices.ts';
import type { EvCourse, EvDish, Picker } from './menuCourses.ts';

/** sc-3913's MenuChange dialog (boards MenuChange-*, page e32): a change to a menu guests have picked from asks the host first, naming who it asks again and for which course. */
export type MenuChange =
  | { kind: 'dish'; courseId: string; dishId: string }
  | { kind: 'variant'; courseId: string; dishId: string; variantId: string }
  | { kind: 'firstDish'; courseId: string; dish: EvDish }
  | { kind: 'allergen'; courseId: string; dishId: string; next: EvDish }
  | { kind: 'firstVariant'; courseId: string; dishId: string; next: EvDish }
  /** Another variant on a dish that has some: asks nobody, unless an Everyone gets the same course starts asking with it. */
  | { kind: 'variantAdded'; courseId: string; dishId: string; next: EvDish }
  | { kind: 'variantAllergen'; courseId: string; dishId: string; variantId: string; next: EvDish }
  /** A choice added (`choiceId` null), removed, or saved changed (sc-3904); `next` is the dish after it. */
  | { kind: 'choice'; courseId: string; dishId: string; choiceId: string | null; next: EvDish };

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
  pickedVariantWith: (n: number, allergens: string, course: string) =>
    `${n === 1 ? '1 guest who picked this variant has' : `${n} guests who picked this variant have`} ${allergens} recorded. They’ll be asked to pick again for ${course}, and will appear in Needs the host.`,
  pickedOptionWith: (n: number, allergens: string, course: string) =>
    `${n === 1 ? '1 guest who picked this option has' : `${n} guests who picked this option have`} ${allergens} recorded. They’ll be asked to pick again for ${course}, and will appear in Needs the host.`,
  pickedOption: (n: number, options: number, course: string) =>
    `${n === 1 ? '1 guest' : `${n} guests`} picked ${options === 1 ? 'this option' : 'these options'}. They’ll be asked to pick again for ${course}.`,
  answeredChoice: (n: number, course: string) =>
    `${n === 1 ? '1 guest answered this choice. They’ll' : `${n} guests answered this choice. They’ll`} be asked to pick again for ${course}.`,
  answeredNone: (n: number, course: string) =>
    `${n === 1 ? '1 guest answered None for me. They’ll' : `${n} guests answered None for me. They’ll`} be asked to pick again for ${course}.`,
  answersChange: (n: number, course: string) =>
    `${n === 1 ? '1 guest answered in a way this changes. They’ll' : `${n} guests answered in a way this changes. They’ll`} be asked to pick again for ${course}.`,
  alsoNeedsHost: 'Anyone with an added allergen recorded will also appear in Needs the host.',
  firstVariants: (dish: string, k: number) => `Make ${dish} come ${k} ways?`,
  variantAllergens: (allergens: string, variant: string, dish: string) =>
    `Add ${allergens} to ${variant} in ${dish}?`,
  addVariant: (variant: string, dish: string) => `Add ${variant} to ${dish}?`,
  answeredDish: (n: number, dish: string, course: string) =>
    `${n === 1 ? '1 guest answered' : `${n} guests answered`} the choices on ${dish}. They’ll be asked to pick again for ${course}.`,
  addChoice: (question: string, dish: string) => `Add “${question}” to ${dish}?`,
  removeChoice: (question: string, dish: string) => `Remove “${question}” from ${dish}?`,
  pickCount: (n: number, question: string) =>
    `Let guests pick ${n === 1 ? '1 option' : `${n} options`} in “${question}”?`,
  requiredOn: (question: string) => `Make “${question}” required?`,
  dropOptions: (options: string, question: string) => `Remove ${options} from “${question}”?`,
  saveChoice: (question: string) => `Save “${question}”?`,
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
  doneWays: (dish: string, k: number, n: number) =>
    `${dish} now comes ${k} ways. ${guests(n)} will be asked to pick again.`,
  doneVariantAdded: (variant: string, dish: string, n: number) =>
    `${variant} added to ${dish}. ${guests(n)} will be asked to pick.`,
  doneChoiceAdded: (question: string, dish: string, n: number, all: boolean) =>
    `“${question}” added to ${dish}. ${guests(n)} will be asked to pick${all ? '' : ' again'}.`,
  doneChoiceRemoved: (question: string, dish: string, n: number) =>
    `“${question}” removed from ${dish}. ${guests(n)} will be asked to pick again.`,
  doneChoice: (question: string, n: number) =>
    `“${question}” saved. ${guests(n)} will be asked to pick again.`,
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

/** Each person names exactly `pick` options, so the people are the names over `pick`, and those who answered None for me. A choice is answered by the people who picked its dish, so this never exceeds them. */
export const answeredBy = (choice: Choice): number =>
  Math.round(
    choice.options.reduce((sum, one) => sum + one.pickers.length, 0) / Math.max(choice.pick, 1),
  ) + choice.noneAnswers;

function optionAdded(before: ChoiceOption, after: ChoiceOption) {
  const added = addedAllergens(before.contains, after.contains);

  return { option: after, added, counted: pickedWithAdded(before, added) };
}

export interface ChoiceChange {
  /** What re-asks, by sc-3913's 31 Oct decision; the rest of an edit asks nobody. */
  kinds: ('pick' | 'required' | 'options' | 'allergen')[];
  people: number;
  dropped: readonly ChoiceOption[];
  allergen: ReturnType<typeof optionAdded>[];
}

/** An answered choice saved changed. With pick count changed everyone who answered is asked; otherwise those it reaches. The demo's answers carry no person, so the groups are summed: apart at Pick exactly 1, as every sample is, and never more than answered it. The API counts each guest once at any pick. */
export function choiceChange(was: Choice, now: Choice): ChoiceChange {
  const pick = now.pick !== was.pick && answeredBy(was) > 0;
  const required = now.required && !was.required && was.noneAnswers > 0;
  const dropped = was.options.filter(
    (one) => one.pickers.length > 0 && !now.options.some((other) => other.id === one.id),
  );
  const allergen = now.options.flatMap((after) => {
    const before = was.options.find((one) => one.id === after.id);
    const found = before == null ? null : optionAdded(before, after);

    return found == null || found.counted.length === 0 ? [] : [found];
  });
  const kinds: ChoiceChange['kinds'] = [];
  if (pick) kinds.push('pick');
  if (required) kinds.push('required');
  if (dropped.length > 0) kinds.push('options');
  if (allergen.length > 0) kinds.push('allergen');
  const people = pick
    ? answeredBy(was)
    : Math.min(
        answeredBy(was),
        (required ? was.noneAnswers : 0) +
          dropped.reduce((sum, one) => sum + one.pickers.length, 0) +
          allergen.reduce((sum, one) => sum + one.counted.length, 0),
      );

  return { kinds, people, dropped, allergen };
}

const anyPicked = (courses: readonly EvCourse[]): boolean =>
  courses.some((one) => one.dishes.some((dish) => pickedBy(dish) > 0));

/** A dish asks guests something once it has a choice or a second Everyone variant (sc-3907); Children's portions alone ask nothing. */
export const asksGuests = (dish: Picked & Pick<EvDish, 'choices'>): boolean =>
  choicesOf(dish).length > 0 || variantsOf(dish).filter(isForEveryone).length > 1;

/** An Everyone gets the same course whose dish starts asking guests something asks everyone coming, once the menu has picks. */
export const startsAsking = (
  courses: readonly EvCourse[],
  course: EvCourse,
  before: EvDish,
  after: EvDish,
): boolean =>
  course.answer === 'same' && anyPicked(courses) && !asksGuests(before) && asksGuests(after);

const answeredDish = (dish: EvDish): number =>
  Math.max(pickedBy(dish), ...choicesOf(dish).map(answeredBy));

/** The answers a confirmed change takes back, so the menu counts them no more: they are Menu changed now. */
export function afterChange(change: MenuChange, dish: EvDish): EvDish {
  if (change.kind === 'firstVariant') return { ...change.next, pickers: [] };
  if (change.kind === 'variantAllergen') {
    const was = variantsOf(dish).find((one) => one.id === change.variantId);
    const added =
      was == null
        ? []
        : addedAllergens(was.contains, variantOf(change.next, change.variantId)?.contains ?? null);

    return {
      ...change.next,
      variants: variantsOf(change.next).map((one) =>
        one.id === change.variantId
          ? {
              ...one,
              pickers: one.pickers.filter(
                (p) => !added.some((code) => p.includes(code as Allergen)),
              ),
            }
          : one,
      ),
    };
  }
  if (change.kind !== 'choice' || change.choiceId == null)
    return 'next' in change ? change.next : dish;
  const was = choicesOf(dish).find((one) => one.id === change.choiceId);
  if (was == null) return change.next;
  const choices = choicesOf(change.next).map((now): Choice => {
    if (now.id !== was.id) return now;
    const { kinds, allergen } = choiceChange(was, now);
    if (kinds.includes('pick'))
      return {
        ...now,
        noneAnswers: 0,
        options: now.options.map((one) => ({ ...one, pickers: [] })),
      };

    return {
      ...now,
      noneAnswers: kinds.includes('required') ? 0 : now.noneAnswers,
      options: now.options.map((one) => {
        const hit = allergen.find((found) => found.option.id === one.id);

        return hit == null
          ? one
          : {
              ...one,
              pickers: one.pickers.filter(
                (p) => !hit.added.some((code) => p.includes(code as Allergen)),
              ),
            };
      }),
    };
  });

  return { ...change.next, choices };
}

const variantOf = (dish: EvDish, id: string) => variantsOf(dish).find((one) => one.id === id);

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

  const names = (codes: readonly DishAllergen[]) =>
    listOf(
      codes.map((code) => allergenName(code, lang)),
      lang,
    );

  if (change.kind === 'firstVariant' || change.kind === 'variantAdded') {
    const k = variantsOf(change.next).length;
    if (startsAsking(courses, course, dish, change.next)) {
      const added = variantsOf(change.next).find(
        (one) => !variantsOf(dish).some((other) => other.id === one.id),
      );

      return {
        title:
          change.kind === 'firstVariant' || added == null
            ? MCW.firstVariants(dish.name, k)
            : MCW.addVariant(added.name, dish.name),
        count: MCW.allComing(coming, course.name),
        stays: MCW.staysNew(course.name),
        done:
          change.kind === 'firstVariant' || added == null
            ? MCW.doneWays(dish.name, k, coming)
            : MCW.doneVariantAdded(added.name, dish.name, coming),
        people: coming,
      };
    }
    if (change.kind === 'variantAdded') return null;
    const n = pickedBy(dish);

    return {
      title: MCW.firstVariants(dish.name, k),
      count: MCW.pickedDish(n, course.name),
      stays: again,
      done: MCW.doneWays(dish.name, k, n),
      people: n,
    };
  }

  if (change.kind === 'variantAllergen') {
    const was = variantOf(dish, change.variantId);
    const now = variantOf(change.next, change.variantId);
    if (was == null || now == null) return null;
    const added = addedAllergens(was.contains, now.contains);
    const counted = pickedWithAdded(was, added);
    const n = counted.length;

    return {
      title: MCW.variantAllergens(names(added), now.name, dish.name),
      count: MCW.pickedVariantWith(n, names(recordedOf(added, counted)), course.name),
      stays: again,
      done: MCW.doneAllergens(now.name, n),
      people: n,
    };
  }

  if (change.kind === 'choice') return choiceAsks(change, course, dish, coming, courses, names);

  const added = addedAllergens(dish.contains, change.next.contains);
  const counted = pickedWithAdded(dish, added);
  const n = counted.length;

  return {
    title: MCW.addAllergens(names(added), dish.name),
    count: MCW.pickedWith(n, names(recordedOf(added, counted)), course.name),
    stays: again,
    done: MCW.doneAllergens(change.next.name, n),
    people: n,
  };
}

function choiceAsks(
  change: Extract<MenuChange, { kind: 'choice' }>,
  course: EvCourse,
  dish: EvDish,
  coming: number,
  courses: readonly EvCourse[],
  names: (codes: readonly DishAllergen[]) => string,
): ChangeAsks | null {
  const again = MCW.staysAgain(course.name);
  const before = choicesOf(dish);
  const after = choicesOf(change.next);

  if (change.choiceId == null) {
    const added = after.find((one) => !before.some((other) => other.id === one.id));
    if (added == null) return null;
    const all = startsAsking(courses, course, dish, change.next);
    const same = course.answer === 'same';
    const n = all ? coming : same ? answeredDish(dish) : pickedBy(dish);

    return {
      title: MCW.addChoice(added.question, dish.name),
      count: all
        ? MCW.allComing(n, course.name)
        : same && pickedBy(dish) === 0
          ? MCW.answeredDish(n, dish.name, course.name)
          : MCW.pickedDish(n, course.name),
      stays: all ? MCW.staysNew(course.name) : again,
      done: MCW.doneChoiceAdded(added.question, dish.name, n, all),
      people: n,
    };
  }

  const was = before.find((one) => one.id === change.choiceId);
  if (was == null) return null;
  const now = after.find((one) => one.id === was.id);

  if (now == null) {
    const n = answeredBy(was);

    return {
      title: MCW.removeChoice(was.question, dish.name),
      count: MCW.answeredChoice(n, course.name),
      stays: again,
      done: MCW.doneChoiceRemoved(was.question, dish.name, n),
      people: n,
    };
  }

  const found = choiceChange(was, now);
  const n = found.people;
  const one = found.kinds.length === 1 ? found.kinds[0] : null;
  const onlyAllergen = one === 'allergen' && found.allergen.length === 1 ? found.allergen[0] : null;
  const title =
    one === 'pick'
      ? MCW.pickCount(now.pick, now.question)
      : one === 'required'
        ? MCW.requiredOn(now.question)
        : one === 'options'
          ? MCW.dropOptions(listOf(found.dropped.map((o) => o.name)), now.question)
          : onlyAllergen != null
            ? MCW.addAllergens(names(onlyAllergen.added), onlyAllergen.option.name)
            : MCW.saveChoice(now.question);
  const count =
    one === 'pick'
      ? MCW.answeredChoice(n, course.name)
      : one === 'required'
        ? MCW.answeredNone(n, course.name)
        : one === 'options'
          ? MCW.pickedOption(n, found.dropped.length, course.name)
          : onlyAllergen != null
            ? MCW.pickedOptionWith(
                n,
                names(recordedOf(onlyAllergen.added, onlyAllergen.counted)),
                course.name,
              )
            : found.kinds.includes('allergen')
              ? `${MCW.answersChange(n, course.name)} ${MCW.alsoNeedsHost}`
              : MCW.answersChange(n, course.name);

  return { title, count, stays: again, done: MCW.doneChoice(now.question, n), people: n };
}

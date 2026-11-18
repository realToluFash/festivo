import type { Diet, Lang } from './menuLibrary.ts';
import { type Variant, isForEveryone, variantsOf } from './dishVariants.ts';
import { type Choice, choicesOf, dishHidden } from './dishChoices.ts';
import { type PicksDates, dayWords } from './picksClose.ts';
import type { EvCourse, EvDish } from './menuCourses.ts';

/** sc-1362's default and choose-by date on a course that asks guests something (board Menu, page e32): set together or not at all. */
export interface CourseDefault {
  dishId: string;
  variantId: string | null;
  optionIds: readonly string[];
}

export type Given = readonly Diet[];

export interface DefaultForm {
  dishId: string | null;
  variantId: string | null;
  options: Readonly<Record<string, readonly string[]>>;
  chooseBy: string;
}

export interface DefaultErrors {
  dish: string | null;
  variant: string | null;
  choices: Readonly<Record<string, string>>;
  chooseBy: string | null;
}

export interface DefaultDates {
  today: string;
  event: string;
  /** The date saved before this form opened: unchanged, it is never checked against today. */
  stored: string | null;
}

const guests = (n: number): string => (n === 1 ? '1 guest' : `${n} guests`);

const goBack = (pick: string, back: number): string =>
  back === 0
    ? ''
    : ` ${back} ${back === 1 ? 'goes' : 'go'} back to not chosen, because ${pick} doesn’t meet their diet, and ${back === 1 ? 'is' : 'are'} listed first in Who hasn’t picked.`;

const backNow = (back: number): string =>
  back === 0 ? '' : ` ${back} ${back === 1 ? 'is' : 'are'} back to not chosen.`;

export const DFW = {
  heading: 'Default and choose-by date',
  help: '[Set both or neither. On the choose-by date, everyone coming who hasn’t answered gets the default, except anyone with an allergy recorded or a diet it doesn’t meet. They stay not chosen and are listed first for you.]',
  default: 'Default',
  noDefault: 'No default',
  variant: 'Variant',
  childrenOnly: '[Children only variants can’t be the default.]',
  chooseN: (n: number) => `Choose ${n}`,
  chooseBy: 'Choose by',
  chooseByHint: (course: string, event: string) =>
    `[Picks for ${course} close at 23:59 on this date, Lagos time. It must be before the event, ${event}.]`,
  clear: 'Clear the default and date',
  locked: (date: string) => `[${date} has passed, so the date is locked.]`,
  onlyDefault: 'Enter a choose-by date, or set the default to No default.',
  onlyDate: 'Choose a default dish, or clear the choose-by date.',
  afterEvent: (event: string) => `Choose a date before the event, ${event}.`,
  past: (today: string) => `That date has passed. Choose today, ${today}, or later.`,
  noVariant: 'Choose the default’s variant.',
  answer: (question: string) => `Answer “${question}” for the default.`,
  chooseFor: (n: number, question: string) => `Choose ${n} for “${question}”.`,
  line: (pick: string, date: string) =>
    `[Default: ${pick}. Given on ${date} to anyone coming who hasn’t answered.]`,
  lineGiven: (pick: string, date: string, n: number) =>
    n === 0
      ? `[Default: ${pick}. Nobody who hadn’t answered by ${date} has it.]`
      : `[Default: ${pick}. Given on ${date} to ${guests(n)} who hadn’t answered.]`,
  moveTitle: (n: number, pick: string) => `Move ${guests(n)} to ${pick}?`,
  moveBody: (n: number, was: string, date: string, pick: string, back: number) =>
    `[${guests(n)} given ${was} on ${date} ${n === 1 ? 'moves' : 'move'} to ${pick}.${goBack(pick, back)}]`,
  moveGo: (n: number) => `Move ${guests(n)}`,
  changeTitle: (pick: string) => `[Change the default to ${pick}?]`,
  changeBody: (was: string, date: string, pick: string, back: number) =>
    `[Nobody given ${was} on ${date} moves to ${pick}.${goBack(pick, back)}]`,
  changeGo: '[Change the default]',
  cancel: 'Cancel',
  moved: (n: number, pick: string, back: number) =>
    `[${guests(n)} moved to ${pick}.${backNow(back)}]`,
  changed: (pick: string, back: number) => `[The default is now ${pick}.${backNow(back)}]`,
  refuseDish: (dish: string, course: string) =>
    `[${dish} is ${course}’s default. Choose another default first, in Edit course.]`,
  refuseVariant: (variant: string, course: string) =>
    `[${variant} is ${course}’s default variant. Choose another default first, in Edit course.]`,
  refuseOption: (option: string, course: string) =>
    `[${option} is part of ${course}’s default. Choose another default first, in Edit course.]`,
} as const;

/** The dishes guests can see: a dish waiting on a draft choice is never the default. */
export const offeredDishes = (course: EvCourse): readonly EvDish[] =>
  course.dishes.filter((one) => !dishHidden(one));

export const everyoneVariants = (dish: EvDish): readonly Variant[] =>
  variantsOf(dish).filter(isForEveryone);

export const hasChildrenOnly = (dish: EvDish): boolean =>
  variantsOf(dish).some((one) => !isForEveryone(one));

export const requiredChoices = (dish: EvDish): readonly Choice[] =>
  choicesOf(dish).filter((one) => one.required);

const dishOf = (course: EvCourse, id: string | null): EvDish | null =>
  course.dishes.find((one) => one.id === id) ?? null;

/** Locked once the stored date has passed: the date can't change and the pair can't be cleared. */
export const isLocked = (dates: DefaultDates): boolean =>
  dates.stored != null && dates.today > dates.stored;

export function defaultForm(course: EvCourse, chooseBy: string | null): DefaultForm {
  const pick = course.pick ?? null;
  const dish = dishOf(course, pick?.dishId ?? null);

  return {
    dishId: dish?.id ?? null,
    variantId: pick?.variantId ?? null,
    options:
      pick == null || dish == null
        ? {}
        : Object.fromEntries(
            requiredChoices(dish).map((choice) => [
              choice.id,
              choice.options.filter((one) => pick.optionIds.includes(one.id)).map((one) => one.id),
            ]),
          ),
    chooseBy: chooseBy ?? '',
  };
}

export const withDish = (form: DefaultForm, dishId: string | null): DefaultForm =>
  dishId === form.dishId ? form : { ...form, dishId, variantId: null, options: {} };

export const CLEARED: DefaultForm = {
  dishId: null,
  variantId: null,
  options: {},
  chooseBy: '',
};

export function checkDefault(
  form: DefaultForm,
  course: EvCourse,
  dates: DefaultDates,
  lang: Lang,
): DefaultErrors {
  const dish = dishOf(course, form.dishId);
  const date = form.chooseBy.trim();
  const errors: DefaultErrors = { dish: null, variant: null, choices: {}, chooseBy: null };
  if (dish == null && date === '') return errors;
  if (dish == null) return { ...errors, dish: DFW.onlyDate };

  return {
    dish: null,
    variant:
      everyoneVariants(dish).length > 0 &&
      !everyoneVariants(dish).some((one) => one.id === form.variantId)
        ? DFW.noVariant
        : null,
    choices: Object.fromEntries(
      requiredChoices(dish).flatMap((choice) => {
        const had = (form.options[choice.id] ?? []).filter((id) =>
          choice.options.some((one) => one.id === id),
        );
        if (had.length === choice.pick) return [];

        return [
          [
            choice.id,
            choice.pick === 1
              ? DFW.answer(choice.question)
              : DFW.chooseFor(choice.pick, choice.question),
          ],
        ];
      }),
    ),
    chooseBy: dateProblem(date, dates, lang),
  };
}

function dateProblem(date: string, dates: DefaultDates, lang: Lang): string | null {
  if (date === '') return DFW.onlyDefault;
  if (date >= dates.event) return DFW.afterEvent(dayWords(dates.event, lang));
  if (date !== dates.stored && date < dates.today) return DFW.past(dayWords(dates.today, lang));

  return null;
}

export const hasDefaultProblem = (errors: DefaultErrors): boolean =>
  errors.dish != null ||
  errors.variant != null ||
  Object.keys(errors.choices).length > 0 ||
  errors.chooseBy != null;

export const dishRadio = (id: string | null): string => `mc-def-${id ?? 'none'}`;
export const variantRadio = (id: string): string => `mc-def-v-${id}`;
export const optionInput = (choiceId: string, optionId: string): string =>
  `mc-def-o-${choiceId}-${optionId}`;
export const CHOOSE_BY_ID = 'mc-choose-by';

export function firstDefaultProblem(
  errors: DefaultErrors,
  form: DefaultForm,
  course: EvCourse,
): string | null {
  if (errors.dish != null) return dishRadio(null);
  const dish = dishOf(course, form.dishId);
  if (dish != null && errors.variant != null) {
    const first = everyoneVariants(dish)[0];
    if (first != null) return variantRadio(first.id);
  }
  const choice = dish == null ? null : requiredChoices(dish).find((one) => errors.choices[one.id]);
  const option = choice?.options[0];
  if (choice != null && option != null) return optionInput(choice.id, option.id);
  if (errors.chooseBy != null) return CHOOSE_BY_ID;

  return null;
}

export function savedDefault(form: DefaultForm, course: EvCourse): CourseDefault | null {
  const dish = dishOf(course, form.dishId);
  if (dish == null) return null;

  return {
    dishId: dish.id,
    variantId: everyoneVariants(dish).some((one) => one.id === form.variantId)
      ? form.variantId
      : null,
    optionIds: requiredChoices(dish).flatMap((choice) =>
      choice.options
        .filter((one) => (form.options[choice.id] ?? []).includes(one.id))
        .map((one) => one.id),
    ),
  };
}

export const samePick = (a: CourseDefault | null, b: CourseDefault | null): boolean =>
  a?.dishId === b?.dishId &&
  a?.variantId === b?.variantId &&
  [...(a?.optionIds ?? [])].sort().join() === [...(b?.optionIds ?? [])].sort().join();

export function pickWords(course: EvCourse, pick: CourseDefault): string {
  const dish = dishOf(course, pick.dishId);
  if (dish == null) return '';
  const variant = variantsOf(dish).find((one) => one.id === pick.variantId);
  const options = requiredChoices(dish).flatMap((choice) =>
    choice.options.filter((one) => pick.optionIds.includes(one.id)).map((one) => one.name),
  );

  return [dish.name, variant?.name, ...options].filter((one) => one != null).join(', ');
}

/** The diets a default meets: its variant's Suitable for, or the dish's when it has no variants. Options carry no diets. */
export function suitableFor(course: EvCourse, pick: CourseDefault): readonly Diet[] {
  const dish = dishOf(course, pick.dishId);
  if (dish == null) return [];
  const variant = variantsOf(dish).find((one) => one.id === pick.variantId);

  return variant?.diets ?? dish.diets;
}

/** A recorded Other diet is never met: no dish can claim it. */
export const meetsDiets = (
  diets: readonly (Diet | 'other')[],
  suitable: readonly Diet[],
): boolean => diets.every((one) => one !== 'other' && suitable.includes(one));

/** Never given the default: anyone with an allergy recorded, Other included, or a diet it doesn't meet. */
export const excludedFromDefault = (
  person: { allergies: readonly unknown[]; diets: readonly (Diet | 'other')[] },
  suitable: readonly Diet[],
): boolean => person.allergies.length > 0 || !meetsDiets(person.diets, suitable);

export function moveCounts(
  given: readonly Given[],
  suitable: readonly Diet[],
): { move: number; back: number } {
  const move = given.filter((one) => meetsDiets(one, suitable)).length;

  return { move, back: given.length - move };
}

export const stillGiven = (given: readonly Given[], suitable: readonly Diet[]): Given[] =>
  given.filter((one) => meetsDiets(one, suitable));

export function defaultLine(
  course: EvCourse,
  pick: CourseDefault,
  chooseBy: string,
  closed: boolean,
  lang: Lang,
): string {
  const words = pickWords(course, pick);
  const day = dayWords(chooseBy, lang);

  return closed ? DFW.lineGiven(words, day, (course.given ?? []).length) : DFW.line(words, day);
}

export const isDefaultDish = (course: EvCourse, dishId: string): boolean =>
  course.pick?.dishId === dishId;

export const isDefaultVariant = (course: EvCourse, dishId: string, variantId: string): boolean =>
  isDefaultDish(course, dishId) && course.pick?.variantId === variantId;

export const isDefaultOption = (course: EvCourse, dishId: string, optionId: string): boolean =>
  isDefaultDish(course, dishId) && (course.pick?.optionIds ?? []).includes(optionId);

export const defaultDates = (picks: PicksDates, courseId: string): DefaultDates => ({
  today: picks.today,
  event: picks.start,
  stored: picks.own[courseId] ?? null,
});

/** Nobody moves when every person given the old default has a diet the new one doesn't meet: the question then asks to change the default. */
export function moveWords(move: Move, date: string) {
  return move.move === 0
    ? {
        title: DFW.changeTitle(move.to),
        body: DFW.changeBody(move.from, date, move.to, move.back),
        go: DFW.changeGo,
        done: DFW.changed(move.to, move.back),
      }
    : {
        title: DFW.moveTitle(move.move, move.to),
        body: DFW.moveBody(move.move, move.from, date, move.to, move.back),
        go: DFW.moveGo(move.move),
        done: DFW.moved(move.move, move.to, move.back),
      };
}

export interface Move {
  move: number;
  back: number;
  from: string;
  to: string;
  on: string;
}

export function moveOf(course: EvCourse, form: DefaultForm, dates: DefaultDates): Move | null {
  const next = savedDefault(form, course);
  const given = course.given ?? [];
  const was = course.pick ?? null;
  if (!isLocked(dates) || dates.stored == null || was == null || next == null) return null;
  if (given.length === 0 || samePick(was, next)) return null;

  return {
    ...moveCounts(given, suitableFor(course, next)),
    from: pickWords(course, was),
    to: pickWords(course, next),
    on: dates.stored,
  };
}

/** The courses' own dates after a save: clearing the pair hands the course's close back to the reply-by date or the start. */
export function ownAfter(
  own: Readonly<Record<string, string>>,
  courseId: string,
  chooseBy: string | null,
): Record<string, string> {
  const rest = Object.fromEntries(Object.entries(own).filter(([id]) => id !== courseId));

  return chooseBy == null ? rest : { ...rest, [courseId]: chooseBy };
}

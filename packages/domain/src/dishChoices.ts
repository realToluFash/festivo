import {
  CHOICE_OPTION_NAME_MAXIMUM,
  CHOICE_OPTIONS_MINIMUM,
  CHOICE_QUESTION_MAXIMUM,
  CHOICES_PER_DISH_MAXIMUM,
  DISH_ALLERGENS,
  type ChoiceDetails,
  type DishAllergen,
  type MenuDishChoice,
} from '@soirely/api-client';
import { dishLength } from './dishLibrary.ts';
import { nameKey } from './nameKey.ts';

/** Choices inside a dish on an event's menu (sc-3904): what the choice form checks before it sends, when it saves as a draft, and what Add a choice and Remove… do. */

export interface ChoiceOptionForm {
  key: string;
  id: string | null;
  name: string;
  allergens: readonly DishAllergen[];
  none: boolean;
}

export interface ChoiceForm {
  question: string;
  options: readonly ChoiceOptionForm[];
  pick: number;
  required: boolean;
}

export type DraftReason =
  { kind: 'question' } | { kind: 'options' } | { kind: 'pick'; pick: number };

export interface OptionProblems {
  name: 'blank' | 'long' | 'taken' | null;
  contains: 'blank' | null;
  /** A picked option whose name and allergens were cleared: it can't be dropped. */
  picked: boolean;
}

export interface ChoiceProblems {
  question: 'long' | null;
  options: OptionProblems[];
  pick: boolean;
  required: boolean;
  staysFinished: DraftReason[] | null;
}

type ChoiceLike = Pick<MenuDishChoice, 'question' | 'pick'> & { options: readonly unknown[] };

export function draftReasons(choice: ChoiceLike): DraftReason[] {
  const reasons: DraftReason[] = [];
  if (choice.question.trim() === '') reasons.push({ kind: 'question' });
  const k = choice.options.length;
  if (k < CHOICE_OPTIONS_MINIMUM) reasons.push({ kind: 'options' });
  if (choice.pick >= CHOICE_OPTIONS_MINIMUM && k < choice.pick + 1)
    reasons.push({ kind: 'pick', pick: choice.pick });

  return reasons;
}

export const optionPicked = (option: { picks: number }): boolean => option.picks > 0;

export const choiceAnswered = (choice: Pick<MenuDishChoice, 'options' | 'noneAnswers'>): boolean =>
  choice.noneAnswers > 0 || choice.options.some(optionPicked);

interface DishWithChoices {
  picked: boolean;
  variants: readonly { picked: boolean }[];
  choices: readonly Pick<MenuDishChoice, 'options' | 'noneAnswers'>[];
}

/** Picked as sc-3902 counts it for Remove: the dish's picks, a pick of any of its variants, or an answer to one of its choices. */
export const dishPicked = (dish: DishWithChoices): boolean =>
  dish.picked || dish.variants.some((one) => one.picked) || dish.choices.some(choiceAnswered);

export type AddChoiceOutcome = 'open' | 'limit' | 'picked';

export function addChoiceOutcome(dish: DishWithChoices): AddChoiceOutcome {
  if (dish.choices.length >= CHOICES_PER_DISH_MAXIMUM) return 'limit';
  if (dishPicked(dish)) return 'picked';

  return 'open';
}

export const removeChoiceOutcome = (
  choice: Pick<MenuDishChoice, 'options' | 'noneAnswers'>,
): 'ask' | 'answered' => (choiceAnswered(choice) ? 'answered' : 'ask');

let keys = 0;

function nextKey(): string {
  keys += 1;

  return `o${keys}`;
}

export function blankOptionForm(): ChoiceOptionForm {
  return { key: nextKey(), id: null, name: '', allergens: [], none: false };
}

export function blankChoiceForm(): ChoiceForm {
  return { question: '', options: [blankOptionForm(), blankOptionForm()], pick: 1, required: true };
}

export function choiceFormOf(choice: MenuDishChoice): ChoiceForm {
  return {
    question: choice.question,
    options: choice.options.map((one) => ({
      key: nextKey(),
      id: one.id,
      name: one.name,
      allergens: one.allergens,
      none: one.allergens.length === 0,
    })),
    pick: choice.pick,
    required: choice.required,
  };
}

const isEmpty = (option: ChoiceOptionForm): boolean =>
  dishLength(option.name) === 0 && option.allergens.length === 0 && !option.none;

const isNamed = (option: ChoiceOptionForm): boolean => dishLength(option.name) > 0;

export const namedOptionCount = (form: ChoiceForm): number => form.options.filter(isNamed).length;

export const pickMax = (form: ChoiceForm): number => Math.max(1, namedOptionCount(form) - 1);

function pickedIn(was: MenuDishChoice | null, id: string | null): boolean {
  if (was == null || id == null) return false;
  const option = was.options.find((one) => one.id === id);

  return option != null && optionPicked(option);
}

/** What the form would save: empty blocks dropped, except a picked option's, which the refusals keep. */
export function keptOptions(form: ChoiceForm, was: MenuDishChoice | null): ChoiceOptionForm[] {
  return form.options.filter((one) => !isEmpty(one) || pickedIn(was, one.id));
}

export const formDraftReasons = (form: ChoiceForm, was: MenuDishChoice | null): DraftReason[] =>
  draftReasons({ question: form.question, options: keptOptions(form, was), pick: form.pick });

/** Only what is certain is refused; an unfinished choice saves as a draft unless guests have answered it. */
export function choiceProblems(form: ChoiceForm, was: MenuDishChoice | null): ChoiceProblems {
  const answered = was != null && choiceAnswered(was);
  const reasons = formDraftReasons(form, was);

  return {
    question: dishLength(form.question) > CHOICE_QUESTION_MAXIMUM ? 'long' : null,
    options: form.options.map((one, at): OptionProblems => {
      const length = dishLength(one.name);
      const above = form.options.slice(0, at).filter((other) => !isEmpty(other));
      const cleared = isEmpty(one) && pickedIn(was, one.id);
      const stated = one.allergens.length > 0 || one.none;

      return {
        name:
          length === 0
            ? stated
              ? 'blank'
              : null
            : length > CHOICE_OPTION_NAME_MAXIMUM
              ? 'long'
              : above.some((other) => nameKey(other.name) === nameKey(one.name))
                ? 'taken'
                : null,
        contains: length > 0 && !stated ? 'blank' : null,
        picked: cleared,
      };
    }),
    pick: answered && form.pick !== was.pick,
    required: answered && form.required && !was.required && was.noneAnswers > 0,
    staysFinished: answered && reasons.length > 0 ? reasons : null,
  };
}

export const hasChoiceProblem = (problems: ChoiceProblems): boolean =>
  problems.question != null ||
  problems.options.some((one) => one.name != null || one.contains != null || one.picked) ||
  problems.pick ||
  problems.required ||
  problems.staysFinished != null;

export const savesAsDraft = (form: ChoiceForm, was: MenuDishChoice | null): boolean =>
  !(was != null && choiceAnswered(was)) && formDraftReasons(form, was).length > 0;

export const choiceBlockId = (key: string): string => `ch-${key}`;

export function firstChoiceProblem(
  problems: ChoiceProblems,
  form: ChoiceForm,
  was: MenuDishChoice | null,
): { id: string; open: string | null } | null {
  if (problems.question != null) return { id: 'ch-question', open: null };
  for (const [at, one] of problems.options.entries()) {
    const key = form.options[at]?.key ?? '';
    if (one.picked || one.name != null) return { id: `${choiceBlockId(key)}-name`, open: null };
    if (one.contains != null)
      return { id: `${choiceBlockId(key)}-has-${DISH_ALLERGENS[0] ?? 'gluten'}`, open: key };
  }
  if (problems.pick)
    return { id: was != null && form.pick > was.pick ? 'ch-fewer' : 'ch-more', open: null };
  if (problems.required) return { id: 'ch-required', open: null };
  if (problems.staysFinished != null)
    return { id: form.question.trim() === '' ? 'ch-question' : 'ch-add-option', open: null };

  return null;
}

export function choiceDetailsOf(form: ChoiceForm, was: MenuDishChoice | null): ChoiceDetails {
  return {
    question: form.question.trim(),
    options: keptOptions(form, was).map((one) => ({
      ...(one.id == null ? {} : { id: one.id }),
      name: one.name.trim(),
      allergens: one.none ? [] : DISH_ALLERGENS.filter((code) => one.allergens.includes(code)),
      containsNone: one.none,
    })),
    pick: form.pick,
    required: form.required,
  };
}

export const guestsAnswerItsChoices = (
  dishes: readonly { choices: readonly unknown[] }[],
): boolean => dishes.length === 1 && (dishes[0]?.choices.length ?? 0) > 0;

export const courseReady = (course: { dishes: readonly { offered: boolean }[] }): boolean =>
  course.dishes.some((one) => one.offered);

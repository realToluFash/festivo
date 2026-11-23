import type {
  CourseDefault,
  MenuCourse,
  MenuDish,
  MenuDishChoice,
  MenuDishVariant,
  SentCourseDefault,
} from '@soirely/api-client';
import type { TFunction } from 'i18next';

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
  /** The stored date has passed: the date is locked and the pair can't be cleared. */
  locked: boolean;
}

export const CLEARED: DefaultForm = { dishId: null, variantId: null, options: {}, chooseBy: '' };

/** The dishes guests can see: a dish waiting on a draft choice is never the default. */
export const offeredDishes = (course: MenuCourse): readonly MenuDish[] =>
  course.dishes.filter((one) => one.offered);

export const everyoneVariants = (dish: MenuDish): readonly MenuDishVariant[] =>
  dish.variants.filter((one) => one.for === 'everyone');

export const hasChildrenOnly = (dish: MenuDish): boolean =>
  dish.variants.some((one) => one.for === 'children');

export const requiredChoices = (dish: MenuDish): readonly MenuDishChoice[] =>
  dish.choices.filter((one) => one.required && !one.draft);

const dishOf = (course: MenuCourse, id: string | null): MenuDish | null =>
  course.dishes.find((one) => one.id === id) ?? null;

export function defaultForm(course: MenuCourse): DefaultForm {
  const pick = course.default;
  const dish = dishOf(course, pick?.dish ?? null);
  if (pick == null || dish == null) return CLEARED;

  return {
    dishId: dish.id,
    variantId: pick.variant,
    options: Object.fromEntries(
      requiredChoices(dish).map((choice) => [
        choice.id,
        choice.options.filter((one) => pick.options.includes(one.id)).map((one) => one.id),
      ]),
    ),
    chooseBy: pick.chooseBy,
  };
}

/** A dish with one Everyone variant has it selected already. */
export function withDish(
  course: MenuCourse,
  form: DefaultForm,
  dishId: string | null,
): DefaultForm {
  if (dishId === form.dishId) return form;
  const dish = dishOf(course, dishId);
  const only = dish == null ? [] : everyoneVariants(dish);

  return {
    ...form,
    dishId,
    variantId: only.length === 1 ? (only[0]?.id ?? null) : null,
    options: {},
  };
}

export function checkDefault(
  form: DefaultForm,
  course: MenuCourse,
  dates: DefaultDates,
  t: TFunction,
  day: (date: string) => string,
): DefaultErrors {
  const dish = dishOf(course, form.dishId);
  const date = form.chooseBy.trim();
  const errors: DefaultErrors = { dish: null, variant: null, choices: {}, chooseBy: null };
  if (dish == null && date === '') return errors;
  if (dish == null) return { ...errors, dish: t('courseDefault.onlyDate') };
  const everyone = everyoneVariants(dish);

  return {
    dish: null,
    variant:
      dish.variants.length > 0 && !everyone.some((one) => one.id === form.variantId)
        ? t('courseDefault.noVariant')
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
              ? t('courseDefault.answer', { question: choice.question })
              : t('courseDefault.chooseFor', { count: choice.pick, question: choice.question }),
          ],
        ];
      }),
    ),
    chooseBy: dateProblem(date, dates, t, day),
  };
}

function dateProblem(
  date: string,
  dates: DefaultDates,
  t: TFunction,
  day: (date: string) => string,
): string | null {
  if (date === '') return t('courseDefault.onlyDefault');
  if (dates.locked) return null;
  if (date >= dates.event) return t('courseDefault.afterEvent', { date: day(dates.event) });
  if (date !== dates.stored && date < dates.today)
    return t('courseDefault.past', { date: day(dates.today) });

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
  course: MenuCourse,
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

export function sentDefault(form: DefaultForm, course: MenuCourse): SentCourseDefault {
  const dish = dishOf(course, form.dishId);
  const chooseBy = form.chooseBy.trim() === '' ? null : form.chooseBy.trim();
  if (dish == null) return { dish: null, chooseBy };

  return {
    dish: dish.id,
    variant: everyoneVariants(dish).some((one) => one.id === form.variantId)
      ? form.variantId
      : null,
    options: requiredChoices(dish).flatMap((choice) =>
      choice.options
        .filter((one) => (form.options[choice.id] ?? []).includes(one.id))
        .map((one) => one.id),
    ),
    chooseBy,
  };
}

/** "Jollof rice, Chicken, Plantain": the dish, its variant and its options, joined with commas. */
export function pickWords(
  course: MenuCourse,
  pick: Pick<CourseDefault, 'dish' | 'variant' | 'options'>,
): string {
  const dish = dishOf(course, pick.dish);
  if (dish == null) return '';
  const variant = dish.variants.find((one) => one.id === pick.variant);
  const options = dish.choices.flatMap((choice) =>
    choice.options.filter((one) => pick.options.includes(one.id)).map((one) => one.name),
  );

  return [dish.name, variant?.name, ...options].filter((one) => one != null).join(', ');
}

export const isDefaultDish = (course: MenuCourse, dishId: string): boolean =>
  course.default?.dish === dishId;

export const isDefaultVariant = (course: MenuCourse, dishId: string, variantId: string): boolean =>
  isDefaultDish(course, dishId) && course.default?.variant === variantId;

export const isDefaultOption = (course: MenuCourse, dishId: string, optionId: string): boolean =>
  isDefaultDish(course, dishId) && (course.default?.options ?? []).includes(optionId);

/** The defaulted people See picks counts on a course: each person once, on the default's dish row. */
export function givenOn(
  rows: readonly { kind: string; dish: string | null; id: string; defaulted: number }[],
): number {
  return rows.filter((row) => row.kind === 'dish').reduce((sum, row) => sum + row.defaulted, 0);
}

export function dayWords(date: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`));
}

export function dayIn(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone,
  }).format(at);
}

export interface Move {
  move: number;
  back: number;
  from: string;
  to: string;
  on: string;
}

export function moveWords(
  t: TFunction,
  move: Move,
): { title: string; body: string; go: string; done: string } {
  const back =
    move.back === 0 ? '' : ` ${t('courseDefault.goBack', { count: move.back, dish: move.to })}`;
  const backNow = move.back === 0 ? '' : ` ${t('courseDefault.backNow', { count: move.back })}`;

  return move.move === 0
    ? {
        title: t('courseDefault.changeTitle', { dish: move.to }),
        body:
          t('courseDefault.changeBody', { was: move.from, date: move.on, dish: move.to }) + back,
        go: t('courseDefault.changeGo'),
        done: t('courseDefault.changed', { dish: move.to }) + backNow,
      }
    : {
        title: t('courseDefault.moveTitle', { count: move.move, dish: move.to }),
        body:
          t('courseDefault.moveBody', {
            count: move.move,
            was: move.from,
            date: move.on,
            dish: move.to,
          }) + back,
        go: t('courseDefault.moveGo', { count: move.move }),
        done: t('courseDefault.moved', { count: move.move, dish: move.to }) + backNow,
      };
}

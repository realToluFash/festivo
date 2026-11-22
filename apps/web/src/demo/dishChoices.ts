import type { Allergen } from './guestKitchenWords.ts';
import {
  type VariantPicker,
  type WithVariants,
  sameHint,
  variantPicked,
  variantsOf,
} from './dishVariants.ts';
import {
  type Contains,
  type DishAllergen,
  type Lang,
  DISH_ALLERGENS,
  LW,
  allergenName,
  lengthOf,
  listOf,
  sameName,
} from './menuLibrary.ts';

/** sc-3904's choices inside a dish (board Menu, page e32): a question guests answer, with options that don't change what the dish is. */
export const CHOICE_MAX = 3;
export const OPTION_MAX = 8;
export const OPTION_MIN = 2;
export const QUESTION_MAX = 80;
export const OPTION_NAME_MAX = 60;

export interface ChoiceOption {
  id: string;
  name: string;
  contains: Contains;
  /** The stored answers that name this option, each with the allergies its person has recorded (sc-3777). */
  pickers: readonly VariantPicker[];
}

export interface Choice {
  id: string;
  question: string;
  options: readonly ChoiceOption[];
  pick: number;
  required: boolean;
  noneAnswers: number;
}

export interface WithChoices extends WithVariants {
  pickers: readonly VariantPicker[];
  choices?: readonly Choice[];
}

export const CHW = {
  addChoice: 'Add a choice',
  addChoiceAria: (dish: string) => `Add a choice to ${dish}`,
  eyebrow: (dish: string) => `${dish} · add a choice`,
  addTitle: 'Add a choice',
  editTitle: (question: string) => `Edit ${question}`,
  finishTitle: (question: string) => `Finish ${question}`,
  notPriced: '[The options don’t change what the dish is, and they aren’t priced.]',
  willBe: (k: number) => `This will be choice ${k} of at most 3.`,
  applyTo: (n: number) =>
    n === 2 ? 'The options apply to both variants.' : `The options apply to all ${n} variants.`,
  variantFirst:
    '[Guests pick the variant first. An option’s allergens add to the variant they picked.]',
  question: 'Question guests see',
  options: 'Options',
  option: (n: number) => `Option ${n}`,
  name: 'Name',
  removeOption: (name: string) => `Remove ${name}`,
  setAllergens: 'Set allergens',
  changeAllergens: 'Change allergens',
  addOption: 'Add an option',
  pickExactly: 'Guests pick exactly',
  oneFewer: 'One fewer',
  oneMore: 'One more',
  pickRange: (k: number, max: number) =>
    max <= 1
      ? `Of ${k} options. Guests can pick exactly 1.`
      : `Of ${k} options. Guests can pick exactly 1 to ${max}.`,
  pickShort: (k: number) => `[Of ${k} named options. A choice needs at least 2.]`,
  required: 'Required',
  optionalHelp: 'Guests also see None for me.',
  draftBox: (variants: number) =>
    `Saving now keeps it as a draft. Guests can’t choose this dish${inVariants(variants)} until it’s finished.`,
  noQuestion: '[Add the question guests see.]',
  fewOptions: '[Add at least 2 options.]',
  pickTooMany: (n: number) =>
    `[Guests pick exactly ${n}, so the choice needs at least ${n + 1} options.]`,
  questionLong: '[Shorten the question to 80 characters or fewer.]',
  nameBlank: '[Enter the option’s name.]',
  nameLong: 'Shorten the name to 60 characters or fewer.',
  nameTwice: 'Each option needs its own name.',
  optionsLimit: 'A choice can have at most 8 options.',
  choicesLimit: 'A dish can have at most 3 choices.',
  dishPicked: 'Guests have picked this dish.',
  answered: 'Guests have answered this choice.',
  optionPicked: 'Guests have picked this option.',
  answeredDraft: '[Guests have answered this choice, so it has to stay finished.]',
  addChoiceSave: 'Add choice',
  saveChoice: 'Save choice',
  saveDraft: 'Save as a draft',
  added: (question: string, dish: string) => `“${question}” added to ${dish}.`,
  saved: (question: string) => `“${question}” saved.`,
  draftSaved: (named: string, dish: string) =>
    `[${named} saved as a draft. Guests can’t choose ${dish} until it’s finished.]`,
  removed: (question: string, dish: string) => `“${question}” removed from ${dish}.`,
  noQuestionYet: (k: number) => `[Choice ${k}, no question yet]`,
  pickLine: (n: number, k: number, required: boolean) =>
    `Guests pick exactly ${n} of ${k} options · ${required ? 'Required' : 'Optional, so guests also see None for me'}`,
  draftTag: 'Draft',
  draftLine: 'Guests can’t choose this dish until it’s finished.',
  notOffered: 'Not offered to guests',
  hiddenIn: (n: number) =>
    n === 2
      ? 'Hidden in both variants until the draft choice is finished.'
      : `Hidden in all ${n} variants until the draft choice is finished.`,
  everyVariant: 'Applies to every variant',
  plusOptions: 'Guests see these allergens plus those of the options they pick.',
  plusVariantOptions:
    'Guests see the allergens of the variant they pick plus those of the options they pick.',
  variantsHead: 'Variants · guests pick one first',
  choicesHead: 'Choices · asked after the variant',
  addedToVariant: (line: string) => `${line}, added to the variant’s`,
  prep: (parts: string) => `Kitchen prep: ${parts}`,
  fromPicks: 'From guests’ picks.',
  acrossVariants: (n: number) =>
    n === 2
      ? 'One total per option, across both variants. From guests’ picks.'
      : `One total per option, across all ${n} variants. From guests’ picks.`,
  edit: 'Edit',
  finish: 'Finish',
  remove: 'Remove…',
  editAria: (question: string) => `Edit ${question}`,
  finishAria: (question: string) => `Finish ${question}`,
  removeAria: (question: string) => `Remove ${question}…`,
  actionsFor: (question: string) => `Actions for ${question}`,
  removeAsk: (question: string, dish: string) => `Remove “${question}” from ${dish}?`,
  keepIt: 'Keep it',
  removeChoice: 'Remove choice',
  answerChoices: (dish: string) => `Everyone gets ${dish}. Guests answer its choices.`,
  noFinishedDish: 'No finished dish · not shown to guests',
} as const;

function inVariants(variants: number): string {
  if (variants === 0) return '';

  return variants === 2 ? ' in either variant' : ' in any variant';
}

export const choicesOf = (dish: Pick<WithChoices, 'choices'>): readonly Choice[] =>
  dish.choices ?? [];
export const hasChoices = (dish: Pick<WithChoices, 'choices'>): boolean =>
  choicesOf(dish).length > 0;

export const optionPicked = (option: ChoiceOption): boolean => option.pickers.length > 0;

export const choiceAnswered = (choice: Choice): boolean =>
  choice.noneAnswers > 0 || choice.options.some(optionPicked);

export function draftReasons(choice: Pick<Choice, 'question' | 'options' | 'pick'>): string[] {
  const reasons: string[] = [];
  if (choice.question.trim() === '') reasons.push(CHW.noQuestion);
  const k = choice.options.length;
  if (k < OPTION_MIN) reasons.push(CHW.fewOptions);
  if (choice.pick >= OPTION_MIN && k < choice.pick + 1) reasons.push(CHW.pickTooMany(choice.pick));

  return reasons;
}

export const isDraft = (choice: Choice): boolean => draftReasons(choice).length > 0;

export const dishHidden = (dish: Pick<WithChoices, 'choices'>): boolean =>
  choicesOf(dish).some(isDraft);

export const choicesAnswered = (dish: Pick<WithChoices, 'choices'>): boolean =>
  choicesOf(dish).some(choiceAnswered);

/** Picked as sc-3902 counts it for Remove: the dish's picks, a pick of any variant, or an answer to one of its choices. */
export const dishPicked = (dish: WithChoices): boolean =>
  dish.pickers.length > 0 || variantsOf(dish).some(variantPicked) || choicesAnswered(dish);

export const questionOf = (choice: Choice, at: number): string =>
  choice.question.trim() === '' ? CHW.noQuestionYet(at + 1) : `“${choice.question}”`;

export type AddChoiceOutcome = 'open' | 'limit' | 'picked';

/** A 4th is refused whatever the picks, so the limit is said first. */
export function addChoiceOutcome(dish: WithChoices): AddChoiceOutcome {
  if (choicesOf(dish).length >= CHOICE_MAX) return 'limit';
  if (dishPicked(dish)) return 'picked';

  return 'open';
}

export const removeChoiceOutcome = (choice: Choice): 'ask' | 'answered' =>
  choiceAnswered(choice) ? 'answered' : 'ask';

export function pickLine(choice: Choice): string {
  return CHW.pickLine(choice.pick, choice.options.length, choice.required);
}

const lower = (name: string): string => name.toLocaleLowerCase('en');

export function kitchenPrep(choice: Choice): string | null {
  if (!choice.options.some(optionPicked)) return null;

  return CHW.prep(
    choice.options.map((one) => `${one.pickers.length} ${lower(one.name)}`).join(', '),
  );
}

export function optionContainsLine(contains: Contains, lang: Lang, withVariants: boolean): string {
  if (contains == null) return LW.notStated;
  if (contains === 'none') return LW.containsNone;
  const line = LW.contains(
    DISH_ALLERGENS.filter((code) => contains.includes(code))
      .map((code) => allergenName(code, lang))
      .join(' · '),
  );

  return withVariants ? CHW.addedToVariant(line) : line;
}

export function courseHint(dishes: readonly WithChoices[]): string | null {
  if (dishes.length !== 1) return null;
  const dish = dishes[0] as WithChoices;

  return sameHint(dishes) ?? (hasChoices(dish) ? CHW.answerChoices(dish.name) : null);
}

export interface OptionForm {
  key: string;
  id: string | null;
  name: string;
  allergens: readonly DishAllergen[];
  none: boolean;
}

export interface ChoiceForm {
  question: string;
  options: readonly OptionForm[];
  pick: number;
  required: boolean;
}

let keys = 0;

export function blankOption(): OptionForm {
  keys += 1;

  return { key: `o${keys}`, id: null, name: '', allergens: [], none: false };
}

export function blankChoice(): ChoiceForm {
  return { question: '', options: [blankOption(), blankOption()], pick: 1, required: true };
}

export function choiceForm(choice: Choice): ChoiceForm {
  return {
    question: choice.question,
    options: choice.options.map((one) => {
      keys += 1;

      return {
        key: `o${keys}`,
        id: one.id,
        name: one.name,
        allergens: Array.isArray(one.contains) ? one.contains : [],
        none: one.contains === 'none',
      };
    }),
    pick: choice.pick,
    required: choice.required,
  };
}

const isEmpty = (option: OptionForm): boolean =>
  lengthOf(option.name) === 0 && option.allergens.length === 0 && !option.none;

const isNamed = (option: OptionForm): boolean => lengthOf(option.name) > 0;

export const namedCount = (form: ChoiceForm): number => form.options.filter(isNamed).length;

export const pickMax = (form: ChoiceForm): number => Math.max(1, namedCount(form) - 1);

export function stepperHint(form: ChoiceForm): string {
  const k = namedCount(form);

  return k < OPTION_MIN ? CHW.pickShort(k) : CHW.pickRange(k, pickMax(form));
}

export const optionContains = (option: OptionForm): Contains =>
  option.none ? 'none' : option.allergens.length > 0 ? option.allergens : null;

export interface OptionErrors {
  name: string | null;
  contains: string | null;
  picked: string | null;
}

export interface ChoiceErrors {
  question: string | null;
  options: OptionErrors[];
  pick: string | null;
  required: string | null;
  staysFinished: string[] | null;
}

/** What the form would save: empty blocks dropped, except a picked option's, which the refusals keep. */
export function keptOptions(form: ChoiceForm, was: Choice | null): OptionForm[] {
  return form.options.filter((one) => !isEmpty(one) || pickedIn(was, one.id));
}

function pickedIn(was: Choice | null, id: string | null): boolean {
  if (was == null || id == null) return false;
  const option = was.options.find((one) => one.id === id);

  return option != null && optionPicked(option);
}

export function formDraftReasons(form: ChoiceForm, was: Choice | null): string[] {
  return draftReasons({
    question: form.question,
    options: keptOptions(form, was).map((one) => ({
      id: one.key,
      name: one.name,
      contains: optionContains(one),
      pickers: [],
    })),
    pick: form.pick,
  });
}

/** Checked before it sends. Only what is certain is refused; an unfinished choice saves as a draft unless guests have answered it. */
export function checkChoice(form: ChoiceForm, was: Choice | null): ChoiceErrors {
  const answered = was != null && choiceAnswered(was);
  const options = form.options.map((one, at): OptionErrors => {
    const length = lengthOf(one.name);
    const above = form.options.slice(0, at).filter((other) => !isEmpty(other));
    const cleared = isEmpty(one) && pickedIn(was, one.id);
    const stated = one.allergens.length > 0 || one.none;

    return {
      name:
        length === 0
          ? stated && !cleared
            ? CHW.nameBlank
            : null
          : length > OPTION_NAME_MAX
            ? CHW.nameLong
            : above.some((other) => sameName(other.name, one.name))
              ? CHW.nameTwice
              : null,
      contains: length > 0 && !stated ? LW.containsBlank : null,
      picked: cleared ? CHW.optionPicked : null,
    };
  });
  const reasons = formDraftReasons(form, was);

  return {
    question: lengthOf(form.question) > QUESTION_MAX ? CHW.questionLong : null,
    options,
    pick: was != null && answered && form.pick !== was.pick ? CHW.answered : null,
    required:
      was != null && answered && form.required && !was.required && was.noneAnswers > 0
        ? CHW.answered
        : null,
    staysFinished: answered && reasons.length > 0 ? reasons : null,
  };
}

export const savesAsDraft = (form: ChoiceForm, was: Choice | null): boolean =>
  !(was != null && choiceAnswered(was)) && formDraftReasons(form, was).length > 0;

export const blockId = (key: string): string => `ch-${key}`;

export function firstChoiceProblem(
  errors: ChoiceErrors,
  form: ChoiceForm,
  was: Choice | null,
): { id: string; open: string | null } | null {
  if (errors.question != null) return { id: 'ch-question', open: null };
  for (const [at, one] of errors.options.entries()) {
    const key = form.options[at]?.key ?? '';
    if (one.picked != null) return { id: `${blockId(key)}-name`, open: null };
    if (one.name != null) return { id: `${blockId(key)}-name`, open: null };
    if (one.contains != null) return { id: `${blockId(key)}-has-${DISH_ALLERGENS[0]}`, open: key };
  }
  if (errors.pick != null)
    return { id: was != null && form.pick > was.pick ? 'ch-fewer' : 'ch-more', open: null };
  if (errors.required != null) return { id: 'ch-required', open: null };
  if (errors.staysFinished != null) {
    if (form.question.trim() === '') return { id: 'ch-question', open: null };

    return { id: 'ch-add-option', open: null };
  }

  return null;
}

export const hasProblem = (errors: ChoiceErrors): boolean =>
  errors.question != null ||
  errors.options.some((one) => one.name != null || one.contains != null || one.picked != null) ||
  errors.pick != null ||
  errors.required != null ||
  errors.staysFinished != null;

let made = 0;

export function savedChoice(form: ChoiceForm, was: Choice | null): Choice {
  made += 1;

  return {
    id: was?.id ?? `ch-new-${made}`,
    question: form.question.trim(),
    options: keptOptions(form, was).map((one) => {
      made += 1;
      const before = was?.options.find((option) => option.id === one.id);

      return {
        id: one.id ?? `op-new-${made}`,
        name: one.name.trim(),
        contains: optionContains(one),
        pickers: before?.pickers ?? [],
      };
    }),
    pick: form.pick,
    required: form.required,
    noneAnswers: was?.noneAnswers ?? 0,
  };
}

/** Until sc-3913: one line per picked option whose added allergens somebody who picked it has recorded. Each person counts once; an Other allergy never matches. */
export function optionAllergenLines(was: Choice, next: Choice, lang: Lang = 'en'): string[] {
  return next.options.flatMap((option) => {
    const before = was.options.find((one) => one.id === option.id);
    if (before == null || !Array.isArray(option.contains)) return [];
    const had: readonly DishAllergen[] = Array.isArray(before.contains) ? before.contains : [];
    const added = option.contains.filter((code) => !had.includes(code));
    const counted = before.pickers.filter((one) =>
      added.some((code) => one.includes(code as Allergen)),
    );
    if (counted.length === 0) return [];
    const named = DISH_ALLERGENS.filter(
      (code) => added.includes(code) && counted.some((one) => one.includes(code as Allergen)),
    ).map((code) => lower(allergenName(code, lang)));
    const who =
      counted.length === 1
        ? `1 guest who picked ${option.name} has`
        : `${counted.length} guests who picked ${option.name} have`;

    return [`[${who} ${listOf(named)} recorded, and nobody has told them.]`];
  });
}

export type ChoiceMode = 'add' | 'edit';

export function choiceSaveLabel(mode: ChoiceMode, draft: boolean): string {
  if (draft) return CHW.saveDraft;

  return mode === 'add' ? CHW.addChoiceSave : CHW.saveChoice;
}

export function withSavedChoice<D extends WithChoices>(
  dish: D,
  mode: ChoiceMode,
  choiceId: string | null,
  form: ChoiceForm,
  lang: Lang,
): { dish: D; said: string; more: string[] } {
  const all = choicesOf(dish);
  const was = mode === 'edit' ? (all.find((one) => one.id === choiceId) ?? null) : null;
  const next = savedChoice(form, was);
  const choices = was == null ? [...all, next] : all.map((one) => (one.id === was.id ? next : one));
  const at = choices.findIndex((one) => one.id === next.id);
  const named = next.question === '' ? `Choice ${at + 1}` : `“${next.question}”`;
  const said = isDraft(next)
    ? CHW.draftSaved(named, dish.name)
    : was == null
      ? CHW.added(next.question, dish.name)
      : CHW.saved(next.question);

  return {
    dish: { ...dish, choices },
    said,
    more: was == null ? [] : optionAllergenLines(was, next, lang),
  };
}

export function removeChoice<D extends WithChoices>(dish: D, choice: Choice): D {
  return { ...dish, choices: choicesOf(dish).filter((one) => one.id !== choice.id) };
}

export type ChoiceAsk = { choiceId: string; kind: 'ask' | 'answered' };

function many(n: number, picker: VariantPicker = []): VariantPicker[] {
  return Array.from({ length: n }, () => picker);
}

export function option(
  id: string,
  name: string,
  contains: Contains,
  pickers: readonly VariantPicker[] = [],
): ChoiceOption {
  return { id, name, contains, pickers };
}

export function choice(
  id: string,
  question: string,
  options: readonly ChoiceOption[],
  more: Partial<Choice> = {},
): Choice {
  return { id, question, options, pick: 1, required: true, noneAnswers: 0, ...more };
}

/** "And a side?", answered: 41 plantain, 33 garden salad, 12 moi moi; 2 who picked garden salad have celery recorded, 3 who picked moi moi crustaceans, nobody milk. */
export function sideChoice(picked = true, id = 'c-side'): Choice {
  return choice(id, 'And a side?', [
    option(
      `${id}-plantain`,
      'Plantain',
      'none',
      picked ? [...many(2, ['mustard']), ...many(39)] : [],
    ),
    option(
      `${id}-salad`,
      'Garden salad',
      ['mustard'],
      picked ? [...many(2, ['celery']), ['other'], ...many(30)] : [],
    ),
    option(
      `${id}-moimoi`,
      'Moi moi',
      ['eggs'],
      picked ? [['crustaceans', 'sesame'], ...many(2, ['crustaceans']), ...many(9)] : [],
    ),
  ]);
}

export function sauceChoice(id = 'c-sauce'): Choice {
  return choice(
    id,
    'And a sauce?',
    [
      option(`${id}-shito`, 'Shito', ['fish', 'crustaceans']),
      option(`${id}-ata`, 'Ata dindin', 'none'),
    ],
    { required: false },
  );
}

export function optionalSide(): Choice {
  return { ...sideChoice(true), required: false, noneAnswers: 4 };
}

export function draftChoice(id = 'c-draft', question = ''): Choice {
  return choice(id, question, [option(`${id}-a`, 'Plantain', 'none')]);
}

export function thirdChoice(): Choice {
  return choice('c-drink', 'And to drink?', [
    option('c-drink-zobo', 'Zobo', 'none'),
    option('c-drink-chapman', 'Chapman', ['sulphites']),
  ]);
}

export function eightOptions(): readonly OptionForm[] {
  return [
    'Plantain',
    'Garden salad',
    'Moi moi',
    'Coleslaw',
    'Fried yam',
    'Beans',
    'Ofada rice',
    'Steamed greens',
  ].map((name) => ({ ...blankOption(), name, none: true }));
}

import { type Allergen, type Diet, DIETS, GUEST_KITCHEN_NAMES } from './guestKitchenWords.ts';
import type { DemoLink } from './settings.ts';

/** sc-3901's Menu library at a desk (board MenuLibrary, page e32): the organisation's dishes and what each contains. */
export const LIBRARY_PATH = '/demo/menu-library';

export const NAME_MAX = 120;
export const DESC_MAX = 300;

export const DISH_ALLERGENS = [
  'gluten',
  'crustaceans',
  'eggs',
  'fish',
  'peanuts',
  'soybeans',
  'milk',
  'tree_nuts',
  'celery',
  'mustard',
  'sesame',
  'sulphites',
  'lupin',
  'molluscs',
] as const satisfies readonly Allergen[];
export type DishAllergen = (typeof DISH_ALLERGENS)[number];

export { DIETS };
export type { Diet };

export const allergenName = (code: DishAllergen, lang: Lang): string =>
  GUEST_KITCHEN_NAMES[lang].allergens[code];
export const dietName = (code: Diet, lang: Lang): string => GUEST_KITCHEN_NAMES[lang].diets[code];

export type Contains = readonly DishAllergen[] | 'none' | null;

export interface Price {
  minor: number;
  currency: string;
}

export interface LibDish {
  id: string;
  name: string;
  desc: string;
  contains: Contains;
  diets: readonly Diet[];
  used: boolean;
  archived: boolean;
  price: Price | null;
}

export const CURRENCIES = ['NGN', 'GHS', 'GBP', 'EUR', 'USD', 'JPY', 'XOF', 'KWD'] as const;
export const ORG_CURRENCY = 'NGN';

export type Lang = 'en' | 'fr' | 'es' | 'pt';
export const LANGS: readonly Lang[] = ['en', 'fr', 'es', 'pt'];

export const LW = {
  title: 'Menu library',
  sub: 'The dishes you serve, and what each one contains. An event’s menu picks from here.',
  dishes: 'Dishes',
  archived: 'Archived',
  tabs: 'Dishes or archived',
  find: 'Find a dish',
  clearFind: 'Clear the search',
  suitableFor: 'Suitable for',
  count: (n: number) => (n === 1 ? '1 dish' : `${n} dishes`),
  countOf: (shown: number, all: number) => `${shown} of ${all === 1 ? '1 dish' : `${all} dishes`}`,
  clearAll: 'Clear the search and filters',
  noMatch: (q: string) => `No dish name has “${q}” in it.`,
  noMatchDiets: 'No dish is suitable for every diet picked.',
  noMatchBoth: (q: string) =>
    `No dish name has “${q}” in it and is suitable for every diet picked.`,
  emptyTitle: 'No dishes yet',
  emptyBody:
    'Add each dish once, with what it contains. Every event’s menu then picks from this library.',
  noArchived: 'Nothing is archived. A dish an event has used is archived instead of deleted.',
  addDish: 'Add dish',
  contains: (names: string) => `Contains ${names}`,
  containsNone: 'Contains none of the 14 allergens',
  notStated: 'Allergens not stated',
  usedBy: 'Used by an event',
  actionsFor: (name: string) => `Actions for ${name}`,
  edit: 'Edit',
  archive: 'Archive',
  restore: 'Restore',
  delete: 'Delete…',
  editAria: (name: string) => `Edit ${name}`,
  archiveAria: (name: string) => `Archive ${name}`,
  restoreAria: (name: string) => `Restore ${name}`,
  deleteAria: (name: string) => `Delete ${name}…`,
  deleteAsk: (name: string) => `Delete ${name}? No event uses it, and it cannot be undone.`,
  deleteDish: 'Delete dish',
  keepIt: 'Keep it',
  saved: (name: string) => `${name} saved.`,
  added: (name: string) => `${name} added.`,
  archivedLine: (name: string) => `${name} archived. It is under Archived.`,
  restored: (name: string) => `${name} restored.`,
  deleted: (name: string) => `${name} deleted.`,
  failedAction: (name: string) =>
    `Nothing was changed: ${name} was not archived. Check your connection, then press Archive again.`,
  failedSave: 'Nothing was saved. Check your connection, then press Save dish again.',
  lock: 'Your role, Coordinator, can see the menu library but not change it. Someone whose role can change Menu can.',
  loading: 'Loading the menu library…',
  refreshing: 'Refreshing…',
  forbiddenTitle: 'You do not have access to this',
  forbiddenBody: 'Your role does not include the permission this page needs.',
  forbiddenBack: 'Back to the dashboard',
  gone: 'This dish is not available',
  goneBody: 'Someone else deleted it while it was open. Nothing you typed was saved.',
  close: 'Close',
  backToList: 'Back to the menu library',
  name: 'Name',
  desc: 'Description',
  optional: 'Optional',
  counter: (n: number, max: number) => `${n} of ${max}`,
  containsLegend: 'Contains',
  containsHelp: 'Tick each allergen in the dish, as the 14 of food law name them.',
  none: 'Contains none of these',
  dietsLegend: 'Suitable for',
  price: 'Last price',
  amount: 'Amount',
  currency: 'Currency',
  chooseCurrency: 'Choose a currency',
  priceHint:
    'Only people who can see Budget see this. Added to an event in the same currency, it fills the event’s cost. Nothing is converted.',
  notStatedLine:
    'Allergens not stated. Until this has an answer, the dish is never offered as safe to a guest with an allergy.',
  ownCopy: 'Events already using this dish keep their own copy.',
  save: 'Save dish',
  cancel: 'Cancel',
  addAnyway: 'Add anyway',
  saveAnyway: 'Save anyway',
  duplicate: (name: string) => `There is already a dish called ${name}.`,
  underArchived: 'It is under Archived.',
  nameBlank: 'Enter the dish’s name.',
  nameLong: 'Shorten the name to 120 characters or fewer.',
  descLong: 'Shorten the description to 300 characters or fewer.',
  containsBlank: 'Tick what it contains, or Contains none of these.',
  priceWrong: (example: string) => `Enter the last price as a number, like ${example}.`,
  currencyBlank: 'Choose a currency.',
  vegetarianFish: 'Vegetarian dishes cannot contain fish, crustaceans or molluscs.',
  veganMilk: 'Vegan dishes cannot contain milk or eggs.',
  veganFish: 'Vegan dishes cannot contain fish, crustaceans or molluscs.',
  veganBoth: 'Vegan dishes cannot contain milk, eggs, fish, crustaceans or molluscs.',
} as const;

const fold = (text: string): string =>
  text.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('en').trim();

export const sameName = (a: string, b: string): boolean => fold(a) === fold(b);

const collator = new Intl.Collator('en', { sensitivity: 'base' });

export function byName(dishes: readonly LibDish[]): LibDish[] {
  return dishes.slice().sort((a, b) => collator.compare(a.name, b.name));
}

/** Find a dish matches the name only, ignoring case and accents; the diet chips combine, so a dish shows only when suitable for every one picked. */
export function shownDishes(
  dishes: readonly LibDish[],
  q: string,
  diets: readonly Diet[],
): LibDish[] {
  const wanted = fold(q);

  return byName(dishes).filter(
    (dish) =>
      (wanted === '' || fold(dish.name).includes(wanted)) &&
      diets.every((diet) => dish.diets.includes(diet)),
  );
}

export function noMatchLine(q: string, diets: readonly Diet[]): string {
  if (q.trim() === '') return LW.noMatchDiets;

  return diets.length === 0 ? LW.noMatch(q.trim()) : LW.noMatchBoth(q.trim());
}

export function containsLine(contains: Contains, lang: Lang): string {
  if (contains == null) return LW.notStated;
  if (contains === 'none') return LW.containsNone;

  return LW.contains(
    DISH_ALLERGENS.filter((code) => contains.includes(code))
      .map((code) => allergenName(code, lang))
      .join(' · '),
  );
}

const SEA: readonly DishAllergen[] = ['fish', 'crustaceans', 'molluscs'];
const ANIMAL: readonly DishAllergen[] = ['milk', 'eggs'];

/** The clash lines under Suitable for, one per diet, in the diet list's order; only the rules that are certain. */
export function dietClashes(
  contains: readonly DishAllergen[],
  diets: readonly Diet[],
): { diet: Diet; line: string }[] {
  const sea = contains.some((code) => SEA.includes(code));
  const animal = contains.some((code) => ANIMAL.includes(code));
  const lines: { diet: Diet; line: string }[] = [];

  for (const diet of DIETS) {
    if (!diets.includes(diet)) continue;
    if (diet === 'vegetarian' && sea) lines.push({ diet, line: LW.vegetarianFish });
    if (diet === 'vegan' && (sea || animal))
      lines.push({
        diet,
        line: sea && animal ? LW.veganBoth : sea ? LW.veganFish : LW.veganMilk,
      });
  }

  return lines;
}

export function minorDigits(currency: string): number {
  return (
    new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions()
      .maximumFractionDigits ?? 2
  );
}

const MARKS: Record<Lang, { group: string; decimal: string }> = {
  en: { group: ',', decimal: '.' },
  fr: { group: ' ', decimal: ',' },
  es: { group: '.', decimal: ',' },
  pt: { group: '.', decimal: ',' },
};

const escaped = (mark: string): string => mark.replace(/[.]/gu, '\\.');

export type PriceRead = { minor: number } | { wrong: 'blank' | 'number' | 'decimals' };

/** The language's own number format (CLDR): its decimal mark, and its grouping mark only between groups of three; more decimals than the currency's ISO 4217 minor unit are refused, never rounded. */
export function readPrice(typed: string, lang: Lang, currency: string): PriceRead {
  const plain = typed.trim().replace(/[\u00a0\u202f]/gu, ' ');
  if (plain === '') return { wrong: 'blank' };
  const { group, decimal } = MARKS[lang];
  const shape = new RegExp(
    `^(\\d{1,3}(${escaped(group)}\\d{3})+|\\d+)(${escaped(decimal)}(\\d+))?$`,
    'u',
  );
  const found = shape.exec(plain);
  if (found == null) return { wrong: 'number' };
  const whole = (found[1] ?? '').split(group).join('');
  const fraction = found[4] ?? '';
  const digits = minorDigits(currency);
  if (fraction.length > digits) return { wrong: 'decimals' };

  return { minor: Number(whole) * 10 ** digits + Number(fraction.padEnd(digits, '0') || '0') };
}

/** 12.50 written to the currency's minor unit in the language's format: en 12.50, fr 12,50, JPY 12, KWD 12.500. */
export function priceExample(lang: Lang, currency: string): string {
  const digits = minorDigits(currency);

  return new Intl.NumberFormat(lang, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(digits === 0 ? 12 : 12.5);
}

export function typedPrice(price: Price, lang: Lang): string {
  const digits = minorDigits(price.currency);

  return new Intl.NumberFormat(lang, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
    .format(price.minor / 10 ** digits)
    .replace(/[\u00a0\u202f]/gu, ' ');
}

export interface DishForm {
  name: string;
  desc: string;
  allergens: readonly DishAllergen[];
  none: boolean;
  diets: readonly Diet[];
  amount: string;
  currency: string;
}

export interface FormErrors {
  name: string | null;
  desc: string | null;
  contains: string | null;
  clashes: { diet: Diet; line: string }[];
  currency: string | null;
  amount: string | null;
}

export const lengthOf = (text: string): number => [...text.trim()].length;

export function checkDish(form: DishForm, lang: Lang, budget: boolean): FormErrors {
  const name = lengthOf(form.name);
  const amount = form.amount.trim();
  const read =
    budget && amount !== '' && form.currency !== '' ? readPrice(amount, lang, form.currency) : null;

  return {
    name: name === 0 ? LW.nameBlank : name > NAME_MAX ? LW.nameLong : null,
    desc: lengthOf(form.desc) > DESC_MAX ? LW.descLong : null,
    contains: form.allergens.length === 0 && !form.none ? LW.containsBlank : null,
    clashes: dietClashes(form.allergens, form.diets),
    currency: budget && amount !== '' && form.currency === '' ? LW.currencyBlank : null,
    amount:
      read != null && 'wrong' in read ? LW.priceWrong(priceExample(lang, form.currency)) : null,
  };
}

/** The field focus moves to: the first problem in the order of the fields, the picker before the amount. */
export function firstProblem(errors: FormErrors): string | null {
  if (errors.name != null) return 'lib-name';
  if (errors.desc != null) return 'lib-desc';
  if (errors.contains != null) return `lib-has-${DISH_ALLERGENS[0]}`;
  const clash = errors.clashes[0];
  if (clash != null) return `lib-diet-${clash.diet}`;
  if (errors.currency != null) return 'lib-currency';
  if (errors.amount != null) return 'lib-amount';

  return null;
}

export const hasProblems = (errors: FormErrors): boolean => firstProblem(errors) != null;

/** The dish the name lands on, ignoring case and accents, archived ones included; an active match wins over an archived one. */
export function duplicateOf(
  name: string,
  dishes: readonly LibDish[],
  selfId: string | null,
): { dish: LibDish; archivedOnly: boolean } | null {
  const matches = dishes.filter((one) => one.id !== selfId && sameName(one.name, name));
  if (matches.length === 0) return null;
  const active = matches.find((one) => !one.archived);

  return { dish: active ?? (matches[0] as LibDish), archivedOnly: active == null };
}

export function duplicateLine(found: { dish: LibDish; archivedOnly: boolean }): string {
  const line = LW.duplicate(found.dish.name);

  return found.archivedOnly ? `${line} ${LW.underArchived}` : line;
}

export function blankForm(currency: string): DishForm {
  return { name: '', desc: '', allergens: [], none: false, diets: [], amount: '', currency };
}

export function formOf(dish: LibDish, lang: Lang, orgCurrency: string): DishForm {
  return {
    name: dish.name,
    desc: dish.desc,
    allergens: Array.isArray(dish.contains) ? dish.contains : [],
    none: dish.contains === 'none',
    diets: dish.diets,
    amount: dish.price == null ? '' : typedPrice(dish.price, lang),
    currency: dish.price?.currency ?? orgCurrency,
  };
}

/** Saving keeps Last price as it was without budget.read; clearing the amount clears the price, currency included. */
export function savedDish(
  form: DishForm,
  was: LibDish | null,
  id: string,
  lang: Lang,
  budget: boolean,
): LibDish {
  const read =
    budget && form.amount.trim() !== '' ? readPrice(form.amount, lang, form.currency) : null;
  const price: Price | null = !budget
    ? (was?.price ?? null)
    : read != null && 'minor' in read
      ? { minor: read.minor, currency: form.currency }
      : null;

  return {
    id,
    name: form.name.trim(),
    desc: form.desc.trim(),
    contains: form.none ? 'none' : form.allergens,
    diets: form.diets,
    used: was?.used ?? false,
    archived: was?.archived ?? false,
    price,
  };
}

const dish = (
  id: string,
  name: string,
  desc: string,
  contains: Contains,
  diets: readonly Diet[],
  more: Partial<LibDish> = {},
): LibDish => ({
  id,
  name,
  desc,
  contains,
  diets,
  used: false,
  archived: false,
  price: null,
  ...more,
});

export const SAMPLE_DISHES: readonly LibDish[] = [
  dish(
    'd-jollof',
    'Jollof rice',
    'Long-grain rice cooked in a tomato and pepper base.',
    ['celery'],
    ['vegetarian', 'vegan', 'halal', 'kosher', 'no_pork', 'no_beef', 'no_alcohol'],
    { used: true, price: { minor: 450000, currency: 'NGN' } },
  ),
  dish(
    'd-moimoi',
    'Moi moi',
    'Steamed bean pudding with egg and crayfish.',
    ['crustaceans', 'eggs'],
    ['halal', 'no_pork', 'no_beef', 'no_alcohol'],
    { used: true },
  ),
  dish(
    'd-coconut',
    'Coconut rice',
    'Rice cooked in coconut milk.',
    'none',
    ['vegetarian', 'vegan', 'halal', 'no_pork', 'no_beef', 'no_alcohol'],
    { price: { minor: 380000, currency: 'NGN' } },
  ),
  dish(
    'd-suya',
    'Beef suya skewers',
    'Grilled beef in a spiced peanut rub.',
    ['peanuts', 'sesame'],
    ['halal', 'no_pork', 'no_alcohol'],
    { used: true, price: { minor: 350000, currency: 'NGN' } },
  ),
  dish('d-chinchin', 'Chin chin', '', ['gluten', 'eggs', 'milk'], []),
  dish(
    'd-pepper',
    'Catfish pepper soup',
    'A light, hot broth with catfish and uziza.',
    ['fish', 'celery'],
    ['pescatarian', 'halal', 'no_pork', 'no_beef', 'no_alcohol'],
    { used: true },
  ),
  dish('d-asun', 'Asun', 'Spiced grilled goat.', null, ['halal', 'no_pork', 'no_beef']),
  dish('d-zobo', 'Zobo sorbet', 'Hibiscus and ginger, frozen.', 'none', [
    'vegetarian',
    'vegan',
    'pescatarian',
    'halal',
    'kosher',
    'no_pork',
    'no_beef',
    'no_alcohol',
  ]),
  dish('d-puff', 'Puff puff', 'Fried dough balls.', ['gluten', 'milk'], ['vegetarian'], {
    used: true,
    archived: true,
  }),
];

export type Opened =
  | { kind: 'add'; form?: Partial<DishForm>; press?: boolean }
  | { kind: 'edit'; id: string; form?: Partial<DishForm>; press?: boolean }
  | { kind: 'gone'; name: string };

export interface LibraryStart {
  name: string;
  note?: string;
  dishes: readonly LibDish[];
  tab: 'dishes' | 'archived';
  q: string;
  diets: readonly Diet[];
  manage: boolean;
  access: boolean;
  loading: boolean;
  refreshing: boolean;
  orgCurrency: string;
  opened: Opened | null;
  askDelete: string | null;
  said: string;
  failedSave: boolean;
  budget: boolean;
}

function start(over: Partial<LibraryStart> & { name: string }): LibraryStart {
  return {
    dishes: SAMPLE_DISHES,
    tab: 'dishes',
    q: '',
    diets: [],
    manage: true,
    access: true,
    loading: false,
    refreshing: false,
    orgCurrency: ORG_CURRENCY,
    opened: null,
    askDelete: null,
    said: '',
    failedSave: false,
    budget: true,
    ...over,
  };
}

const LONG =
  'Slow-roasted whole lamb shoulder with yaji spice, charred onions, and pepper sauce, carved at the table for the party, served with a side of fried yam and dodo, and a small dish of extra yaji';

const STATES = {
  list: () => start({ name: 'The list, A to Z' }),
  loading: () => start({ name: 'Loading', loading: true }),
  refreshing: () => start({ name: 'Refreshing', refreshing: true }),
  empty: () => start({ name: 'Empty, first time', dishes: [] }),
  emptyReadOnly: () => start({ name: 'Empty, read only', dishes: [], manage: false }),
  filtered: () => start({ name: 'Filtered: Vegan', diets: ['vegan'] }),
  noMatch: () => start({ name: 'No match', q: 'plantain' }),
  archived: () => start({ name: 'Archived', tab: 'archived' }),
  readOnly: () => start({ name: 'Read only, without menu.manage', manage: false }),
  readOnlyArchived: () => start({ name: 'Read only, Archived', manage: false, tab: 'archived' }),
  noAccess: () => start({ name: 'No access, without menu.read (403)', access: false }),
  add: () => start({ name: 'Add dish', opened: { kind: 'add' } }),
  addBlank: () => start({ name: 'Add dish, saved blank', opened: { kind: 'add', press: true } }),
  tooLong: () =>
    start({
      name: 'Name too long',
      opened: { kind: 'add', form: { name: LONG, none: true }, press: true },
    }),
  conflict: () =>
    start({
      name: 'Diet conflict, one diet',
      opened: {
        kind: 'add',
        form: { name: 'Prawn skewers', allergens: ['crustaceans'], diets: ['vegetarian', 'halal'] },
        press: true,
      },
    }),
  conflictTwo: () =>
    start({
      name: 'Diet conflict, two diets',
      opened: {
        kind: 'add',
        form: {
          name: 'Seafood okra',
          allergens: ['crustaceans', 'fish', 'eggs'],
          diets: ['vegetarian', 'vegan'],
        },
        press: true,
      },
    }),
  priceInvalid: () =>
    start({
      name: 'Last price, not a number',
      opened: {
        kind: 'add',
        form: { name: 'Ofada stew', allergens: ['celery'], amount: '3,500 naira' },
        press: true,
      },
    }),
  priceDecimals: () =>
    start({
      name: 'Last price, too many decimals (JPY)',
      opened: {
        kind: 'add',
        form: { name: 'Ofada stew', allergens: ['celery'], amount: '3500.50', currency: 'JPY' },
        press: true,
      },
    }),
  noCurrency: () =>
    start({
      name: 'No organisation currency',
      orgCurrency: '',
      opened: { kind: 'add', form: { name: 'Ofada stew', allergens: ['celery'] } },
    }),
  noCurrencyRefused: () =>
    start({
      name: 'No organisation currency, refused',
      orgCurrency: '',
      opened: {
        kind: 'add',
        form: { name: 'Ofada stew', allergens: ['celery'], amount: '4,500' },
        press: true,
      },
    }),
  duplicate: () =>
    start({
      name: 'Duplicate',
      opened: { kind: 'add', form: { name: 'jollof Rice', allergens: ['celery'] }, press: true },
    }),
  duplicateArchived: () =>
    start({
      name: 'Duplicate, archived',
      opened: { kind: 'add', form: { name: 'puff puff', allergens: ['gluten'] }, press: true },
    }),
  edit: () => start({ name: 'Edit', opened: { kind: 'edit', id: 'd-jollof' } }),
  editNotStated: () =>
    start({ name: 'Edit, allergens not stated', opened: { kind: 'edit', id: 'd-asun' } }),
  editSameName: () =>
    start({
      name: 'Edit, renamed onto another dish',
      opened: { kind: 'edit', id: 'd-coconut', form: { name: 'moi moi' }, press: true },
    }),
  editNoBudget: () =>
    start({
      name: 'Edit, without budget.read',
      note: 'Also any state with &budget=no.',
      budget: false,
      opened: { kind: 'edit', id: 'd-jollof' },
    }),
  deleteConfirm: () => start({ name: 'Delete…, asking in its row', askDelete: 'd-chinchin' }),
  saved: () => start({ name: 'Status: saved', said: LW.saved('Coconut rice') }),
  archivedSaid: () =>
    start({
      name: 'Status: archived',
      dishes: SAMPLE_DISHES.map((one) => (one.id === 'd-suya' ? { ...one, archived: true } : one)),
      said: LW.archivedLine('Beef suya skewers'),
    }),
  restored: () =>
    start({
      name: 'Status: restored',
      dishes: SAMPLE_DISHES.map((one) => (one.id === 'd-puff' ? { ...one, archived: false } : one)),
      said: LW.restored('Puff puff'),
    }),
  deleted: () =>
    start({
      name: 'Status: deleted',
      dishes: SAMPLE_DISHES.filter((one) => one.id !== 'd-chinchin'),
      said: LW.deleted('Chin chin'),
    }),
  failedAction: () =>
    start({ name: 'Status: a row action failed', said: LW.failedAction('Beef suya skewers') }),
  failedSave: () =>
    start({
      name: 'Save failed',
      opened: { kind: 'edit', id: 'd-coconut' },
      failedSave: true,
    }),
  gone: () =>
    start({ name: 'Edit, the dish is gone', opened: { kind: 'gone', name: 'Chin chin' } }),
} satisfies Record<string, () => LibraryStart>;

export type LibraryStateName = keyof typeof STATES;

export const isFailureSaid = (said: string): boolean => said.startsWith('Nothing was');

export function libraryStart(raw: string | null): LibraryStart {
  const name: LibraryStateName =
    raw != null && Object.hasOwn(STATES, raw) ? (raw as LibraryStateName) : 'list';

  return STATES[name]();
}

export function libraryAt(state?: LibraryStateName, more = ''): string {
  const query = [state == null ? '' : `state=${state}`, more].filter(Boolean).join('&');

  return `${LIBRARY_PATH}${query === '' ? '' : `?${query}`}`;
}

function link(state: LibraryStateName): DemoLink {
  return { to: libraryAt(state), name: STATES[state]().name };
}

export const LIBRARY_PAGES: readonly { name: string; states: readonly DemoLink[] }[] = [
  {
    name: 'The list',
    states: (
      [
        'list',
        'loading',
        'refreshing',
        'empty',
        'emptyReadOnly',
        'filtered',
        'noMatch',
        'archived',
        'readOnly',
        'readOnlyArchived',
        'noAccess',
      ] as const
    ).map(link),
  },
  {
    name: 'Add dish, docked beside the list',
    states: (
      [
        'add',
        'addBlank',
        'tooLong',
        'conflict',
        'conflictTwo',
        'priceInvalid',
        'priceDecimals',
        'noCurrency',
        'noCurrencyRefused',
        'duplicate',
        'duplicateArchived',
      ] as const
    ).map(link),
  },
  {
    name: 'Edit',
    states: (
      ['edit', 'editNotStated', 'editSameName', 'editNoBudget', 'failedSave', 'gone'] as const
    ).map(link),
  },
  {
    name: 'Row actions and the status line',
    states: (
      ['deleteConfirm', 'saved', 'archivedSaid', 'restored', 'deleted', 'failedAction'] as const
    ).map(link),
  },
  {
    name: 'Tweaks on any state',
    states: [
      { to: libraryAt('edit', 'budget=no'), name: 'Without budget.read (&budget=no)' },
      {
        to: libraryAt('edit', 'format=fr'),
        name: 'Number format fr (&format=fr): 4 500 and 12,50',
      },
      { to: libraryAt('priceInvalid', 'format=es'), name: 'Number format es (&format=es)' },
      { to: libraryAt('list', 'offline'), name: 'Cannot reach Soirely (&offline)' },
    ],
  },
];

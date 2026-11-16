import type { Allergen } from './guestKitchenWords.ts';
import {
  type Contains,
  type Diet,
  type DishAllergen,
  type Lang,
  type Price,
  DISH_ALLERGENS,
  LW,
  allergenName,
  dietClashes,
  lengthOf,
  priceExample,
  readPrice,
  sameName,
  typedPrice,
} from './menuLibrary.ts';

/** sc-3903's variants of a dish (boards Menu and MenuLibrary, page e32): each has its own allergens, diets and money, and guests pick one. */
export const VARIANT_MAX = 6;
export const VARIANT_NAME_MAX = 60;
export const EVENT_CURRENCY = 'EUR';

export type VariantFor = 'everyone' | 'children';
export type Where = 'event' | 'library';

export type VariantPicker = readonly (Allergen | 'other')[];

export interface Variant {
  id: string;
  name: string;
  for: VariantFor;
  contains: Contains;
  diets: readonly Diet[];
  /** An event variant's Cost, in the event's currency; a library variant's Last price, in its own. */
  price: Price | null;
  pickers: readonly VariantPicker[];
  /** Event only: copied from a library Last price in another currency, so its Cost is blank until set. */
  pricedIn?: string | null;
}

export interface WithVariants {
  name: string;
  contains: Contains;
  diets: readonly Diet[];
  variants?: readonly Variant[];
}

export const VW = {
  addVariant: 'Add variant',
  addVariants: 'Add variants',
  saveVariant: 'Save variant',
  addVariantAria: (dish: string) => `Add variant to ${dish}`,
  addFirstTitle: (dish: string) => `Add variants to ${dish}`,
  addTitle: (dish: string) => `Add a variant to ${dish}`,
  editTitle: (variant: string) => `Edit ${variant}`,
  blocks: ['First variant', 'Second variant'] as const,
  ways: (dish: string, n: number) => `${dish} · ${n} ways`,
  eachOwn: 'Each variant has its own allergens and diets. Guests pick one.',
  name: 'Name',
  forLegend: 'For',
  everyone: 'Everyone',
  childrenOnly: 'Children only',
  childrenHelp:
    '[Guests don’t see it on their own page. You pick it for the guest it is meant for.]',
  untilNow: (dish: string) => `[${dish} until now · for reference only]`,
  startsBlank: '[Each variant starts blank. Nothing is copied from the dish.]',
  cost: 'Cost',
  costHelp: 'Only people who can see Budget see this.',
  pricedIn: (code: string) => `Last priced in ${code}. Set this event’s cost.`,
  editAria: (variant: string) => `Edit ${variant}`,
  removeAria: (variant: string) => `Remove ${variant}…`,
  actionsFor: (variant: string) => `Actions for ${variant}`,
  edit: 'Edit',
  remove: 'Remove…',
  picks: (n: number, share: number) => (n === 0 ? 'No picks yet' : `${n} picked · ${share}%`),
  nameBlank: 'Enter the variant’s name.',
  nameLong: 'Shorten the name to 60 characters or fewer.',
  nameTwice: 'Each variant needs its own name.',
  needsEveryone: 'At least one variant must be for Everyone.',
  costWrong: (example: string) => `Enter the cost as a number, like ${example}.`,
  limit: 'A dish can have at most 6 variants.',
  dishPicked: 'Guests have picked this dish.',
  variantPicked: 'Guests have picked this variant.',
  lastEveryone: (variant: string) =>
    `${variant} is the only variant for Everyone. Make another variant for Everyone first.`,
  removeAsk: (variant: string, dish: string) => `Remove ${variant} from ${dish}?`,
  keepIt: 'Keep it',
  removeVariant: 'Remove variant',
  foldTitle: 'Make this a single dish?',
  foldBody: (dish: string, variant: string, money: boolean) =>
    `${dish} becomes a single dish with ${variant}’s allergens, diets${money ? ' and cost' : ''}:`,
  foldBodyLibrary: (dish: string, variant: string, money: boolean) =>
    `${dish} becomes a single dish with ${variant}’s allergens, diets${money ? ' and last price' : ''}:`,
  foldChildren: 'It is no longer for children only: every guest can pick it.',
  foldMoney: (money: string, variant: string) => `${money}, from ${variant}`,
  foldNoCost: (variant: string) => `None. ${variant} has no cost, so the dish has none.`,
  foldNoPrice: (variant: string) => `None. ${variant} has no last price, so the dish has none.`,
  keepBoth: 'Keep both variants',
  makeSingle: 'Make it a single dish',
  folded: (dish: string, variant: string, money: Where | null) =>
    `${dish} is a single dish again, with ${variant}’s allergens, diets${
      money == null ? '' : money === 'event' ? ' and cost' : ' and last price'
    }.`,
  addedTwo: (dish: string, a: string, b: string) => `${dish} now comes 2 ways: ${a} and ${b}.`,
  added: (variant: string, dish: string) => `${variant} added to ${dish}.`,
  saved: (variant: string) => `${variant} saved.`,
  removed: (variant: string, dish: string) => `${variant} removed from ${dish}.`,
  failedSave: (button: string) =>
    `Nothing was saved. Check your connection, then press ${button} again.`,
  failedChange: (dish: string, n: number) =>
    `Nothing was changed: ${dish} still comes ${n} ways. Check your connection, then try again.`,
  guestsPickTheWay: (dish: string) => `Everyone gets ${dish}. Guests pick the way.`,
} as const;

export const variantsOf = (dish: WithVariants): readonly Variant[] => dish.variants ?? [];
export const hasVariants = (dish: WithVariants): boolean => variantsOf(dish).length > 0;
export const isForEveryone = (variant: Variant): boolean => variant.for === 'everyone';
export const variantPicked = (variant: Variant): boolean => variant.pickers.length > 0;

export const waysName = (dish: WithVariants): string =>
  hasVariants(dish) ? VW.ways(dish.name, variantsOf(dish).length) : dish.name;

export function picksLine(dish: WithVariants, variant: Variant): string {
  const all = variantsOf(dish).reduce((sum, one) => sum + one.pickers.length, 0);
  const share = all === 0 ? 0 : Math.round((variant.pickers.length / all) * 100);

  return VW.picks(variant.pickers.length, share);
}

export function moneyLine(price: Price, lang: Lang): string {
  return `${price.currency} ${typedPrice(price, lang)}`;
}

export interface VariantForm {
  name: string;
  for: VariantFor;
  allergens: readonly DishAllergen[];
  none: boolean;
  diets: readonly Diet[];
  amount: string;
  currency: string;
}

export interface VariantErrors {
  name: string | null;
  for: string | null;
  contains: string | null;
  clashes: { diet: Diet; line: string }[];
  currency: string | null;
  amount: string | null;
}

export function blankVariant(currency: string, chosen: VariantFor = 'everyone'): VariantForm {
  return { name: '', for: chosen, allergens: [], none: false, diets: [], amount: '', currency };
}

export function variantForm(variant: Variant, lang: Lang, currency: string): VariantForm {
  return {
    name: variant.name,
    for: variant.for,
    allergens: Array.isArray(variant.contains) ? variant.contains : [],
    none: variant.contains === 'none',
    diets: variant.diets,
    amount: variant.price == null ? '' : typedPrice(variant.price, lang),
    currency: variant.price?.currency ?? currency,
  };
}

export interface VariantCheck {
  where: Where;
  lang: Lang;
  budget: boolean;
  others: readonly Variant[];
}

/** Every block of a variant form, checked before it sends. A name repeats another variant's, or a block's above it, ignoring case; the dish keeps a variant for Everyone, so when every block is Children only and no other variant is for Everyone, each block's For is refused. */
export function checkVariants(
  forms: readonly VariantForm[],
  { where, lang, budget, others }: VariantCheck,
): VariantErrors[] {
  const noEveryone = forms.every((one) => one.for === 'children') && !others.some(isForEveryone);

  return forms.map((form, at) => {
    const length = lengthOf(form.name);
    const taken = [...others.map((one) => one.name), ...forms.slice(0, at).map((one) => one.name)];
    const amount = form.amount.trim();
    const read =
      budget && amount !== '' && form.currency !== ''
        ? readPrice(amount, lang, form.currency)
        : null;
    const example = priceExample(lang, form.currency === '' ? EVENT_CURRENCY : form.currency);

    return {
      name:
        length === 0
          ? VW.nameBlank
          : length > VARIANT_NAME_MAX
            ? VW.nameLong
            : taken.some((one) => sameName(one, form.name))
              ? VW.nameTwice
              : null,
      for: noEveryone ? VW.needsEveryone : null,
      contains: form.allergens.length === 0 && !form.none ? LW.containsBlank : null,
      clashes: dietClashes(form.allergens, form.diets),
      currency:
        budget && where === 'library' && amount !== '' && form.currency === ''
          ? LW.currencyBlank
          : null,
      amount:
        read != null && 'wrong' in read
          ? where === 'event'
            ? VW.costWrong(example)
            : LW.priceWrong(example)
          : null,
    };
  });
}

export const blockPrefix = (at: number): string => `vb${at}-`;

/** The field focus moves to: the first problem across the blocks, in the order the fields sit (Name, For, Contains, Suitable for, Cost). For lands on its checked radio. */
export function firstVariantProblem(
  errors: readonly VariantErrors[],
  forms: readonly VariantForm[],
): string | null {
  for (const [at, one] of errors.entries()) {
    const p = blockPrefix(at);
    if (one.name != null) return `${p}name`;
    if (one.for != null) return `${p}for-${forms[at]?.for ?? 'everyone'}`;
    if (one.contains != null) return `${p}has-${DISH_ALLERGENS[0]}`;
    const clash = one.clashes[0];
    if (clash != null) return `${p}diet-${clash.diet}`;
    if (one.currency != null) return `${p}currency`;
    if (one.amount != null) return `${p}amount`;
  }

  return null;
}

let made = 0;

export function savedVariant(
  form: VariantForm,
  was: Variant | null,
  { where, lang, budget }: Omit<VariantCheck, 'others'>,
): Variant {
  made += 1;
  const amount = form.amount.trim();
  const currency = where === 'event' ? EVENT_CURRENCY : form.currency;
  const read = budget && amount !== '' ? readPrice(amount, lang, currency) : null;
  const price: Price | null = !budget
    ? (was?.price ?? null)
    : read != null && 'minor' in read
      ? { minor: read.minor, currency }
      : null;

  return {
    id: was?.id ?? `v-new-${made}`,
    name: form.name.trim(),
    for: form.for,
    contains: form.none ? 'none' : form.allergens.slice(),
    diets: form.diets.slice(),
    price,
    pickers: was?.pickers ?? [],
    pricedIn: price == null ? (was?.pricedIn ?? null) : null,
  };
}

export type AddOutcome = 'open' | 'limit' | 'picked';

export function addOutcome(dish: WithVariants, pickedDish: boolean): AddOutcome {
  const variants = variantsOf(dish);
  if (variants.length >= VARIANT_MAX) return 'limit';
  if (variants.length === 0 && pickedDish) return 'picked';

  return 'open';
}

export type Refusal = 'picked' | 'lastEveryone';

/** Remove… on a variant: from two it folds, and otherwise it asks, unless something refuses it. A picked variant is refused until sc-3913, and said first; the last one for Everyone, with two or more left, opens nothing. */
export function removeOutcome(
  dish: WithVariants,
  variant: Variant,
  where: Where,
): { kind: 'fold' | 'ask' } | { kind: 'refused'; lines: Refusal[] } {
  const variants = variantsOf(dish);
  const lines: Refusal[] = [];
  if (where === 'event' && variantPicked(variant)) lines.push('picked');
  const lastEveryone =
    variants.length > 2 && isForEveryone(variant) && variants.filter(isForEveryone).length === 1;
  if (lastEveryone) lines.push('lastEveryone');
  if (lines.length > 0) return { kind: 'refused', lines };

  return { kind: variants.length <= 2 ? 'fold' : 'ask' };
}

export function refusalLine(refusal: Refusal, variant: Variant): string {
  return refusal === 'picked' ? VW.variantPicked : VW.lastEveryone(variant.name);
}

export type VariantMode = 'addFirst' | 'add' | 'edit';

export function variantSaveLabel(mode: VariantMode): string {
  if (mode === 'addFirst') return VW.addVariants;

  return mode === 'add' ? VW.addVariant : VW.saveVariant;
}

export type VariantAsk =
  | { variantId: string; kind: 'ask' | 'fold' }
  | { variantId: string; kind: 'refused'; lines: readonly Refusal[] };

export function othersFor(dish: WithVariants, mode: VariantMode, variantId: string | null) {
  if (mode === 'addFirst') return [];

  return variantsOf(dish).filter((one) => one.id !== variantId);
}

export function withSavedVariants<D extends WithVariants>(
  dish: D,
  mode: VariantMode,
  variantId: string | null,
  forms: readonly VariantForm[],
  how: Omit<VariantCheck, 'others'>,
): { dish: D; said: string; more: string | null } {
  if (mode === 'addFirst') {
    const made = forms.map((form) => savedVariant(form, null, how));
    const [a, b] = made as [Variant, Variant];

    return {
      dish: { ...dish, variants: made },
      said: VW.addedTwo(dish.name, a.name, b.name),
      more: null,
    };
  }
  const form = forms[0] as VariantForm;
  if (mode === 'add') {
    const next = savedVariant(form, null, how);

    return {
      dish: { ...dish, variants: [...variantsOf(dish), next] },
      said: VW.added(next.name, dish.name),
      more: null,
    };
  }
  const was = variantsOf(dish).find((one) => one.id === variantId) ?? null;
  const next = savedVariant(form, was, how);

  return {
    dish: {
      ...dish,
      variants: variantsOf(dish).map((one) => (one.id === next.id ? next : one)),
    },
    said: VW.saved(next.name),
    more:
      how.where === 'event' && was != null
        ? variantAllergenLine(dish.name, was, was.contains, next.contains, how.lang)
        : null,
  };
}

export const stayingAfter = (dish: WithVariants, removing: Variant): Variant | null =>
  variantsOf(dish).find((one) => one.id !== removing.id) ?? null;

export interface FoldWords {
  body: string;
  children: string | null;
  money: string | null;
}

export function foldWords(
  dish: WithVariants,
  staying: Variant,
  where: Where,
  budget: boolean,
  lang: Lang,
): FoldWords {
  const body =
    where === 'event'
      ? VW.foldBody(dish.name, staying.name, budget)
      : VW.foldBodyLibrary(dish.name, staying.name, budget);
  const money = !budget
    ? null
    : staying.price != null
      ? VW.foldMoney(moneyLine(staying.price, lang), staying.name)
      : where === 'event'
        ? VW.foldNoCost(staying.name)
        : VW.foldNoPrice(staying.name);

  return {
    body,
    children: staying.for === 'children' ? VW.foldChildren : null,
    money,
  };
}

export function removeVariant<D extends WithVariants>(dish: D, variant: Variant): D {
  return { ...dish, variants: variantsOf(dish).filter((one) => one.id !== variant.id) };
}

export function foldInto<D extends WithVariants>(
  dish: D,
  staying: Variant,
): { dish: D; price: Price | null } {
  return {
    dish: { ...dish, contains: staying.contains, diets: staying.diets, variants: [] },
    price: staying.price,
  };
}

export function sameHint(dishes: readonly WithVariants[]): string | null {
  if (dishes.length !== 1) return null;
  const dish = dishes[0] as WithVariants;

  return variantsOf(dish).filter(isForEveryone).length >= 2 ? VW.guestsPickTheWay(dish.name) : null;
}

/** A library dish's variants as an event copies them: Name, For, Contains and Suitable for; a Last price fills Cost only in the event's currency, and nothing is converted. */
export function copiedVariants(variants: readonly Variant[], eventCurrency: string): Variant[] {
  return variants.map((one, at) => {
    const same = one.price != null && one.price.currency === eventCurrency;

    return {
      id: `${one.id}-ev-${at}`,
      name: one.name,
      for: one.for,
      contains: Array.isArray(one.contains) ? one.contains.slice() : one.contains,
      diets: one.diets.slice(),
      price: same ? one.price : null,
      pickers: [],
      pricedIn: one.price == null || same ? null : one.price.currency,
    };
  });
}

const listOf = (names: readonly string[]): string =>
  new Intl.ListFormat('en', { type: 'conjunction' }).format(names);

export function variantAllergenLine(
  dish: string,
  variant: Pick<Variant, 'name' | 'pickers'>,
  before: Contains,
  after: Contains,
  lang: Lang = 'en',
): string | null {
  if (!Array.isArray(after)) return null;
  const had: readonly DishAllergen[] = Array.isArray(before) ? before : [];
  const added = after.filter((code) => !had.includes(code));
  if (added.length === 0) return null;
  const counted = variant.pickers.filter((one) =>
    added.some((code) => one.includes(code as Allergen)),
  );
  if (counted.length === 0) return null;
  const named = DISH_ALLERGENS.filter(
    (code) => added.includes(code) && counted.some((one) => one.includes(code as Allergen)),
  ).map((code) => allergenName(code, lang));
  const who =
    counted.length === 1
      ? `1 guest who picked ${dish}, ${variant.name}, has`
      : `${counted.length} guests who picked ${dish}, ${variant.name}, have`;

  return `[${who} ${listOf(named)} recorded, and nobody has told them.]`;
}

const many = (n: number, picker: VariantPicker): VariantPicker[] =>
  Array.from({ length: n }, () => picker);

export function variant(
  id: string,
  name: string,
  chosen: VariantFor,
  contains: Contains,
  diets: readonly Diet[],
  price: Price | null = null,
  pickers: readonly VariantPicker[] = [],
): Variant {
  return { id, name, for: chosen, contains, diets, price, pickers, pricedIn: null };
}

const HALAL: readonly Diet[] = ['halal', 'no_pork', 'no_alcohol'];
const eur = (minor: number): Price => ({ minor, currency: 'EUR' });

export function jollofVariants(): Variant[] {
  return [
    variant('v-chicken', 'Chicken', 'everyone', ['celery'], HALAL, eur(1800), [
      ...many(3, ['sesame']),
      ['sesame', 'peanuts'],
      ['other'],
      ...many(26, []),
    ]),
    variant('v-kids', 'Children’s portion', 'children', ['celery'], HALAL, eur(600), many(9, [])),
    variant('v-plain', 'Children’s plain', 'children', 'none', [...HALAL, 'vegetarian']),
  ];
}

export function twoWays(): Variant[] {
  return [
    variant('v-fish', 'Fish', 'everyone', ['fish', 'celery'], ['pescatarian', ...HALAL], eur(1550)),
    variant('v-chicken2', 'Chicken', 'everyone', ['celery'], HALAL, eur(1400)),
  ];
}

export function beefWays(): Variant[] {
  return [
    variant('v-beef', 'Beef', 'everyone', ['gluten', 'peanuts', 'sesame'], HALAL),
    variant('v-chicken3', 'Chicken', 'everyone', ['gluten', 'peanuts', 'sesame'], HALAL, eur(1200)),
  ];
}

export function childrenFold(): Variant[] {
  return [
    variant('v-full', 'Full bowl', 'everyone', ['fish', 'celery'], ['pescatarian'], eur(900)),
    variant(
      'v-small',
      'Children’s portion',
      'children',
      ['fish', 'celery'],
      ['pescatarian'],
      eur(450),
    ),
  ];
}

export function sixWays(): Variant[] {
  return [
    ...jollofVariants(),
    variant('v-fish6', 'Fish', 'everyone', ['fish', 'celery'], ['pescatarian'], eur(1550)),
    variant('v-beef6', 'Beef', 'everyone', ['celery'], HALAL),
    variant('v-veg6', 'Vegetable', 'everyone', ['celery'], ['vegetarian', 'vegan'], eur(1200)),
  ];
}

const priced = (minor: number, currency: string): Price => ({ minor, currency });

export function libraryJollof(currency: string): Variant[] {
  return [
    variant('lv-chicken', 'Chicken', 'everyone', ['celery'], HALAL, priced(1800, currency)),
    variant('lv-kids', 'Children’s portion', 'children', ['celery'], HALAL, priced(600, currency)),
    variant('lv-plain', 'Children’s plain', 'children', 'none', [...HALAL, 'vegetarian']),
  ];
}

export function libraryCoconut(): Variant[] {
  return [
    variant(
      'lv-fish',
      'Fish',
      'everyone',
      ['fish'],
      ['pescatarian', ...HALAL],
      priced(1200, 'GBP'),
    ),
    variant('lv-chicken2', 'Chicken', 'everyone', 'none', HALAL, priced(1050, 'GBP')),
  ];
}

export function libraryMoiMoi(): Variant[] {
  return [
    variant('lv-beef', 'Beef', 'everyone', ['crustaceans', 'eggs'], HALAL),
    variant(
      'lv-plain2',
      'Plain',
      'everyone',
      ['eggs'],
      ['vegetarian', ...HALAL],
      priced(150000, 'NGN'),
    ),
  ];
}

export function libraryPepper(): Variant[] {
  return [
    variant(
      'lv-full',
      'Full bowl',
      'everyone',
      ['fish', 'celery'],
      ['pescatarian'],
      priced(900, 'GBP'),
    ),
    variant('lv-small', 'Children’s portion', 'children', ['fish', 'celery'], ['pescatarian']),
  ];
}

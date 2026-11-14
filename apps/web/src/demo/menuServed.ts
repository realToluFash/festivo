import type { DemoLink } from './settings.ts';

/** A dish's Items and Served with this course (sc-34230), on every course of the Menu at a desk (board MenuServing, page e32). */
export const MENU_EVENT = 'evt-wed-4';

export const MAX_ITEMS = 6;
export const MAX_OWN = 3;
export const ITEM_NAME_MAX = 40;

export type Item =
  | { key: string; kind: 'fixed'; name: string }
  | { key: string; kind: 'choice'; choiceId: string }
  | { key: string; kind: 'variant' };

export type FixedItem = Extract<Item, { kind: 'fixed' }>;

export interface Choice {
  id: string;
  question: string;
  options: readonly string[];
}

export interface Dish {
  id: string;
  name: string;
  desc: string;
  contains: readonly string[];
  variants: readonly string[];
  choices: readonly Choice[];
  items: readonly Item[];
}

export interface Course {
  id: string;
  name: string;
  servedAt: string | null;
  dishes: readonly Dish[];
  ownItems: readonly FixedItem[];
}

export const MW = {
  title: 'Menu',
  crumb: 'Breadcrumb',
  events: 'Events',
  kitchen: 'Kitchen sheet',
  sub: 'Courses in the order guests are served.',
  course: 'Course {{n}}',
  servedAt: 'Served at {{time}}',
  items: 'Items',
  itemsHelp:
    'What a plate of this dish holds, listed in this order. Leave it empty if the dish is one item.',
  itemsVariants: 'These items are the same for every variant.',
  itemN: 'Item {{n}}',
  addItem: 'Add an item',
  addFrom: 'Or add one from this dish',
  choiceTag: 'Choice',
  variantTag: 'Variants',
  choiceDraft: 'Choice {{k}}, no question yet',
  draft: 'Draft',
  own: 'Served with this course',
  ownHelp:
    'Items of the course’s own, on every plate of the course after the dish’s items, like a bread roll.',
  ownN: 'Course item {{n}}',
  addOwn: 'Add a course item',
  optional: 'Optional',
  name: 'Name',
  served24: 'Served at',
  servedHelp: '24-hour, in the event’s time zone (Lagos), like 20:30.',
  desc: 'Description',
  contains: 'Contains',
  containsStays: 'Items add nothing to Contains.',
  variants: 'Variants · guests pick one',
  choices: 'Choices',
  editCourse: 'Edit course',
  editDish: 'Edit dish',
  editAria: 'Edit {{name}}',
  moveUp: 'Move {{name}} up',
  moveDown: 'Move {{name}} down',
  removeItem: 'Remove {{name}}',
  upHint: 'Move up',
  downHint: 'Move down',
  removeHint: 'Remove',
  remove: 'Remove…',
  removeChoiceAria: 'Remove “{{q}}”…',
  removeVariantAria: 'Remove the variant {{name}}…',
  close: 'Close',
  save: 'Save changes',
  cancel: 'Cancel',
  keepIt: 'Keep it',
  removeChoice: 'Remove choice',
  fold: 'Make this a single dish?',
  foldItem: 'The variants are also one of {{dish}}’s items.',
  keepVariants: 'Keep the variants',
  makeSingle: 'Make it a single dish',
  folded: '{{dish}} is now a single dish.',
  addDish: 'Add dish',
  saved: '{{name}} saved.',
  added: '{{name}} added from the library. It has no items.',
  forbidden: 'Nothing was changed. Your role does not include the permission this needs.',
  lock: 'Your role, Coordinator, can see this menu but not change it. Someone whose role can change Menu can.',
  tooMany: 'A dish can have at most 6 items.',
  onlyOne: 'List 2 items or more, or none.',
  same: 'Each item needs its own name.',
  blank: 'Give each item a name.',
  long: 'An item’s name can be at most 40 characters.',
  ownTooMany: 'A course can have at most 3 items of its own.',
  dishName: 'Enter the dish’s name.',
  courseName: 'Enter the course’s name.',
  unnamed: 'The unnamed item',
} as const;

export function mw(words: string, values: Record<string, string | number>): string {
  return words.replace(/\{\{(\w+)\}\}/gu, (_, key: string) => String(values[key] ?? ''));
}

export function choiceOf(dish: Dish, id: string): Choice | undefined {
  return dish.choices.find((one) => one.id === id);
}

export function orList(names: readonly string[], locale = 'en'): string {
  return new Intl.ListFormat(locale, { type: 'disjunction' }).format(names);
}

export function itemName(item: Item, dish: Dish): string {
  if (item.kind === 'fixed') return item.name;
  if (item.kind === 'variant') return orList(dish.variants);

  const choice = choiceOf(dish, item.choiceId);
  if (choice == null) return '';
  if (choice.question.trim() !== '') return choice.question;

  return mw(MW.choiceDraft, { k: dish.choices.indexOf(choice) + 1 });
}

export function isDraftItem(item: Item, dish: Dish): boolean {
  return item.kind === 'choice' && (choiceOf(dish, item.choiceId)?.question.trim() ?? '') === '';
}

export type Offer = { kind: 'choice'; choice: Choice } | { kind: 'variant'; name: string };

export function offered(dish: Dish, items: readonly Item[]): Offer[] {
  const used = new Set(items.flatMap((one) => (one.kind === 'choice' ? [one.choiceId] : [])));
  const variant: Offer[] =
    dish.variants.length > 1 && !items.some((one) => one.kind === 'variant')
      ? [{ kind: 'variant', name: orList(dish.variants) }]
      : [];

  return [
    ...variant,
    ...dish.choices
      .filter((one) => one.question.trim() !== '' && !used.has(one.id))
      .map((choice): Offer => ({ kind: 'choice', choice })),
  ];
}

export function canAdd(items: readonly Item[], most: number): boolean {
  return items.length < most;
}

export interface ItemErrors {
  list: string | null;
  byKey: Record<string, string>;
}

const sameKey = (name: string): string => name.trim().toLowerCase();

function nameErrors(
  named: readonly { key: string; name: string; fixed: boolean }[],
): Record<string, string> {
  const byKey: Record<string, string> = {};
  const seen = new Set<string>();

  for (const one of named) {
    const name = one.name.trim();

    if (one.fixed && name === '') byKey[one.key] = MW.blank;
    else if (one.fixed && name.length > ITEM_NAME_MAX) byKey[one.key] = MW.long;
    else if (seen.has(sameKey(name))) byKey[one.key] = MW.same;

    if (name !== '') seen.add(sameKey(name));
  }

  return byKey;
}

/** A dish's items: none, or 2 to 6, each named once. The later of two same names is the one refused. */
export function checkItems(items: readonly Item[], dish: Dish): ItemErrors {
  const byKey = nameErrors(
    items.map((one) => ({ key: one.key, name: itemName(one, dish), fixed: one.kind === 'fixed' })),
  );

  return { list: items.length === 1 ? MW.onlyOne : null, byKey };
}

/** A course's own items: none, or 1 to 3, named under the dish's rules. */
export function checkOwn(items: readonly FixedItem[]): ItemErrors {
  return {
    list: null,
    byKey: nameErrors(items.map((one) => ({ key: one.key, name: one.name, fixed: true }))),
  };
}

export function hasErrors(errors: ItemErrors): boolean {
  return errors.list != null || Object.keys(errors.byKey).length > 0;
}

/** The course's items as the API returns them: each name once, in the order it first appears, the dishes' then the course's own. */
export function courseItems(course: Pick<Course, 'dishes' | 'ownItems'>): string[] {
  const names = course.dishes.flatMap((dish) =>
    dish.items.length === 0
      ? [dish.name]
      : dish.items.flatMap((item) => {
          if (item.kind === 'fixed') return [item.name];
          if (item.kind === 'variant') return dish.variants;

          return choiceOf(dish, item.choiceId)?.options ?? [];
        }),
  );
  const seen = new Set<string>();

  return [...names, ...course.ownItems.map((one) => one.name)].flatMap((name) => {
    if (seen.has(sameKey(name))) return [];
    seen.add(sameKey(name));

    return [name.trim()];
  });
}

export function shownName(name: string): string {
  return name.trim() === '' ? MW.unnamed : name.trim();
}

export function moved<T>(list: readonly T[], at: number, by: -1 | 1): T[] | null {
  const to = at + by;
  if (to < 0 || to >= list.length) return null;

  const next = list.slice();
  const [one] = next.splice(at, 1);
  next.splice(to, 0, one as T);

  return next;
}

export function movedLine(name: string, to: number, of: number): string {
  return `${shownName(name)} moved to item ${to + 1} of ${of}`;
}

function alone(items: readonly Item[]): readonly Item[] {
  return items.length === 1 ? [] : items;
}

/** sc-3904's Remove… on a choice that is an item: the item goes with it, and a single item left goes too. */
export function withoutChoice(dish: Dish, choiceId: string): Dish {
  return {
    ...dish,
    choices: dish.choices.filter((one) => one.id !== choiceId),
    items: alone(dish.items.filter((one) => !(one.kind === 'choice' && one.choiceId === choiceId))),
  };
}

/** sc-3903's "Make this a single dish?": the variant leaves the items, and a single item left goes too. */
export function asSingleDish(dish: Dish): Dish {
  return {
    ...dish,
    variants: [],
    items: alone(dish.items.filter((one) => one.kind !== 'variant')),
  };
}

export function removeChoiceLine(dish: Dish, choice: Choice, index: number): string {
  const asked = choice.question.trim() === '' ? `Choice ${index + 1}` : `“${choice.question}”`;
  const isItem = dish.items.some((one) => one.kind === 'choice' && one.choiceId === choice.id);
  const ask = `Remove ${choice.question.trim() === '' ? 'this choice' : asked} from ${dish.name}?`;

  return isItem ? `${ask} ${asked} is also one of ${dish.name}’s items.` : ask;
}

export function foldLine(dish: Dish): string {
  return dish.items.some((one) => one.kind === 'variant')
    ? `${MW.fold} ${mw(MW.foldItem, { dish: dish.name })}`
    : MW.fold;
}

export function removedLine(dish: Dish, choice: Choice): string {
  return `${choice.question.trim() === '' ? 'The choice' : choice.question} removed from ${dish.name}.`;
}

const fixed = (key: string, name: string): FixedItem => ({ key, kind: 'fixed', name });
const choiceItem = (key: string, choiceId: string): Item => ({ key, kind: 'choice', choiceId });
const variantItem = (key: string): Item => ({ key, kind: 'variant' });

const SIDE: Choice = {
  id: 'ch1',
  question: 'And a side?',
  options: ['Plantain', 'Salad', 'Moi moi'],
};
const SAUCE: Choice = { id: 'ch2', question: 'And a sauce?', options: ['Shito', 'Pepper sauce'] };
const NO_QUESTION: Choice = { id: 'ch3', question: '', options: ['Mild', 'Hot'] };

function jollof(items: readonly Item[], choices: readonly Choice[] = [SIDE, SAUCE]): Dish {
  return {
    id: 'e3',
    name: 'Jollof rice',
    desc: 'Party jollof, cooked over wood.',
    contains: ['Celery'],
    variants: [],
    choices,
    items,
  };
}

const JOLLOF_ITEMS: readonly Item[] = [
  fixed('p1', 'Rice'),
  fixed('p2', 'Chicken'),
  choiceItem('p3', 'ch1'),
];

const EGUSI: Dish = {
  id: 'e5',
  name: 'Pounded yam and egusi',
  desc: 'Egusi soup with spinach and smoked fish.',
  contains: ['Fish', 'Crustaceans'],
  variants: [],
  choices: [],
  items: [],
};

const FISH: Dish = {
  id: 'e4',
  name: 'Grilled fish',
  desc: 'With pepper sauce.',
  contains: ['Fish'],
  variants: ['Croaker', 'Tilapia'],
  choices: [],
  items: [fixed('p4', 'Fish'), fixed('p5', 'Pepper sauce'), fixed('p6', 'Yam chips')],
};

const FISH_SIDES: Dish = {
  ...FISH,
  items: [fixed('p5', 'Pepper sauce'), fixed('p6', 'Yam chips')],
};
const FISH_VARIANT: Dish = {
  ...FISH,
  items: [variantItem('p12'), fixed('p5', 'Pepper sauce'), fixed('p6', 'Yam chips')],
};

/** The Main's dishes with items as this event's Menu sets them; the kitchen sheet counts the same ones. */
export const MENU_JOLLOF: Dish = jollof(JOLLOF_ITEMS);
export { FISH as MENU_FISH };

const MOI_MOI: Dish = {
  id: 'e10',
  name: 'Moi moi',
  desc: 'Steamed bean pudding with egg.',
  contains: ['Eggs'],
  variants: [],
  choices: [],
  items: [],
};

const BREAD: readonly FixedItem[] = [fixed('o1', 'Bread roll')];

function courses(main: Partial<Course> = {}): Course[] {
  return [
    {
      id: 'c1',
      name: 'Starter',
      servedAt: '18:30',
      dishes: [
        {
          id: 'e1',
          name: 'Canapé selection',
          desc: 'Puff pastry, smoked fish and cheese bites.',
          contains: ['Cereals containing gluten', 'Fish', 'Milk'],
          variants: [],
          choices: [],
          items: [],
        },
      ],
      ownItems: [],
    },
    {
      id: 'c2',
      name: 'Main',
      servedAt: '20:00',
      dishes: [jollof(JOLLOF_ITEMS), EGUSI],
      ownItems: BREAD,
      ...main,
    },
    {
      id: 'c3',
      name: 'Dessert',
      servedAt: '21:30',
      dishes: [
        {
          id: 'e7',
          name: 'Vanilla ice cream',
          desc: '',
          contains: ['Eggs', 'Milk'],
          variants: [],
          choices: [],
          items: [fixed('d1', 'Ice cream'), fixed('d2', 'Wafer')],
        },
      ],
      ownItems: [],
    },
  ];
}

/** The menu Stations reads (sc-3910): the Main with the grilled fish's variants as an item. */
export function servedCourses(): Course[] {
  return courses({ dishes: [jollof(JOLLOF_ITEMS), FISH_VARIANT] });
}

export type Panel =
  { kind: 'course'; courseId: string } | { kind: 'dish'; courseId: string; dishId: string };

export type Asking =
  | { dishId: string; kind: 'choice'; choiceId: string }
  | { dishId: string; kind: 'variant'; name: string };

export interface MenuStart {
  name: string;
  note: string;
  courses: Course[];
  panel: Panel | null;
  manage: boolean;
  /** The form as it opens: a dish's items or the course's own typed, before Save or Add is pressed. */
  items?: Item[];
  own?: FixedItem[];
  pressSave?: boolean;
  pressAdd?: 'item' | 'own';
  moveFirst?: { key: string; by: -1 | 1 };
  asking?: Asking;
  told?: string;
  refuses?: boolean;
}

const COURSE: Panel = { kind: 'course', courseId: 'c2' };
const DISH: Panel = { kind: 'dish', courseId: 'c2', dishId: 'e3' };
const FISH_PANEL: Panel = { kind: 'dish', courseId: 'c2', dishId: 'e4' };

function start(o: Omit<MenuStart, 'manage'> & Partial<MenuStart>): MenuStart {
  return { manage: true, ...o };
}

const STATES = {
  items: () =>
    start({
      name: 'Edit dish, with items',
      note: 'Every course’s dishes can have items. Fixed items are named in place; a choice is shown by its question. And a sauce? is still offered, And a side? isn’t.',
      courses: courses(),
      panel: DISH,
    }),
  course: () =>
    start({
      name: 'Edit course, Served with this course',
      note: 'A course’s own items, on every plate of the course after the dish’s items. Every course has them.',
      courses: courses(),
      panel: COURSE,
    }),
  noItems: () =>
    start({
      name: 'A dish with no items',
      note: 'No items: the dish is one item, itself, and its row shows nothing new.',
      courses: courses(),
      panel: { kind: 'dish', courseId: 'c2', dishId: 'e5' },
    }),
  choiceDraft: () =>
    start({
      name: 'A choice item with no question yet',
      note: 'A choice that loses its question stays an item, shown by sc-3904’s Choice 3, no question yet beside its Draft tag; one with no question isn’t offered.',
      courses: courses({
        dishes: [
          jollof(
            [fixed('p1', 'Rice'), choiceItem('p3', 'ch1'), choiceItem('p7', 'ch3')],
            [SIDE, SAUCE, NO_QUESTION],
          ),
          EGUSI,
        ],
      }),
      panel: DISH,
    }),
  moved: () =>
    start({
      name: 'Moved up',
      note: 'Rice moved up; the polite line says where it went. Move up on the first item and Move down on the last are greyed, and say so.',
      courses: courses({
        dishes: [
          jollof([fixed('p2', 'Chicken'), fixed('p1', 'Rice'), choiceItem('p3', 'ch1')]),
          EGUSI,
        ],
      }),
      panel: DISH,
      moveFirst: { key: 'p1', by: -1 },
    }),
  variants: () =>
    start({
      name: 'A dish with variants, its variant offered',
      note: 'Croaker or Tilapia is offered as an item, by the variants’ names. Left out, every variant gets the same items.',
      courses: courses({ dishes: [FISH_SIDES, EGUSI] }),
      panel: FISH_PANEL,
    }),
  variantItem: () =>
    start({
      name: 'The variant as an item',
      note: 'The variant is one item however many variants there are; a guest’s plate has the one they picked.',
      courses: courses({ dishes: [FISH_VARIANT, EGUSI] }),
      panel: FISH_PANEL,
    }),
  fromLibrary: () =>
    start({
      name: 'A dish added from the library',
      note: 'Moi moi arrives with no items.',
      courses: courses({ dishes: [jollof(JOLLOF_ITEMS), EGUSI, MOI_MOI] }),
      panel: { kind: 'dish', courseId: 'c2', dishId: 'e10' },
      told: mw(MW.added, { name: 'Moi moi' }),
    }),
  tooMany: () =>
    start({
      name: 'A 7th item',
      note: 'Add an item with 6 items adds nothing, and says why beside it.',
      courses: courses(),
      panel: DISH,
      items: [
        fixed('p1', 'Rice'),
        fixed('p2', 'Chicken'),
        choiceItem('p3', 'ch1'),
        fixed('p8', 'Coleslaw'),
        fixed('p9', 'Boiled egg'),
        fixed('p10', 'Pepper sauce'),
      ],
      pressAdd: 'item',
    }),
  onlyOne: () =>
    start({
      name: 'A single item',
      note: 'One item is refused on Save, and nothing is saved.',
      courses: courses(),
      panel: DISH,
      items: [fixed('p1', 'Rice')],
      pressSave: true,
    }),
  sameName: () =>
    start({
      name: 'Two items with the same name',
      note: 'Same name, ignoring case and surrounding spaces: the later one is refused.',
      courses: courses(),
      panel: DISH,
      items: [fixed('p1', 'Rice'), fixed('p2', 'Chicken'), fixed('p11', ' rice ')],
      pressSave: true,
    }),
  blankName: () =>
    start({
      name: 'A blank item',
      note: 'An item with no name is refused beside it.',
      courses: courses(),
      panel: DISH,
      items: [fixed('p1', 'Rice'), fixed('p2', 'Chicken'), fixed('p11', '')],
      pressSave: true,
    }),
  longName: () =>
    start({
      name: 'An item over 40 characters',
      note: 'Over 40 characters is refused beside it.',
      courses: courses(),
      panel: DISH,
      items: [
        fixed('p1', 'Rice'),
        fixed('p2', 'Chicken thigh in a slow-cooked pepper and tomato stew'),
      ],
      pressSave: true,
    }),
  ownTooMany: () =>
    start({
      name: 'A 4th course item',
      note: 'Add a course item with 3 adds nothing, and says why beside it.',
      courses: courses({
        ownItems: [fixed('o1', 'Bread roll'), fixed('o2', 'Side salad'), fixed('o3', 'Water')],
      }),
      panel: COURSE,
      pressAdd: 'own',
    }),
  forbidden: () =>
    start({
      name: 'A 403 on save',
      note: 'The role changed while the panel was open: Save is refused, and nothing is saved.',
      courses: courses(),
      panel: DISH,
      refuses: true,
    }),
  removeChoice: () =>
    start({
      name: 'Removing a choice that is an item',
      note: 'sc-3904’s Remove… adds that the choice is also one of the dish’s items.',
      courses: courses(),
      panel: null,
      asking: { dishId: 'e3', kind: 'choice', choiceId: 'ch1' },
    }),
  removedTwo: () =>
    start({
      name: 'Removed, 2 items left',
      note: 'The choice went, and its item with it; Rice and Chicken stay.',
      courses: courses({ dishes: [withoutChoice(jollof(JOLLOF_ITEMS), 'ch1'), EGUSI] }),
      panel: null,
      told: 'And a side? removed from Jollof rice.',
    }),
  removedOne: () =>
    start({
      name: 'Removed, 1 item left',
      note: 'One item can’t stand alone, so it goes too: the dish is one item, itself.',
      courses: courses({
        dishes: [
          withoutChoice(jollof([fixed('p1', 'Rice'), choiceItem('p3', 'ch1')]), 'ch1'),
          EGUSI,
        ],
      }),
      panel: null,
      told: 'And a side? removed from Jollof rice.',
    }),
  fold: () =>
    start({
      name: 'Making a dish with a variant item single',
      note: 'Removing Tilapia leaves one variant, so sc-3903 asks to make it a single dish, and adds that the variants are one of its items.',
      courses: courses({ dishes: [FISH_VARIANT, EGUSI] }),
      panel: null,
      asking: { dishId: 'e4', kind: 'variant', name: 'Tilapia' },
    }),
  foldedTwo: () =>
    start({
      name: 'Single, 2 items left',
      note: 'The variant left the items; Pepper sauce and Yam chips stay.',
      courses: courses({ dishes: [asSingleDish(FISH_VARIANT), EGUSI] }),
      panel: null,
      told: mw(MW.folded, { dish: 'Grilled fish' }),
    }),
  foldedOne: () =>
    start({
      name: 'Single, 1 item left',
      note: 'One item can’t stand alone, so it goes too: the dish is one item, itself.',
      courses: courses({
        dishes: [
          asSingleDish({ ...FISH, items: [variantItem('p12'), fixed('p5', 'Pepper sauce')] }),
          EGUSI,
        ],
      }),
      panel: null,
      told: mw(MW.folded, { dish: 'Grilled fish' }),
    }),
  readOnly: () =>
    start({
      name: 'Read only, without menu.manage',
      note: 'Everything as text, and no controls.',
      courses: courses({ dishes: [jollof(JOLLOF_ITEMS), FISH_VARIANT] }),
      panel: null,
      manage: false,
    }),
} satisfies Record<string, () => MenuStart>;

export type MenuStateName = keyof typeof STATES;

export function menuStart(raw: string | null): MenuStart {
  const name: MenuStateName =
    raw != null && Object.hasOwn(STATES, raw) ? (raw as MenuStateName) : 'items';

  return STATES[name]();
}

export function menuAt(eventId: string, state?: MenuStateName): string {
  return `/demo/events/${eventId}/menu${state == null ? '' : `?state=${state}`}`;
}

function link(state: MenuStateName): DemoLink {
  return { to: menuAt(MENU_EVENT, state), name: STATES[state]().name };
}

export const MENU_PAGES: readonly { name: string; states: readonly DemoLink[] }[] = [
  {
    name: 'A dish’s Items, on Edit dish',
    states: (
      [
        'items',
        'noItems',
        'choiceDraft',
        'moved',
        'variants',
        'variantItem',
        'fromLibrary',
      ] as const
    ).map(link),
  },
  {
    name: 'Served with this course, on Edit course',
    states: (['course', 'ownTooMany'] as const).map(link),
  },
  {
    name: 'Refusals, nothing saved',
    states: (['tooMany', 'onlyOne', 'sameName', 'blankName', 'longName', 'forbidden'] as const).map(
      link,
    ),
  },
  {
    name: 'Removing a choice or the variants, and read only',
    states: (
      [
        'removeChoice',
        'removedTwo',
        'removedOne',
        'fold',
        'foldedTwo',
        'foldedOne',
        'readOnly',
      ] as const
    ).map(link),
  },
];

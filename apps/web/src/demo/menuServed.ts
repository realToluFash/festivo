import type { DemoLink } from './settings.ts';

/** How a course is served, a dish's Parts, Served with this course and Plated at (sc-34230), on the Menu at a desk (board MenuServing, page e32). */
export const MENU_EVENT = 'evt-wed-4';

export const MAX_PARTS = 6;
export const MAX_OWN = 3;
export const PART_NAME_MAX = 40;

export type HowServed = 'plated' | 'in_parts' | 'family_style' | 'buffet';

export const HOW_SERVED: readonly HowServed[] = ['plated', 'in_parts', 'family_style', 'buffet'];

export type Part =
  { key: string; kind: 'fixed'; name: string } | { key: string; kind: 'choice'; choiceId: string };

export interface FixedPart {
  key: string;
  kind: 'fixed';
  name: string;
}

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
  parts: readonly Part[];
}

export interface Table {
  id: string;
  name: string;
  section: string | null;
}

export interface Course {
  id: string;
  name: string;
  servedAt: string | null;
  howServed: HowServed;
  dishes: readonly Dish[];
  ownParts: readonly FixedPart[];
  platedAt: readonly string[];
}

export const MW = {
  title: 'Menu',
  crumb: 'Breadcrumb',
  events: 'Events',
  kitchen: 'Kitchen sheet',
  sub: 'Courses in the order guests are served.',
  course: 'Course {{n}}',
  servedAt: 'Served at {{time}}',
  how: 'How it’s served',
  ways: {
    plated: 'Plated',
    in_parts: 'In parts',
    family_style: 'Family style',
    buffet: 'Buffet',
  } satisfies Record<HowServed, string>,
  served: {
    plated: 'A guest is served when their plate is at their seat.',
    in_parts: 'A guest is served when every part due to them is at their seat.',
    family_style: 'A guest is served when every platter is on their table.',
    buffet: 'A guest is served when their table has been called up.',
  } satisfies Record<HowServed, string>,
  kept: 'Parts are used when the course is In parts or Family style.',
  parts: 'Parts',
  partsHelp:
    'Each part is served separately, in this order. With no parts, the dish is served as one plate.',
  partsVariants: 'These parts apply to every variant.',
  onePlate: 'Served as one plate',
  partsOn: 'Parts · for every variant',
  partN: 'Part {{n}}',
  addPart: 'Add a part',
  addChoice: 'Or add one of its choices',
  choiceTag: 'Choice',
  choiceDraft: 'Choice {{k}}, no question yet',
  draft: 'Draft',
  own: 'Served with this course',
  ownHelp: 'Parts that come from no dish, like a drink, served to every guest who has this course.',
  ownN: 'Course part {{n}}',
  addOwn: 'Add a course part',
  platedAt: 'Plated at',
  platedAtHelp: 'Tables served plated anyway, at their seats.',
  noTables: 'No tables yet',
  noTablesLine: 'Tables come from the seating plan.',
  optional: 'Optional',
  noneChosen: 'None',
  name: 'Name',
  served24: 'Served at',
  servedHelp: '24-hour, in the event’s time zone (Lagos), like 20:30.',
  desc: 'Description',
  contains: 'Contains',
  containsNone: 'Contains none of the 14 allergens',
  containsStays: 'Parts add nothing to Contains.',
  variants: 'Variants · guests pick one',
  choices: 'Choices',
  editCourse: 'Edit course',
  editDish: 'Edit dish',
  editAria: 'Edit {{name}}',
  moveUp: 'Move {{name}} up',
  moveDown: 'Move {{name}} down',
  removePart: 'Remove {{name}}',
  upHint: 'Move up',
  downHint: 'Move down',
  removeHint: 'Remove',
  remove: 'Remove…',
  removeChoiceAria: 'Remove “{{q}}”…',
  close: 'Close',
  save: 'Save changes',
  cancel: 'Cancel',
  keepIt: 'Keep it',
  removeChoice: 'Remove choice',
  addDish: 'Add dish',
  saved: '{{name}} saved.',
  added: '{{name}} added from the library. It has no parts.',
  forbidden: 'Nothing was changed. Your role does not include the permission this needs.',
  lock: 'Your role, Coordinator, can see this menu but not change it. Someone whose role can change Menu can.',
  tooMany: 'A dish can have at most 6 parts.',
  onlyOne: 'List 2 parts or more, or none to serve it as one plate.',
  same: 'Each part needs its own name.',
  blank: 'Give each part a name.',
  long: 'A part’s name can be at most 40 characters.',
  ownTooMany: 'A course can have at most 3 parts of its own.',
  dishName: 'Enter the dish’s name.',
  courseName: 'Enter the course’s name.',
  unnamed: 'The unnamed part',
} as const;

export function mw(words: string, values: Record<string, string | number>): string {
  return words.replace(/\{\{(\w+)\}\}/gu, (_, key: string) => String(values[key] ?? ''));
}

export function usesParts(how: HowServed): boolean {
  return how === 'in_parts' || how === 'family_style';
}

export function usesPlatedAt(how: HowServed): boolean {
  return how === 'family_style' || how === 'buffet';
}

export function choiceOf(dish: Dish, id: string): Choice | undefined {
  return dish.choices.find((one) => one.id === id);
}

export function partName(part: Part, dish: Dish): string {
  if (part.kind === 'fixed') return part.name;

  const choice = choiceOf(dish, part.choiceId);
  if (choice == null) return '';
  if (choice.question.trim() !== '') return choice.question;

  return mw(MW.choiceDraft, { k: dish.choices.indexOf(choice) + 1 });
}

export function isDraftPart(part: Part, dish: Dish): boolean {
  return part.kind === 'choice' && (choiceOf(dish, part.choiceId)?.question.trim() ?? '') === '';
}

/** A choice is offered as a part once it has a question, and only while it isn't one already. */
export function offeredChoices(dish: Dish, parts: readonly Part[]): Choice[] {
  const used = new Set(parts.flatMap((one) => (one.kind === 'choice' ? [one.choiceId] : [])));

  return dish.choices.filter((one) => one.question.trim() !== '' && !used.has(one.id));
}

export function canAdd(parts: readonly Part[], most: number): boolean {
  return parts.length < most;
}

export interface PartErrors {
  list: string | null;
  byKey: Record<string, string>;
}

function nameErrors(
  named: readonly { key: string; name: string; fixed: boolean }[],
): Record<string, string> {
  const byKey: Record<string, string> = {};
  const seen = new Set<string>();

  for (const one of named) {
    const name = one.name.trim();
    const folded = name.toLowerCase();

    if (one.fixed && name === '') byKey[one.key] = MW.blank;
    else if (one.fixed && one.name.length > PART_NAME_MAX) byKey[one.key] = MW.long;
    else if (seen.has(folded)) byKey[one.key] = MW.same;

    if (name !== '') seen.add(folded);
  }

  return byKey;
}

/** A dish's parts: none, or 2 to 6, each named once. The later of two same names is the one refused. */
export function checkParts(parts: readonly Part[], dish: Dish): PartErrors {
  const byKey = nameErrors(
    parts.map((one) => ({ key: one.key, name: partName(one, dish), fixed: one.kind === 'fixed' })),
  );

  return { list: parts.length === 1 ? MW.onlyOne : null, byKey };
}

/** A course's own parts: none, or 1 to 3, named under the dish's rules. */
export function checkOwn(parts: readonly FixedPart[]): PartErrors {
  return {
    list: null,
    byKey: nameErrors(parts.map((one) => ({ key: one.key, name: one.name, fixed: true }))),
  };
}

export function hasErrors(errors: PartErrors): boolean {
  return errors.list != null || Object.keys(errors.byKey).length > 0;
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
  return `${shownName(name)} moved to part ${to + 1} of ${of}.`;
}

/** sc-3904's Remove… on a choice that is a part: the part goes with it, and a single part left goes too. */
export function withoutChoice(dish: Dish, choiceId: string): Dish {
  const parts = dish.parts.filter((one) => !(one.kind === 'choice' && one.choiceId === choiceId));

  return {
    ...dish,
    choices: dish.choices.filter((one) => one.id !== choiceId),
    parts: parts.length === 1 ? [] : parts,
  };
}

export function removeChoiceLine(dish: Dish, choice: Choice, index: number): string {
  const asked = choice.question.trim() === '' ? `Choice ${index + 1}` : `“${choice.question}”`;
  const isPart = dish.parts.some((one) => one.kind === 'choice' && one.choiceId === choice.id);
  const ask = `Remove ${choice.question.trim() === '' ? 'this choice' : asked} from ${dish.name}?`;

  return isPart ? `${ask} ${asked} is also one of ${dish.name}’s parts.` : ask;
}

export function removedLine(dish: Dish, choice: Choice): string {
  return `${choice.question.trim() === '' ? 'The choice' : choice.question} removed from ${dish.name}.`;
}

export function tableLabel(table: Table): string {
  return table.section == null ? table.name : `${table.name} · ${table.section}`;
}

/** Plated at keeps only tables still in the seating plan. */
export function platedTables(course: Course, tables: readonly Table[]): Table[] {
  return tables.filter((one) => course.platedAt.includes(one.id));
}

export function keptHidden(course: Course): boolean {
  return (
    !usesParts(course.howServed) &&
    (course.ownParts.length > 0 || course.dishes.some((one) => one.parts.length > 0))
  );
}

const fixed = (key: string, name: string): FixedPart => ({ key, kind: 'fixed', name });
const choicePart = (key: string, choiceId: string): Part => ({ key, kind: 'choice', choiceId });

const SIDE: Choice = {
  id: 'ch1',
  question: 'And a side?',
  options: ['Plantain', 'Salad', 'Moi moi'],
};
const SAUCE: Choice = { id: 'ch2', question: 'And a sauce?', options: ['Shito', 'Pepper sauce'] };
const NO_QUESTION: Choice = { id: 'ch3', question: '', options: ['Mild', 'Hot'] };

export const TABLES: readonly Table[] = [
  { id: 't0', name: 'Top table', section: 'Front' },
  { id: 't1', name: 'Table 1', section: 'Front' },
  { id: 't2', name: 'Table 2', section: 'Front' },
  { id: 't3', name: 'Table 3', section: 'Garden' },
  { id: 't4', name: 'Table 4', section: 'Garden' },
  { id: 't5', name: 'Family table', section: null },
];

function jollof(parts: readonly Part[], choices: readonly Choice[] = [SIDE, SAUCE]): Dish {
  return {
    id: 'e3',
    name: 'Jollof rice',
    desc: 'Party jollof, cooked over wood.',
    contains: ['Celery'],
    variants: [],
    choices,
    parts,
  };
}

const JOLLOF_PARTS: readonly Part[] = [
  fixed('p1', 'Rice'),
  fixed('p2', 'Chicken'),
  choicePart('p3', 'ch1'),
];

const EGUSI: Dish = {
  id: 'e5',
  name: 'Pounded yam and egusi',
  desc: 'Egusi soup with spinach and smoked fish.',
  contains: ['Fish', 'Crustaceans'],
  variants: [],
  choices: [],
  parts: [],
};

const FISH: Dish = {
  id: 'e4',
  name: 'Grilled fish',
  desc: 'With pepper sauce.',
  contains: ['Fish'],
  variants: ['Croaker', 'Tilapia'],
  choices: [],
  parts: [fixed('p4', 'Fish'), fixed('p5', 'Pepper sauce'), fixed('p6', 'Yam chips')],
};

const MOI_MOI: Dish = {
  id: 'e10',
  name: 'Moi moi',
  desc: 'Steamed bean pudding with egg.',
  contains: ['Eggs'],
  variants: [],
  choices: [],
  parts: [],
};

function courses(main: Partial<Course>): Course[] {
  return [
    {
      id: 'c1',
      name: 'Starter',
      servedAt: '18:30',
      howServed: 'plated',
      dishes: [
        {
          id: 'e1',
          name: 'Canapé selection',
          desc: 'Puff pastry, smoked fish and cheese bites.',
          contains: ['Cereals containing gluten', 'Fish', 'Milk'],
          variants: [],
          choices: [],
          parts: [],
        },
      ],
      ownParts: [],
      platedAt: [],
    },
    {
      id: 'c2',
      name: 'Main',
      servedAt: '20:00',
      howServed: 'plated',
      dishes: [jollof([]), EGUSI],
      ownParts: [],
      platedAt: [],
      ...main,
    },
    {
      id: 'c3',
      name: 'Dessert',
      servedAt: '21:30',
      howServed: 'plated',
      dishes: [
        {
          id: 'e7',
          name: 'Vanilla ice cream',
          desc: '',
          contains: ['Eggs', 'Milk'],
          variants: [],
          choices: [],
          parts: [],
        },
      ],
      ownParts: [],
      platedAt: [],
    },
  ];
}

export type Panel =
  { kind: 'course'; courseId: string } | { kind: 'dish'; courseId: string; dishId: string };

export interface MenuStart {
  name: string;
  note: string;
  courses: Course[];
  tables: readonly Table[];
  panel: Panel | null;
  manage: boolean;
  /** The form as it opens: the course's way picked, a dish's parts typed, before Save is pressed. */
  how?: HowServed;
  parts?: Part[];
  own?: FixedPart[];
  pressSave?: boolean;
  pressAdd?: 'part' | 'own';
  moveFirst?: { key: string; by: -1 | 1 };
  asking?: { dishId: string; choiceId: string };
  told?: string;
  refuses?: boolean;
}

const IN_PARTS: Partial<Course> = {
  howServed: 'in_parts',
  dishes: [jollof(JOLLOF_PARTS), EGUSI],
  ownParts: [fixed('o1', 'Drink')],
};

const COURSE: Panel = { kind: 'course', courseId: 'c2' };
const DISH: Panel = { kind: 'dish', courseId: 'c2', dishId: 'e3' };

function start(o: Omit<MenuStart, 'tables' | 'manage'> & Partial<MenuStart>): MenuStart {
  return { tables: TABLES, manage: true, ...o };
}

const STATES = {
  plated: () =>
    start({
      name: 'Plated, the default',
      note: 'Every course starts Plated, and a Plated course behaves as today: nothing new on its dish rows.',
      courses: courses({}),
      panel: COURSE,
    }),
  inParts: () =>
    start({
      name: 'In parts',
      note: 'Each dish lists its parts in order, fixed names and choices; Served with this course adds a Drink.',
      courses: courses(IN_PARTS),
      panel: COURSE,
    }),
  familyStyle: () =>
    start({
      name: 'Family style',
      note: 'Parts, Served with this course and Plated at, with the top table plated anyway.',
      courses: courses({ ...IN_PARTS, howServed: 'family_style', platedAt: ['t0'] }),
      panel: COURSE,
    }),
  buffet: () =>
    start({
      name: 'Buffet',
      note: 'Plated at only. Parts kept from In parts stay, unseen, with the line saying when they’re used.',
      courses: courses({ ...IN_PARTS, howServed: 'buffet', platedAt: ['t0'] }),
      panel: COURSE,
    }),
  dishParts: () =>
    start({
      name: 'Edit dish, with parts',
      note: 'Fixed parts are named in place; a choice is shown by its question. And a sauce? is still offered, And a side? isn’t.',
      courses: courses(IN_PARTS),
      panel: DISH,
    }),
  onePlate: () =>
    start({
      name: 'A dish with no parts',
      note: 'No parts: served as one plate.',
      courses: courses(IN_PARTS),
      panel: { kind: 'dish', courseId: 'c2', dishId: 'e5' },
    }),
  choiceDraft: () =>
    start({
      name: 'A choice part with no question yet',
      note: 'Decided, 9 Nov (pm): a choice that loses its question stays a part, shown by sc-3904’s Choice 3, no question yet beside its Draft tag; one with no question isn’t offered.',
      courses: courses({
        ...IN_PARTS,
        dishes: [
          jollof(
            [fixed('p1', 'Rice'), choicePart('p3', 'ch1'), choicePart('p7', 'ch3')],
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
      note: 'Rice moved up; the polite line says where it went. Move up on the first part and Move down on the last are greyed, and say so.',
      courses: courses({
        ...IN_PARTS,
        dishes: [
          jollof([fixed('p2', 'Chicken'), fixed('p1', 'Rice'), choicePart('p3', 'ch1')]),
          EGUSI,
        ],
      }),
      panel: DISH,
      moveFirst: { key: 'p1', by: -1 },
    }),
  tooMany: () =>
    start({
      name: 'A 7th part',
      note: 'Add a part with 6 parts adds nothing, and says why beside it.',
      courses: courses(IN_PARTS),
      panel: DISH,
      parts: [
        fixed('p1', 'Rice'),
        fixed('p2', 'Chicken'),
        choicePart('p3', 'ch1'),
        fixed('p8', 'Coleslaw'),
        fixed('p9', 'Boiled egg'),
        fixed('p10', 'Pepper sauce'),
      ],
      pressAdd: 'part',
    }),
  onlyOne: () =>
    start({
      name: 'A single part',
      note: 'One part is refused on Save, and nothing is saved.',
      courses: courses(IN_PARTS),
      panel: DISH,
      parts: [fixed('p1', 'Rice')],
      pressSave: true,
    }),
  sameName: () =>
    start({
      name: 'Two parts with the same name',
      note: 'Same name, ignoring case and surrounding spaces: the later one is refused.',
      courses: courses(IN_PARTS),
      panel: DISH,
      parts: [fixed('p1', 'Rice'), fixed('p2', 'Chicken'), fixed('p11', ' rice ')],
      pressSave: true,
    }),
  blankName: () =>
    start({
      name: 'A blank part',
      note: 'A part with no name is refused beside it.',
      courses: courses(IN_PARTS),
      panel: DISH,
      parts: [fixed('p1', 'Rice'), fixed('p2', 'Chicken'), fixed('p11', '')],
      pressSave: true,
    }),
  longName: () =>
    start({
      name: 'A part over 40 characters',
      note: 'Over 40 characters is refused beside it.',
      courses: courses(IN_PARTS),
      panel: DISH,
      parts: [
        fixed('p1', 'Rice'),
        fixed('p2', 'Chicken thigh in a slow-cooked pepper and tomato stew'),
      ],
      pressSave: true,
    }),
  ownTooMany: () =>
    start({
      name: 'A 4th course part',
      note: 'Add a course part with 3 adds nothing, and says why beside it.',
      courses: courses({
        ...IN_PARTS,
        ownParts: [fixed('o1', 'Drink'), fixed('o2', 'Water'), fixed('o3', 'Bread roll')],
      }),
      panel: COURSE,
      pressAdd: 'own',
    }),
  hidden: () =>
    start({
      name: 'Switched to Plated, parts kept',
      note: 'The parts and the Drink are kept, unseen, and the dish rows go back to how a Plated course shows them.',
      courses: courses(IN_PARTS),
      panel: COURSE,
      how: 'plated',
    }),
  back: () =>
    start({
      name: 'Switched back to In parts',
      note: 'Switching back shows them as they were.',
      courses: courses({ ...IN_PARTS, howServed: 'plated' }),
      panel: COURSE,
      how: 'in_parts',
    }),
  noTables: () =>
    start({
      name: 'Plated at, no tables yet',
      note: 'The seating plan has no tables, so there is nothing to choose.',
      courses: courses({ ...IN_PARTS, howServed: 'family_style' }),
      tables: [],
      panel: COURSE,
    }),
  tableDeleted: () =>
    start({
      name: 'Plated at, after a table was deleted',
      note: 'Table 2 was deleted from the seating plan, so it has left Plated at and the list.',
      courses: courses({ ...IN_PARTS, howServed: 'buffet', platedAt: ['t0', 't2'] }),
      tables: TABLES.filter((one) => one.id !== 't2'),
      panel: COURSE,
    }),
  removeChoice: () =>
    start({
      name: 'Removing a choice that is a part',
      note: 'sc-3904’s Remove… adds that the choice is also one of the dish’s parts.',
      courses: courses(IN_PARTS),
      panel: null,
      asking: { dishId: 'e3', choiceId: 'ch1' },
    }),
  removedTwo: () =>
    start({
      name: 'Removed, 2 parts left',
      note: 'The choice went, and its part with it; Rice and Chicken stay.',
      courses: courses({
        ...IN_PARTS,
        dishes: [withoutChoice(jollof(JOLLOF_PARTS), 'ch1'), EGUSI],
      }),
      panel: null,
      told: 'And a side? removed from Jollof rice.',
    }),
  removedOne: () =>
    start({
      name: 'Removed, 1 part left',
      note: 'One part can’t stand alone, so it goes too: the dish is served as one plate.',
      courses: courses({
        ...IN_PARTS,
        dishes: [
          withoutChoice(jollof([fixed('p1', 'Rice'), choicePart('p3', 'ch1')]), 'ch1'),
          EGUSI,
        ],
      }),
      panel: null,
      told: 'And a side? removed from Jollof rice.',
    }),
  removeHidden: () =>
    start({
      name: 'Removing it on a Plated course',
      note: 'The parts are hidden on a Plated course, and the confirmation still says so.',
      courses: courses({ ...IN_PARTS, howServed: 'plated' }),
      panel: null,
      asking: { dishId: 'e3', choiceId: 'ch1' },
    }),
  variants: () =>
    start({
      name: 'A dish with variants',
      note: 'One Parts list, for every variant.',
      courses: courses({ ...IN_PARTS, dishes: [FISH, EGUSI] }),
      panel: { kind: 'dish', courseId: 'c2', dishId: 'e4' },
    }),
  fromLibrary: () =>
    start({
      name: 'A dish added from the library',
      note: 'Moi moi arrives with no parts, so it is served as one plate until parts are listed.',
      courses: courses({ ...IN_PARTS, dishes: [jollof(JOLLOF_PARTS), EGUSI, MOI_MOI] }),
      panel: { kind: 'dish', courseId: 'c2', dishId: 'e10' },
      told: mw(MW.added, { name: 'Moi moi' }),
    }),
  readOnly: () =>
    start({
      name: 'Read only, without menu.manage',
      note: 'Everything as text, and no controls.',
      courses: courses({ ...IN_PARTS, howServed: 'family_style', platedAt: ['t0'] }),
      panel: null,
      manage: false,
    }),
  forbidden: () =>
    start({
      name: 'A 403 on save',
      note: 'The role changed while the panel was open: Save is refused, and nothing is saved.',
      courses: courses(IN_PARTS),
      panel: DISH,
      refuses: true,
    }),
} satisfies Record<string, () => MenuStart>;

export type MenuStateName = keyof typeof STATES;

export function menuStart(raw: string | null): MenuStart {
  const name: MenuStateName =
    raw != null && Object.hasOwn(STATES, raw) ? (raw as MenuStateName) : 'plated';

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
    name: 'How it’s served, on Edit course',
    states: (['plated', 'inParts', 'familyStyle', 'buffet', 'hidden', 'back'] as const).map(link),
  },
  {
    name: 'A dish’s Parts, on Edit dish',
    states: (
      ['dishParts', 'onePlate', 'choiceDraft', 'moved', 'variants', 'fromLibrary'] as const
    ).map(link),
  },
  {
    name: 'Refusals, nothing saved',
    states: (
      [
        'tooMany',
        'onlyOne',
        'sameName',
        'blankName',
        'longName',
        'ownTooMany',
        'forbidden',
      ] as const
    ).map(link),
  },
  {
    name: 'Plated at',
    states: (['familyStyle', 'noTables', 'tableDeleted'] as const).map(link),
  },
  {
    name: 'Removing a choice that is a part, and read only',
    states: (['removeChoice', 'removedTwo', 'removedOne', 'removeHidden', 'readOnly'] as const).map(
      link,
    ),
  },
];

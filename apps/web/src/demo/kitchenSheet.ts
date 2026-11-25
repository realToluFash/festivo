import { pickWords } from './courseDefault.ts';
import { demoWords } from './demoWords.ts';
import { type SampleEvent, localDay } from './events.ts';
import { ALLERGENS, type Allergen, DIETS, GUEST_KITCHEN_NAMES } from './guestKitchenWords.ts';
import { KITCHEN_EVENT } from './kitchen.ts';
import {
  type ItemsMenu,
  type StationBlock,
  byStation,
  sampleMenu,
  withItems,
} from './kitchenStations.ts';
import type { EvCourse, EvDish } from './menuCourses.ts';
import {
  type Person,
  type PicksWorld,
  type Spot,
  courseFigures,
  defaultOf,
  pickName,
  picksAfterClose,
  samplePicks,
  shownCourses,
  spotOf,
} from './seePicks.ts';
import type { DemoLink } from './settings.ts';

/** sc-3911's kitchen sheet (boards KitchenSheet-Desktop, -NarrowWeb and -PrintA4): allergies first, then diets, then what to cook, from See picks' own figures. All words are proposals for [en]. */
export const KSW = {
  title: 'Kitchen sheet',
  crumb: 'Where you are',
  events: 'Events',
  menu: 'Menu',
  asOf: 'As of {{at}}',
  download: 'Download PDF',
  making: 'Making the PDF',
  print: 'Print',
  made: '{{file}} is ready. The demo makes no PDF.',
  failed: 'The PDF could not be made. The sheet on this page is unchanged, and Print still works.',
  retry: 'Try again',
  coming: '{{count}} coming',
  allergic_one: '{{count}} person with allergies',
  allergic_other: '{{count}} people with allergies',
  courses_one: '{{count}} course',
  courses_other: '{{count}} courses',
  allergies: 'Allergies',
  noAllergies: 'No allergies recorded for anyone coming.',
  name: 'Name',
  allergicTo: 'Allergic to',
  noAllergy: 'No allergy · {{diets}}',
  allergen: 'Allergen',
  people: 'People',
  perAllergen: '{{allergen}} {{count}}',
  otherAllergy: '{{what}} (other)',
  namesNeed: 'Names need Guests manage.',
  diets: 'Diets',
  diet: 'Diet',
  noDiets: 'No diets recorded for anyone coming.',
  otherDiet: 'Other diet',
  dish: 'Dish',
  variant: 'Variant · {{name}}',
  side: 'Side · {{name}}',
  kitchen: 'Kitchen’s choice',
  skipped: 'Skipped',
  needsHost: 'Needs the host',
  changed: 'Menu changed',
  notYet: '{{count}} not chosen yet',
  never: '{{count}} not chosen, never given the default',
  cellNotYet: 'Not chosen yet',
  cellNever: 'Not chosen, never given the default',
  room: 'The room',
  given: '{{count}} given the default, {{dish}}, when picks closed. They are in its count.',
  sides: 'Sides are counted per pick, so they add up to their dish, not to the room.',
  loading: 'Loading the kitchen sheet…',
  cannotReach: 'The kitchen sheet could not be loaded.',
  refused: 'You cannot open the kitchen sheet',
  back: 'Back to the event',
  health:
    'This sheet holds guests’ health information. Keep it with the kitchen and dispose of it after the event.',
  page: 'Page {{n}} of {{m}}',
  toSheet: 'Back to the sheet',
  printNow: 'Print this page',
  a4: 'A4',
  letter: 'Letter',
  paperIs: 'Paper',
  byStation: 'By station',
  chefs: 'Chef’s choice',
} as const;

const { filled, many } = demoWords(KSW);

export { filled as ksw, many as kswMany };

export type SheetState =
  | 'open'
  | 'closed'
  | 'noAllergies'
  | 'closedNoAllergies'
  | 'loading'
  | 'cannotReach'
  | 'making'
  | 'failed'
  | 'refused';
export type SheetAccess = 'manage' | 'counts';
export type Paper = 'a4' | 'letter';
/** sc-34244: `plain` is sc-3911's menu, no items and every dish at the Pass; `items` gives the Main and the Dessert items and stations; `moved` is the same after a lead moves Grill before Kitchen. */
export type SheetMenu = 'plain' | 'items' | 'moved';

export interface SheetStart {
  state: SheetState;
  access: SheetAccess;
  paper: Paper | null;
  menu: SheetMenu;
}

const STATES: Readonly<Record<SheetState, string>> = {
  open: 'Open, before picks close',
  closed: 'After the close: defaults given, the rest never given the default',
  noAllergies: 'No allergies recorded',
  closedNoAllergies:
    'After the close, no allergies recorded: only diets kept people from the default',
  loading: 'Loading',
  cannotReach: 'Cannot reach the sheet: it did not load, Try again loads it',
  making: 'Making the PDF',
  failed: 'The PDF could not be made',
  refused: 'Refused: no Menu read (403)',
};

const isState = (raw: string | null): raw is SheetState =>
  raw != null && Object.hasOwn(STATES, raw);

export function sheetStart(params: URLSearchParams): SheetStart {
  const raw = params.get('state');
  const paper = params.get('paper');
  const menu = params.get('menu');

  return {
    state: isState(raw) ? raw : 'open',
    access: params.get('access') === 'counts' ? 'counts' : 'manage',
    paper: paper === 'a4' || paper === 'letter' ? paper : null,
    menu: menu === 'items' || menu === 'moved' ? menu : 'plain',
  };
}

export function sheetAt(
  state: SheetState = 'open',
  access: SheetAccess = 'manage',
  paper: Paper | null = null,
  menu: SheetMenu = 'plain',
): string {
  const more = [
    `state=${state}`,
    ...(access === 'counts' ? ['access=counts'] : []),
    ...(paper == null ? [] : [`paper=${paper}`]),
    ...(menu === 'plain' ? [] : [`menu=${menu}`]),
  ];

  return `/demo/events/${KITCHEN_EVENT}/kitchen/sheet?${more.join('&')}`;
}

/** What an Other allergy says, as the guest typed it; See picks keeps only the codes. Leila already has an allergy, so the room's figures are See picks' own. */
const OTHER_ALLERGY: Readonly<Record<string, string>> = { 'leila-haddad': 'Kiwi' };

const withOther = (world: PicksWorld): PicksWorld => ({
  ...world,
  people: world.people.map((person) =>
    OTHER_ALLERGY[person.id] == null || person.allergies.length === 0
      ? person
      : { ...person, allergies: [...person.allergies, 'other'] },
  ),
});

const noAllergies = (world: PicksWorld): PicksWorld => ({
  ...world,
  people: world.people.map((person) => ({ ...person, allergies: [] })),
});

/** The room of 48 from See picks; after the close, sc-1362's defaults; with no allergies, the same room with none recorded, before or after the close. A menu with items adds Fried yam to Coconut rice's side, picked by nobody, and an optional side to Zobo sorbet. */
export function worldOf(state: SheetState, menu: SheetMenu = 'plain'): PicksWorld {
  const world = roomOf(state);

  return menu === 'plain' ? world : withItems(world);
}

function roomOf(state: SheetState): PicksWorld {
  if (state === 'closed') return withOther(picksAfterClose());
  if (state === 'closedNoAllergies') return noAllergies(picksAfterClose());
  if (state === 'noAllergies') return noAllergies(samplePicks());

  return withOther(samplePicks());
}

/** The stations' reading of the menu: none on sc-3911's own, so no course shows By station. */
export function menuOf(menu: SheetMenu): ItemsMenu | null {
  if (menu === 'plain') return null;

  return menu === 'moved' ? sampleMenu(['grill', 'kitchen', 'pastry']) : sampleMenu();
}

const allergenWords = (code: Allergen, person: Person): string => {
  const what = code === 'other' ? OTHER_ALLERGY[person.id] : undefined;

  return what == null ? NAMES.allergens[code] : filled(KSW.otherAllergy, { what });
};

const dietWords = (code: Person['diets'][number]): string =>
  code === 'other' ? KSW.otherDiet : NAMES.diets[code];

/** What an Other diet says, as the guest typed it (sc-3777 keeps `otherDiet`); a named row reads it as an Other allergy does (Decided, 23 Nov: an Other diet). Counts keep "Other diet". */
const OTHER_DIET: Readonly<Record<string, string>> = { 'nadia-petrova': 'No garlic' };

const namedDietWords = (code: Person['diets'][number], person: Person): string => {
  const what = code === 'other' ? OTHER_DIET[person.id] : undefined;

  return what == null ? dietWords(code) : filled(KSW.otherAllergy, { what });
};

/** "Peanuts, Celery", or for someone never given the default for a diet alone (Decided, 23 Nov), "No allergy · Vegetarian" or "No allergy · No garlic (other)". */
const allergicTo = (person: Person): string =>
  person.allergies.length > 0
    ? ALLERGENS.filter((code) => person.allergies.includes(code))
        .map((code) => allergenWords(code, person))
        .join(', ')
    : filled(KSW.noAllergy, {
        diets: person.diets.map((code) => namedDietWords(code, person)).join(', '),
      });

export type Cell =
  | { kind: 'dish'; text: string }
  | { kind: 'kitchen' | 'skipped' | 'host' | 'changed' | 'notYet' | 'never' };

export interface AllergicRow {
  id: string;
  name: string;
  /** False for someone listed only because a diet kept them from the default; they are not in the allergy counts. */
  allergy: boolean;
  allergens: string;
  cells: readonly Cell[];
}

export interface SheetRow {
  id: string;
  kind: 'dish' | 'variant' | 'side' | 'kitchen' | 'skipped' | 'host' | 'changed' | 'none';
  name: string;
  count: number;
}

export interface SheetCourse {
  course: EvCourse;
  rows: readonly SheetRow[];
  room: number;
  given: string | null;
  sides: boolean;
  /** sc-34244's By station, null on a course with no items and nothing served from anywhere but the Pass. */
  stations: readonly StationBlock[] | null;
}

export interface Sheet {
  coming: number;
  /** Everyone with an allergy, and after the close everyone a diet alone kept from the default, by name. */
  allergic: readonly AllergicRow[];
  /** The people with allergies, for "{n} people with allergies". */
  withAllergies: number;
  allergyCounts: readonly (readonly [string, number])[];
  dietCounts: readonly (readonly [string, number])[];
  courses: readonly SheetCourse[];
}

const NAMES = GUEST_KITCHEN_NAMES.en;

const closed = (world: PicksWorld, course: EvCourse): boolean =>
  defaultOf(world, course)?.passed === true;

function cellOf(world: PicksWorld, course: EvCourse, spot: Spot): Cell {
  switch (spot.kind) {
    case 'dish': {
      const dish = course.dishes.find((one) => one.id === spot.dishId) as EvDish;
      return { kind: 'dish', text: pickName(dish, spot) };
    }
    case 'none':
      return { kind: spot.excluded != null && closed(world, course) ? 'never' : 'notYet' };
    default:
      return { kind: spot.kind };
  }
}

function courseOf(world: PicksWorld, course: EvCourse, menu: ItemsMenu | null): SheetCourse {
  const figures = courseFigures(world, course);
  const given = defaultOf(world, course);
  const defaulted = figures.rows
    .filter((row) => row.kind === 'dish')
    .reduce((sum, row) => sum + row.defaulted, 0);
  const states: SheetRow[] = [
    { id: 'kitchen', kind: 'kitchen', name: KSW.kitchen, count: figures.kitchen },
    { id: 'skipped', kind: 'skipped', name: KSW.skipped, count: figures.skipped },
    { id: 'host', kind: 'host', name: KSW.needsHost, count: figures.host },
    { id: 'changed', kind: 'changed', name: KSW.changed, count: figures.changed },
    {
      id: 'none',
      kind: 'none',
      name: filled(closed(world, course) ? KSW.never : KSW.notYet, { count: figures.none }),
      count: figures.none,
    },
  ];

  return {
    course,
    rows: [
      ...figures.rows.map((row): SheetRow => ({
        id: row.id,
        kind: row.kind === 'option' ? 'side' : row.kind,
        name:
          row.kind === 'dish'
            ? row.name
            : filled(row.kind === 'variant' ? KSW.variant : KSW.side, { name: row.name }),
        count: row.chosen + row.defaulted,
      })),
      ...states.filter((row) => row.kind === 'kitchen' || row.kind === 'skipped' || row.count > 0),
    ],
    room: figures.room,
    given:
      given?.passed === true && defaulted > 0
        ? filled(KSW.given, { count: defaulted, dish: pickWords(course, given.pick) })
        : null,
    sides: figures.rows.some((row) => row.kind === 'option'),
    stations: menu == null ? null : byStation(menu, world, course),
  };
}

/** Everyone coming in one place per course, in the order the kitchen reads it: who must not eat what, then the diets, then each course's counts. */
export function sheetOf(world: PicksWorld, menu: ItemsMenu | null = null): Sheet {
  const courses = shownCourses(world);
  const people = world.people;
  const rows = people.map((person) => ({
    id: person.id,
    name: person.name,
    allergy: person.allergies.length > 0,
    allergens: allergicTo(person),
    cells: courses.map((course) => cellOf(world, course, spotOf(world, course, person))),
  }));

  return {
    coming: people.length,
    allergic: rows
      .filter((row) => row.allergy || row.cells.some((cell) => cell.kind === 'never'))
      .sort((a, b) => a.name.localeCompare(b.name, 'en')),
    withAllergies: rows.filter((row) => row.allergy).length,
    allergyCounts: ALLERGENS.map(
      (code) =>
        [
          NAMES.allergens[code],
          people.filter((one) => one.allergies.includes(code)).length,
        ] as const,
    ).filter(([, count]) => count > 0),
    dietCounts: [...DIETS, 'other' as const]
      .map(
        (code) =>
          [dietWords(code), people.filter((one) => one.diets.includes(code)).length] as const,
      )
      .filter(([, count]) => count > 0),
    courses: courses.map((course) => courseOf(world, course, menu)),
  };
}

export function summaryLine(sheet: Sheet): string {
  return [
    filled(KSW.coming, { count: sheet.coming }),
    many('allergic', sheet.withAllergies),
    many('courses', sheet.courses.length),
  ].join(' · ');
}

const AS_OF = new Intl.DateTimeFormat('en-US', {
  weekday: 'long',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});
/** "As of Tuesday, Jun 8 · 19:42" as the board reads, in the event's time zone, 24-hour. */
export function asOfLine(now: Date, timeZone: string): string {
  const day = AS_OF.format(new Date(`${localDay(now, timeZone)}T12:00:00Z`));
  const time = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  }).format(now);

  return filled(KSW.asOf, { at: `${day} · ${time}` });
}

/** "{event} kitchen sheet {YYYY-MM-DD}.pdf", the snapshot's date, so files sort. */
export const pdfName = (event: SampleEvent, now: Date): string =>
  `${event.name} kitchen sheet ${localDay(now, event.timeZone)}.pdf`;

const MENU_NAMES: Readonly<Record<SheetMenu, string>> = {
  plain: '',
  items: '',
  moved: ', after a lead moves Grill before Kitchen',
};

const link = (
  state: SheetState,
  access: SheetAccess = 'manage',
  paper: Paper | null = null,
  menu: SheetMenu = 'plain',
) => ({
  to: sheetAt(state, access, paper, menu),
  name: `${STATES[state]}${MENU_NAMES[menu]}${access === 'counts' ? ', counts only' : ''}${
    paper == null ? '' : `, printed on ${paper === 'a4' ? KSW.a4 : KSW.letter}`
  }`,
});

export const SHEET_PAGES: readonly { name: string; states: readonly DemoLink[] }[] = [
  {
    name: 'With Guests manage: names in Allergies',
    states: (
      [
        'open',
        'closed',
        'noAllergies',
        'closedNoAllergies',
        'loading',
        'cannotReach',
        'making',
        'failed',
        'refused',
      ] as const
    ).map((state) => link(state)),
  },
  {
    name: 'Counts only: Guests read, or neither',
    states: (['open', 'closed', 'noAllergies', 'closedNoAllergies', 'failed'] as const).map(
      (state) => link(state, 'counts'),
    ),
  },
  {
    name: 'The printout and the PDF',
    states: [
      link('open', 'manage', 'a4'),
      link('closed', 'manage', 'a4'),
      link('noAllergies', 'manage', 'a4'),
      link('closedNoAllergies', 'manage', 'a4'),
      link('open', 'counts', 'a4'),
      link('closed', 'counts', 'a4'),
      link('open', 'manage', 'letter'),
      link('closed', 'counts', 'letter'),
    ],
  },
];

/** sc-34244's states: By station under the Main and the Dessert, the Starter as sc-3911 draws it. */
export const STATION_PAGES: readonly { name: string; states: readonly DemoLink[] }[] = [
  {
    name: 'By station under each course, at a desk and from 320 px',
    states: [
      link('open', 'manage', null, 'items'),
      link('closed', 'manage', null, 'items'),
      link('open', 'manage', null, 'moved'),
      link('open', 'counts', null, 'items'),
      link('closed', 'counts', null, 'items'),
      {
        to: sheetAt('open'),
        name: 'A menu with no items, every dish at the Pass: sc-3911’s sheet, no By station',
      },
    ],
  },
  {
    name: 'The printout and the PDF, carrying By station',
    states: [
      link('open', 'manage', 'a4', 'items'),
      link('closed', 'counts', 'a4', 'items'),
      link('open', 'manage', 'letter', 'moved'),
      link('making', 'manage', null, 'items'),
      link('failed', 'manage', null, 'items'),
    ],
  },
];

import { pickWords } from './courseDefault.ts';
import { demoWords } from './demoWords.ts';
import { type SampleEvent, localDay } from './events.ts';
import { ALLERGENS, DIETS, GUEST_KITCHEN_NAMES } from './guestKitchenWords.ts';
import { KITCHEN_EVENT } from './kitchen.ts';
import type { EvCourse, EvDish } from './menuCourses.ts';
import {
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
  failed: 'The PDF couldn’t be made. The sheet on this page is unchanged, and Print still works.',
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
  allergen: 'Allergen',
  people: 'People',
  perAllergen: '{{allergen}} {{count}}',
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
  refused: 'You can’t open the kitchen sheet',
  back: 'Back to the event',
  health:
    'This sheet holds guests’ health information. Keep it with the kitchen and dispose of it after the event.',
  page: 'Page {{n}} of {{m}}',
  toSheet: 'Back to the sheet',
  printNow: 'Print this page',
  a4: 'A4',
  letter: 'Letter',
  paperIs: 'Paper',
} as const;

const { filled, many } = demoWords(KSW);

export { filled as ksw, many as kswMany };

export type SheetState =
  'open' | 'closed' | 'noAllergies' | 'loading' | 'making' | 'failed' | 'refused';
export type SheetAccess = 'manage' | 'counts';
export type Paper = 'a4' | 'letter';

export interface SheetStart {
  state: SheetState;
  access: SheetAccess;
  paper: Paper | null;
}

const STATES: Readonly<Record<SheetState, string>> = {
  open: 'Open, before picks close',
  closed: 'After the close: defaults given, the rest never given the default',
  noAllergies: 'No allergies recorded',
  loading: 'Loading',
  making: 'Making the PDF',
  failed: 'The PDF could not be made',
  refused: 'Refused: no Menu read (403)',
};

const isState = (raw: string | null): raw is SheetState =>
  raw != null && Object.hasOwn(STATES, raw);

export function sheetStart(params: URLSearchParams): SheetStart {
  const raw = params.get('state');
  const paper = params.get('paper');

  return {
    state: isState(raw) ? raw : 'open',
    access: params.get('access') === 'counts' ? 'counts' : 'manage',
    paper: paper === 'a4' || paper === 'letter' ? paper : null,
  };
}

export function sheetAt(
  state: SheetState = 'open',
  access: SheetAccess = 'manage',
  paper: Paper | null = null,
): string {
  const more = [
    `state=${state}`,
    ...(access === 'counts' ? ['access=counts'] : []),
    ...(paper == null ? [] : [`paper=${paper}`]),
  ];

  return `/demo/events/${KITCHEN_EVENT}/kitchen/sheet?${more.join('&')}`;
}

/** The room of 48 from See picks; after the close, sc-1362's defaults; with no allergies, the same room with none recorded. */
export function worldOf(state: SheetState): PicksWorld {
  if (state === 'closed') return picksAfterClose();
  const world = samplePicks();
  if (state !== 'noAllergies') return world;

  return { ...world, people: world.people.map((person) => ({ ...person, allergies: [] })) };
}

export type Cell =
  | { kind: 'dish'; text: string }
  | { kind: 'kitchen' | 'skipped' | 'host' | 'changed' | 'notYet' | 'never' };

export interface AllergicRow {
  id: string;
  name: string;
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
}

export interface Sheet {
  coming: number;
  allergic: readonly AllergicRow[];
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

function courseOf(world: PicksWorld, course: EvCourse): SheetCourse {
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
  };
}

/** Everyone coming in one place per course, in the order the kitchen reads it: who must not eat what, then the diets, then each course's counts. */
export function sheetOf(world: PicksWorld): Sheet {
  const courses = shownCourses(world);
  const people = world.people;

  return {
    coming: people.length,
    allergic: [...people]
      .filter((person) => person.allergies.length > 0)
      .sort((a, b) => a.name.localeCompare(b.name, 'en'))
      .map((person) => ({
        id: person.id,
        name: person.name,
        allergens: ALLERGENS.filter((code) => person.allergies.includes(code))
          .map((code) => NAMES.allergens[code])
          .join(', '),
        cells: courses.map((course) => cellOf(world, course, spotOf(world, course, person))),
      })),
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
          [
            code === 'other' ? KSW.otherDiet : NAMES.diets[code],
            people.filter((one) => one.diets.includes(code)).length,
          ] as const,
      )
      .filter(([, count]) => count > 0),
    courses: courses.map((course) => courseOf(world, course)),
  };
}

export function summaryLine(sheet: Sheet): string {
  return [
    filled(KSW.coming, { count: sheet.coming }),
    many('allergic', sheet.allergic.length),
    many('courses', sheet.courses.length),
  ].join(' · ');
}

const AS_OF = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});
/** "As of Tuesday, 3 Nov · 09:41", in the event's time zone, 24-hour. */
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

const link = (state: SheetState, access: SheetAccess = 'manage', paper: Paper | null = null) => ({
  to: sheetAt(state, access, paper),
  name: `${STATES[state]}${access === 'counts' ? ', counts only' : ''}${
    paper == null ? '' : `, printed on ${paper === 'a4' ? KSW.a4 : KSW.letter}`
  }`,
});

export const SHEET_PAGES: readonly { name: string; states: readonly DemoLink[] }[] = [
  {
    name: 'With Guests manage: names in Allergies',
    states: (
      ['open', 'closed', 'noAllergies', 'loading', 'making', 'failed', 'refused'] as const
    ).map((state) => link(state)),
  },
  {
    name: 'Counts only: Guests read, or neither',
    states: (['open', 'closed', 'noAllergies', 'failed'] as const).map((state) =>
      link(state, 'counts'),
    ),
  },
  {
    name: 'The printout and the PDF',
    states: [
      link('open', 'manage', 'a4'),
      link('closed', 'manage', 'a4'),
      link('open', 'counts', 'a4'),
      link('closed', 'counts', 'a4'),
      link('open', 'manage', 'letter'),
      link('closed', 'counts', 'letter'),
    ],
  },
];

/** Guest requests from the table (sc-4023, Requests.dc.html on page 35): who owns one, what it offers, Change a plate's choices and Next's order, on the tray model of 9 Nov. */

import { LEAD } from './HowItsGoingModel.ts';

export type Kind = 'table' | 'plate' | 'moment' | 'other';
export const KINDS: readonly Kind[] = ['table', 'plate', 'moment', 'other'];
export const KIND_WORD: Record<Kind, string> = {
  table: 'Something for the table',
  plate: 'Change a plate',
  moment: 'A moment',
  other: 'Other',
};

export type Stage = 'To serve' | 'Dishing' | 'Checked' | 'On its way' | 'Served';
export type CourseId = 'mains' | 'dessert';

export interface Flag {
  kind: 'allergen' | 'diet' | 'other';
  code?: string;
  words: string;
}

export interface Seat {
  n: number;
  name: string | null;
  flags: Flag[];
  orders: Partial<Record<CourseId, { dish: string; stage: Stage }>>;
}

export interface Dish {
  name: string;
  course: CourseId;
  /** null: the menu doesn't state its allergens. */
  contains: string[] | null;
  suitable: string[];
  /** A choice inside the dish, which a change leaves to the chef. */
  choice?: string;
}

export interface Course {
  id: CourseId;
  name: string;
  fired: boolean;
}

export interface Table {
  name: string;
  section: string;
  staffed: string[];
  courses: Course[];
  seats: Seat[];
}

export interface GuestRequest {
  id: string;
  table: string;
  section: string;
  seat: number | null;
  kind: Kind;
  words: string;
  opened: string;
  owner: string | null;
  plate?: { course: CourseId; now: string; next: string };
  closed?: { outcome: 'Done' | 'Declined'; by: string; at: string; reason?: string };
}

export interface Viewer {
  name: string;
  section: string;
  manage: boolean;
  lead: boolean;
}

export const NOW = '20:24';
export const AS_OF = '20:22';
export const ME: Viewer = { name: 'Bisi Lawal', section: 'B', manage: false, lead: false };
export const THE_LEAD: Viewer = { name: LEAD, section: 'B', manage: true, lead: true };
export const HOST: Viewer = { name: 'Kemi Bello', section: 'A', manage: true, lead: false };
export const OTHER = 'Grace Udo';

export const MENU: readonly Dish[] = [
  {
    name: 'Grilled fish · pepper sauce',
    course: 'mains',
    contains: ['fish'],
    suitable: [],
  },
  {
    name: 'Grilled fish · groundnut sauce',
    course: 'mains',
    contains: ['fish', 'peanuts'],
    suitable: [],
  },
  {
    name: 'Chicken',
    course: 'mains',
    contains: ['celery'],
    suitable: ['Halal'],
    choice: 'Jollof or fried rice',
  },
  {
    name: 'Vegetable stew',
    course: 'mains',
    contains: [],
    suitable: ['Vegan', 'Vegetarian', 'Halal'],
  },
  { name: 'Goat curry', course: 'mains', contains: null, suitable: ['Halal'] },
  {
    name: 'Puff-puff',
    course: 'dessert',
    contains: ['gluten', 'egg', 'sesame'],
    suitable: ['Vegetarian'],
  },
  {
    name: 'Fruit salad',
    course: 'dessert',
    contains: [],
    suitable: ['Vegan', 'Vegetarian', 'Halal'],
  },
  {
    name: 'Chin chin',
    course: 'dessert',
    contains: ['gluten', 'milk', 'egg'],
    suitable: ['Vegetarian'],
  },
];

const PEANUT: Flag = { kind: 'allergen', code: 'peanuts', words: 'Peanut allergy' };
const SESAME: Flag = { kind: 'allergen', code: 'sesame', words: 'Sesame allergy' };

export function table9(): Table {
  return {
    name: 'Table 9',
    section: 'B',
    staffed: [ME.name, OTHER],
    courses: [
      { id: 'mains', name: 'Mains', fired: true },
      { id: 'dessert', name: 'Dessert', fired: false },
    ],
    seats: [
      {
        n: 1,
        name: 'Mrs. Funke Adeyemi',
        flags: [PEANUT],
        orders: { mains: { dish: 'Grilled fish · pepper sauce', stage: 'To serve' } },
      },
      {
        n: 2,
        name: 'Hauwa Sani',
        flags: [{ kind: 'diet', words: 'Halal' }],
        orders: { mains: { dish: 'Chicken', stage: 'Dishing' } },
      },
      { n: 3, name: null, flags: [], orders: { mains: { dish: 'Chicken', stage: 'To serve' } } },
      {
        n: 4,
        name: 'Adaora Eze',
        flags: [{ kind: 'other', words: 'Other allergy · kiwi' }],
        orders: { mains: { dish: 'Vegetable stew', stage: 'To serve' } },
      },
      {
        n: 5,
        name: null,
        flags: [SESAME],
        orders: { mains: { dish: 'Goat curry', stage: 'Checked' } },
      },
      { n: 6, name: null, flags: [], orders: {} },
    ],
  };
}

export function table7(allPast = false): Table {
  return {
    name: 'Table 7',
    section: 'B',
    staffed: [ME.name, OTHER],
    courses: [
      { id: 'mains', name: 'Mains', fired: true },
      { id: 'dessert', name: 'Dessert', fired: true },
    ],
    seats: [1, 2, 3, 4].map((n) => ({
      n,
      name: null,
      flags: [],
      orders: {
        mains: { dish: 'Chicken', stage: 'Served' },
        dessert: {
          dish: 'Puff-puff',
          stage: n === 2 && !allPast ? 'To serve' : n === 1 ? 'Served' : 'Dishing',
        },
      },
    })),
  };
}

export function table12(): Table {
  return { ...table9(), name: 'Table 12', section: 'C', staffed: [] };
}

export function who(seat: Seat): string {
  return seat.name ?? `seat ${seat.n}`;
}

function minutes(hhmm: string): number {
  const [h = 0, m = 0] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function openFor(r: GuestRequest, now = NOW): number {
  return minutes(now) - minutes(r.opened);
}

/** A course can still change at a seat before it is fired, or while that seat's order is To serve, or when a fired course has no order there yet. */
export function canChange(table: Table, seat: Seat, course: Course): boolean {
  if (!course.fired) return true;
  const order = seat.orders[course.id];
  return order == null || order.stage === 'To serve';
}

export function changeableCourses(table: Table, seat: Seat): Course[] {
  return table.courses.filter((c) => canChange(table, seat, c));
}

export function seatWhy(table: Table, seat: Seat): string | null {
  if (changeableCourses(table, seat).length > 0) return null;
  const past = table.courses.map((c) => `${c.name} is ${seat.orders[c.id]?.stage ?? 'Served'}`);
  return `Seat ${seat.n} · nothing can change: ${past.join(', ')}.`;
}

export function noSeatCanChange(table: Table): boolean {
  return table.seats.every((s) => seatWhy(table, s) != null);
}

export const NO_SEAT_LINE =
  'No plate at this table can change now: every course is fired and no order is at To serve.';

/** Why a dish can't be chosen for a guest, by their flags against what it contains, or null. A diet refuses nothing, and an Other allergy isn't checked. */
export function refusal(seat: Seat, dish: Dish): string | null {
  const allergens = seat.flags.filter((f) => f.kind === 'allergen');
  for (const f of allergens) {
    if (dish.contains?.includes(f.code ?? '')) return `Not for ${who(seat)} · ${f.words}`;
  }
  if (allergens.length > 0 && dish.contains == null)
    return `Not for ${who(seat)} · allergens not stated`;
  return null;
}

export function otherLine(seat: Seat): string | null {
  const other = seat.flags.find((f) => f.kind === 'other');
  if (other == null) return null;
  const what = other.words.split(' · ')[1] ?? 'other allergy';
  return `${who(seat)}’s other allergy, ${what}, isn’t checked against the menu.`;
}

export interface DishOption {
  dish: Dish;
  refused: string | null;
}

export interface CourseOptions {
  course: Course;
  now: string | null;
  dishes: DishOption[];
}

export function dishOptions(table: Table, seat: Seat): CourseOptions[] {
  return changeableCourses(table, seat).map((course) => {
    const now = seat.orders[course.id]?.dish ?? null;
    return {
      course,
      now,
      dishes: MENU.filter((d) => d.course === course.id && d.name !== now).map((dish) => ({
        dish,
        refused: refusal(seat, dish),
      })),
    };
  });
}

export interface Form {
  kind: Kind | null;
  who: 'table' | number | null;
  dish: string | null;
  words: string;
}

export const EMPTY_FORM: Form = { kind: null, who: 'table', dish: null, words: '' };
export const WORDS_MAX = 200;

export type FieldName = 'kind' | 'seat' | 'dish' | 'words';
export const FIELD_ERROR: Record<FieldName, string> = {
  kind: 'Choose a kind',
  seat: 'Choose the seat whose plate changes',
  dish: 'Choose the new dish',
  words: 'Say what they asked for',
};

export function check(form: Form, table: Table): FieldName[] {
  const wrong: FieldName[] = [];
  if (form.kind == null) wrong.push('kind');
  if (form.kind === 'plate') {
    const seat = table.seats.find((s) => s.n === form.who);
    if (seat == null || seatWhy(table, seat) != null) wrong.push('seat');
    else if (!optionAllowed(table, seat, form.dish)) wrong.push('dish');
  }
  if (form.words.trim() === '') wrong.push('words');
  return wrong;
}

function optionAllowed(table: Table, seat: Seat, dish: string | null): boolean {
  return dishOptions(table, seat).some((c) =>
    c.dishes.some((d) => d.dish.name === dish && d.refused == null),
  );
}

export function routeLine(form: Form, table: Table, me = ME): string {
  if (form.kind === 'moment') return `Goes to ${LEAD}, floor lead, and onto the run of show.`;
  if (table.staffed.length === 0)
    return `Goes to ${LEAD}, floor lead. Nobody is on Section ${table.section}.`;
  const people = table.staffed.map((p) => (p === me.name ? 'you' : p)).join(' and ');
  return `Goes to Section ${table.section}: ${people}. Whoever takes it first has it.`;
}

export type Action = 'take' | 'done' | 'decline';
export const ACTION_WORD: Record<Action, string> = {
  take: 'I’ll do it',
  done: 'Done',
  decline: 'Decline',
};

/** The buttons a person has on a request: anyone takes an open one, its taker closes it, and service.manage closes any; a moment is the floor lead's alone, whoever else has service.manage. */
export function actions(r: GuestRequest, v: Viewer): Action[] {
  if (r.closed != null) return [];
  if (r.kind === 'moment') return v.lead ? ['done', 'decline'] : [];
  if (r.owner === v.name) return ['done', 'decline'];
  if (r.owner == null) return v.manage ? ['take', 'done', 'decline'] : ['take', 'decline'];
  return v.manage ? ['done', 'decline'] : [];
}

export function ownerLine(r: GuestRequest, v: Viewer, now = NOW): string {
  const open = `open ${openFor(r, now)} min`;
  if (r.kind === 'moment') return `With ${LEAD}, floor lead · ${open}`;
  if (r.owner == null) return `Nobody on it · ${open}`;
  if (r.owner === v.name) return `You’re on it · ${open}`;
  return `${r.owner} is on it · ${open}`;
}

export function kindLine(r: GuestRequest): string {
  return r.seat == null ? KIND_WORD[r.kind] : `${KIND_WORD[r.kind]} · seat ${r.seat}`;
}

export function closedLine(r: GuestRequest): string {
  if (r.closed == null) return '';
  return `${r.closed.outcome} · ${r.closed.by} · ${r.closed.at}`;
}

/** A person owns an open request nobody has taken at a table on their station, or at a station with nobody on it when they lead; and one they have taken, anywhere. Never a moment. */
export function owns(r: GuestRequest, v: Viewer, staffed: Record<string, boolean>): boolean {
  if (r.closed != null || r.kind === 'moment') return false;
  if (r.owner != null) return r.owner === v.name;
  if (r.section === v.section) return true;
  return v.lead && staffed[r.section] === false;
}

export interface Tray {
  table: string;
  plates: number;
  line: string;
}

export type NextItem =
  | { kind: 'inHand' | 'given' | 'nextTray'; tray: Tray }
  | { kind: 'request'; request: GuestRequest };

/** Next: the tray in hand, then a tray given to you, then your requests oldest opened first, then the next tray. */
export function nextOrder(
  trays: { inHand: Tray | null; given: Tray | null; next: Tray | null },
  requests: readonly GuestRequest[],
  v: Viewer,
  staffed: Record<string, boolean>,
): NextItem[] {
  const mine = requests
    .filter((r) => owns(r, v, staffed))
    .sort((a, b) => minutes(a.opened) - minutes(b.opened));
  return [
    ...(trays.inHand ? [{ kind: 'inHand' as const, tray: trays.inHand }] : []),
    ...(trays.given ? [{ kind: 'given' as const, tray: trays.given }] : []),
    ...mine.map((request) => ({ kind: 'request' as const, request })),
    ...(trays.next ? [{ kind: 'nextTray' as const, tray: trays.next }] : []),
  ];
}

export const STAFFED: Record<string, boolean> = { A: true, B: true, C: false, D: true, E: true };

export function requests(): GuestRequest[] {
  return [
    {
      id: 'chair',
      table: 'Table 9',
      section: 'B',
      seat: 6,
      kind: 'table',
      words: 'A high chair for seat 6.',
      opened: '20:12',
      owner: null,
    },
    {
      id: 'stew',
      table: 'Table 9',
      section: 'B',
      seat: 1,
      kind: 'plate',
      words: 'Would like the vegetable stew instead of the fish.',
      opened: '20:16',
      owner: ME.name,
      plate: { course: 'mains', now: 'Grilled fish · pepper sauce', next: 'Vegetable stew' },
    },
    {
      id: 'blind',
      table: 'Table 9',
      section: 'B',
      seat: null,
      kind: 'other',
      words: 'Could the blind behind them come down a little?',
      opened: '20:18',
      owner: OTHER,
    },
    {
      id: 'song',
      table: 'Table 9',
      section: 'B',
      seat: 4,
      kind: 'moment',
      words: 'Birthday song for seat 4 at dessert.',
      opened: '20:08',
      owner: null,
    },
    {
      id: 'bread',
      table: 'Table 9',
      section: 'B',
      seat: null,
      kind: 'table',
      words: 'More bread for the table.',
      opened: '19:58',
      owner: OTHER,
      closed: { outcome: 'Done', by: OTHER, at: '20:05' },
    },
    {
      id: 'napkin',
      table: 'Table 12',
      section: 'C',
      seat: 2,
      kind: 'table',
      words: 'A fresh napkin for seat 2.',
      opened: '20:10',
      owner: ME.name,
    },
    {
      id: 'bill',
      table: 'Table 7',
      section: 'B',
      seat: null,
      kind: 'other',
      words: 'Asked who to see about the drinks bill.',
      opened: '20:20',
      owner: null,
    },
    {
      id: 'water',
      table: 'Table 21',
      section: 'E',
      seat: null,
      kind: 'table',
      words: 'More water for the table, please.',
      opened: '20:19',
      owner: null,
    },
  ];
}

export const TRAYS = {
  inHand: { table: 'Table 6', plates: 2, line: 'Checked' },
  given: { table: 'Table 8', plates: 3, line: `Table 8’s tray, given to you by ${LEAD}.` },
  next: { table: 'Table 10', plates: 4, line: 'Mains · Start the tray' },
} as const;

export const OFFLINE_ACTION =
  'Needs a connection to take, finish or decline a request. Nothing is kept to send later.';
export const OFFLINE_ADD = 'Needs a connection to add a request. Nothing is kept to send later.';
export const DECLINE_BLANK = 'Say why it can’t be done';

export function servingName(courses: readonly Course[]): string | null {
  return courses.filter((c) => c.fired).at(-1)?.name ?? null;
}

export type Refusal = 'closedFirst' | 'stage' | 'flag';

export function refusalLine(
  r: GuestRequest,
  why: Refusal,
  courses: readonly Course[],
  by = OTHER,
  at = '20:23',
): string {
  const seat = r.seat ?? 0;
  const course = courses.find((c) => c.id === r.plate?.course)?.name ?? 'This course';
  switch (why) {
    case 'closedFirst':
      return `Not closed. ${by} closed this request at ${at}.`;
    case 'stage':
      return `Not changed. Seat ${seat}’s ${course} became Dishing before Done, so it can’t change now. The request is still open.`;
    case 'flag':
      return `Not changed. A flag added since rules out ${r.plate?.next ?? 'that dish'} for seat ${seat}. The request is still open.`;
  }
}

export function table21(): Table {
  return { ...table9(), name: 'Table 21', section: 'E', staffed: ['Yinka Hassan'] };
}

export const REQUEST_STATES = [
  'untaken',
  'yours',
  'takenWork',
  'takenManage',
  'declining',
  'closedDone',
  'closedDeclined',
  'closedFirst',
  'moment',
  'none',
  'offline',
  'refusedStage',
  'refusedFlag',
  'next',
  'alert',
  'add',
  'addInvalid',
  'addPlate',
  'addNoPlate',
  'addNobody',
] as const;
export type RequestStateName = (typeof REQUEST_STATES)[number];

export function requestStateOf(raw: string | null | undefined): RequestStateName {
  return REQUEST_STATES.find((s) => s === raw) ?? 'untaken';
}

export const REQUEST_STATE_WHAT: Record<RequestStateName, readonly [string, string]> = {
  untaken: ['Floor · nobody on it', 'I’ll do it and Decline, on Table 9'],
  yours: ['Floor · yours', 'Done and Decline'],
  takenWork: ['Floor · Grace Udo is on it', 'With service.work alone: no buttons'],
  takenManage: [
    'Floor · Grace Udo is on it, the lead looks',
    'With service.manage: Done and Decline',
  ],
  declining: ['Decline', 'The reason, required, up to 200'],
  closedDone: ['Closed · Done', 'Who closed it and when'],
  closedDeclined: ['Closed · Declined', 'Who, when and why'],
  closedFirst: ['Closed first by someone else', '409: who closed it and when'],
  moment: ['A moment', 'The floor lead’s, with Done and Decline'],
  none: ['None open', '0 open, Add request stays'],
  offline: ['No connection', 'Every request action refused in one line'],
  refusedStage: ['Done refused · Dishing', '409 plate_stage_invalid, still open'],
  refusedFlag: ['Done refused · a new flag', '409 dish_not_for_guest, still open'],
  next: ['Next', 'Trays in hand and given, your requests, the next tray'],
  alert: ['The lead’s alert', 'A request open 5 min, Go to table'],
  add: ['Add request', 'Sheet, dialog or docked panel'],
  addInvalid: ['Add request · blanks', 'Each blank marked, focus to the first'],
  addPlate: ['Change a plate', 'Courses that can change, flags checked'],
  addNoPlate: ['Change a plate · no seat', 'Table 7: no plate can change'],
  addNobody: ['Add request · nobody on the section', 'Goes to the floor lead'],
};

export type View = 'floor' | 'next' | 'alerts';

export interface Demo {
  view: View;
  viewer: Viewer;
  table: Table;
  list: GuestRequest[];
  online: boolean;
  pending: Refusal | null;
  declining: string | null;
  reason: string;
  reasonWrong: boolean;
  notice: Record<string, string>;
  noDone: string[];
  refused: string;
  form: Form | null;
  tried: boolean;
  say: string;
}

export function offered(r: GuestRequest, d: Demo): Action[] {
  return actions(r, d.viewer).filter((a) => !(a === 'done' && d.noDone.includes(r.id)));
}

function close(
  list: GuestRequest[],
  id: string,
  closed: NonNullable<GuestRequest['closed']>,
): GuestRequest[] {
  return list.map((r) => (r.id === id ? { ...r, closed } : r));
}

export function requestSeed(name: RequestStateName): Demo {
  const base: Demo = {
    view: 'floor',
    viewer: ME,
    table: table9(),
    list: requests(),
    online: true,
    pending: null,
    declining: null,
    reason: '',
    reasonWrong: false,
    notice: {},
    noDone: [],
    refused: '',
    form: null,
    tried: false,
    say: '',
  };
  const own = (owner: string | null) =>
    base.list.map((r) => (r.id === 'chair' ? { ...r, owner } : r));
  switch (name) {
    case 'untaken':
    case 'add':
      return name === 'add' ? { ...base, form: { ...EMPTY_FORM } } : base;
    case 'yours':
      return { ...base, list: own(ME.name) };
    case 'takenWork':
      return { ...base, list: own(OTHER) };
    case 'takenManage':
      return { ...base, viewer: THE_LEAD, list: own(OTHER) };
    case 'declining':
      return { ...base, list: own(ME.name), declining: 'chair' };
    case 'closedDone':
      return {
        ...base,
        list: close(own(ME.name), 'chair', { outcome: 'Done', by: ME.name, at: NOW }),
      };
    case 'closedDeclined':
      return {
        ...base,
        list: close(own(ME.name), 'chair', {
          outcome: 'Declined',
          by: ME.name,
          at: NOW,
          reason: 'No high chair left. Offered a booster cushion.',
        }),
      };
    case 'closedFirst':
      return done({ ...base, list: own(ME.name), pending: 'closedFirst' }, 'chair');
    case 'moment':
      return { ...base, viewer: THE_LEAD };
    case 'none':
      return { ...base, list: base.list.filter((r) => r.table !== 'Table 9' || r.closed != null) };
    case 'offline':
      return { ...base, online: false };
    case 'refusedStage':
      return done({ ...base, pending: 'stage' }, 'stew');
    case 'refusedFlag':
      return done({ ...base, pending: 'flag' }, 'stew');
    case 'next':
      return { ...base, view: 'next' };
    case 'alert':
      return { ...base, view: 'alerts', viewer: THE_LEAD, table: table21() };
    case 'addInvalid':
      return { ...base, form: { ...EMPTY_FORM }, tried: true };
    case 'addPlate':
      return { ...base, form: { ...EMPTY_FORM, kind: 'plate', who: 1 } };
    case 'addNoPlate':
      return { ...base, table: table7(true), form: { ...EMPTY_FORM, kind: 'plate', who: null } };
    case 'addNobody':
      return { ...base, table: table12(), form: { ...EMPTY_FORM, kind: 'table' } };
  }
}

function offline(d: Demo): Demo {
  return { ...d, refused: OFFLINE_ACTION, say: OFFLINE_ACTION };
}

export function take(d: Demo, id: string): Demo {
  if (!d.online) return offline(d);
  const list = d.list.map((r) => (r.id === id ? { ...r, owner: d.viewer.name } : r));
  const r = list.find((q) => q.id === id);
  return { ...d, list, say: `You’re on it. ${r?.words ?? ''}` };
}

export function done(d: Demo, id: string): Demo {
  if (!d.online) return offline(d);
  const r = d.list.find((q) => q.id === id);
  if (r == null) return d;
  if (d.pending === 'closedFirst') {
    const line = refusalLine(r, 'closedFirst', d.table.courses);
    return {
      ...d,
      pending: null,
      list: close(d.list, id, { outcome: 'Done', by: OTHER, at: '20:23' }),
      notice: { ...d.notice, [id]: line },
      say: line,
    };
  }
  if (r.kind === 'plate' && (d.pending === 'stage' || d.pending === 'flag')) {
    const line = refusalLine(r, d.pending, d.table.courses);
    return {
      ...d,
      pending: null,
      notice: { ...d.notice, [id]: line },
      noDone: [...d.noDone, id],
      say: line,
    };
  }
  return {
    ...d,
    list: close(d.list, id, { outcome: 'Done', by: d.viewer.name, at: NOW }),
    say: `Done at ${r.table.toLowerCase()}. ${r.words}`,
  };
}

export function openDecline(d: Demo, id: string): Demo {
  if (!d.online) return offline(d);
  return { ...d, declining: id, reason: '', reasonWrong: false };
}

export function decline(d: Demo): Demo {
  if (!d.online) return offline(d);
  const id = d.declining;
  const r = d.list.find((q) => q.id === id);
  if (id == null || r == null) return d;
  if (d.reason.trim() === '') return { ...d, reasonWrong: true, say: DECLINE_BLANK };
  return {
    ...d,
    declining: null,
    list: close(d.list, id, {
      outcome: 'Declined',
      by: d.viewer.name,
      at: NOW,
      reason: d.reason.trim(),
    }),
    say: `Declined at ${r.table.toLowerCase()}. ${r.words}`,
  };
}

export function add(d: Demo): { d: Demo; wrong: FieldName[] } {
  if (d.form == null) return { d, wrong: [] };
  if (!d.online) return { d: { ...d, refused: OFFLINE_ADD, say: OFFLINE_ADD }, wrong: [] };
  const wrong = check(d.form, d.table);
  if (wrong.length > 0)
    return { d: { ...d, tried: true, say: wrong.map((w) => FIELD_ERROR[w]).join('. ') }, wrong };
  const f = d.form;
  const seat = typeof f.who === 'number' ? f.who : null;
  const now = seat == null ? null : d.table.seats.find((s) => s.n === seat);
  const dish = MENU.find((m) => m.name === f.dish);
  const r: GuestRequest = {
    id: `new${d.list.length}`,
    table: d.table.name,
    section: d.table.section,
    seat,
    kind: f.kind ?? 'other',
    words: f.words.trim(),
    opened: NOW,
    owner: null,
    ...(f.kind === 'plate' && dish != null && now != null
      ? {
          plate: {
            course: dish.course,
            now: now.orders[dish.course]?.dish ?? 'Nothing chosen',
            next: dish.name,
          },
        }
      : {}),
  };
  return {
    d: {
      ...d,
      list: [...d.list, r],
      form: null,
      tried: false,
      say: `Request added at ${d.table.name.toLowerCase()}.`,
    },
    wrong: [],
  };
}

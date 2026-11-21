import { type SampleEvent, CLOCKS, sampleEvent } from './events.ts';
import {
  type ConvoId,
  type Out,
  type Told,
  EVENT_NAME,
  MW,
  NEW_PLACE,
  ROSEWOOD,
  SAMPLE_EVENT,
  STARTS_LATER,
  TELL,
  changeOutOf,
  filled,
  many,
  toldOf,
} from './messages.ts';
import type { TellState } from './messagesTellStates.ts';

export type TellKind =
  'fields' | 'pause' | 'callOff' | 'resume' | 'endNow' | 'tables' | 'menu' | 'link';

export type Field = 'date' | 'start' | 'venue';

export interface Pill {
  channel: 'email' | 'sms' | 'whatsApp';
  count: number;
}

export interface Unreachable {
  name: string;
  why: readonly string[];
}

export interface Figures {
  count: number;
  name?: string;
  pills: readonly Pill[];
  unreachable: readonly Unreachable[];
  credits: number;
  balance: number;
  held?: number;
  quiet?: { count: number; time: string };
}

export interface Part {
  heading: string;
  lines: readonly string[];
  who: string;
}

export interface Sheet {
  who: string | null;
  lines: readonly string[];
  parts: readonly Part[] | null;
  hints: readonly string[];
  figures: Figures;
}

const BALANCE = 1500;
const UNREACHABLE: readonly Unreachable[] = [
  { name: 'Joaquín Ruiz', why: [MW.noEmail, MW.noPhone] },
  { name: 'Sophie Laurent', why: [MW.unsubscribed, MW.stoppedTexts] },
];

export const STANDARD: Figures = {
  count: 130,
  pills: [
    { channel: 'email', count: 128 },
    { channel: 'sms', count: 30 },
    { channel: 'whatsApp', count: 4 },
  ],
  unreachable: UNREACHABLE,
  credits: 43,
  balance: BALANCE,
};

const FIGURES: Record<TellKind, Figures> = {
  fields: STANDARD,
  pause: STANDARD,
  resume: STANDARD,
  endNow: STANDARD,
  callOff: {
    count: 142,
    pills: [
      { channel: 'email', count: 124 },
      { channel: 'sms', count: 35 },
      { channel: 'whatsApp', count: 4 },
    ],
    unreachable: [
      ...UNREACHABLE,
      { name: 'Bisi Adewale', why: [MW.noEmail, MW.noPhone] },
      { name: 'Camille Dubois', why: [MW.unsubscribed] },
      { name: 'Funke Bello', why: [MW.addressBouncing, MW.noPhone] },
      { name: 'Grace Mensah', why: [MW.noEmail, MW.noPhone] },
      { name: 'Leila Mansour', why: [MW.addressBouncing, MW.stoppedTexts] },
      { name: 'Tobi Ojo', why: [MW.noEmail, MW.noPhone] },
      { name: 'Tola Bakare', why: [MW.unsubscribed, MW.noPhone] },
    ],
    credits: 48,
    balance: BALANCE,
  },
  tables: {
    count: 96,
    pills: [
      { channel: 'email', count: 92 },
      { channel: 'sms', count: 28 },
      { channel: 'whatsApp', count: 3 },
    ],
    unreachable: [
      { name: 'Hana Sato', why: [MW.addressBouncing, MW.noPhone] },
      { name: 'Sophie Laurent', why: [MW.unsubscribed, MW.stoppedTexts] },
    ],
    credits: 39,
    balance: BALANCE,
  },
  menu: {
    count: 6,
    pills: [{ channel: 'email', count: 6 }],
    unreachable: [],
    credits: 0,
    balance: BALANCE,
  },
  link: {
    count: 1,
    name: 'Kwame Mensah',
    pills: [
      { channel: 'email', count: 1 },
      { channel: 'whatsApp', count: 1 },
    ],
    unreachable: [],
    credits: 5,
    balance: BALANCE,
  },
};

const MENU_ONE: Figures = {
  count: 1,
  name: 'Lucía Ortega',
  pills: [
    { channel: 'email', count: 1 },
    { channel: 'whatsApp', count: 1 },
  ],
  unreachable: [],
  credits: 4,
  balance: BALANCE,
};

const WHO: Record<TellKind, string | null> = {
  fields: MW.tellWho,
  pause: MW.tellWho,
  endNow: MW.tellWho,
  callOff: MW.whoEveryone,
  resume: MW.whoPaused,
  tables: MW.whoTables,
  menu: MW.whoMenu,
  link: null,
};

const FIELDS: readonly Field[] = ['date', 'start', 'venue'];

export function kindOf(told: Told): TellKind {
  return told.kind ?? 'fields';
}

/** The kinds that are not a field share one line each, the event named in it. */
export function toldOfKind(kind: Exclude<TellKind, 'fields'>, name = 'Kwame Mensah'): Told {
  const event = { event: EVENT_NAME };

  switch (kind) {
    case 'pause':
      return { kind, item: MW.itemPaused, line: filled(MW.pausedLine, event) };
    case 'callOff':
      return { kind, item: MW.itemCalledOff, line: filled(MW.calledOffLine, event) };
    case 'resume':
      return { kind, item: MW.itemResumed, line: filled(MW.resumedLine, event) };
    case 'endNow':
      return { kind, item: MW.itemEnded, line: filled(MW.endedLine, event) };
    case 'tables':
      return { kind, item: MW.itemTables, line: filled(MW.tablesLine, event) };
    case 'menu':
      return { kind, item: MW.itemMenu, line: filled(MW.menuLine, event) };
    case 'link':
      return { kind, item: filled(MW.itemLink, { name }), line: filled(MW.linkLine, event) };
  }
}

function inOrder(changes: readonly Told[]): Told[] {
  const at = (told: Told) => (told.field == null ? FIELDS.length : FIELDS.indexOf(told.field));

  return [...changes].sort((one, two) => at(one) - at(two));
}

function widest(kinds: readonly TellKind[]): Figures {
  return kinds
    .map((kind) => FIGURES[kind])
    .reduce((most, one) => (one.count > most.count ? one : most), FIGURES.menu);
}

/** One message for one kind, its lines a field each in the copy's order; changes for different guests each under their item with who gets them. */
export function sheetOf(changes: readonly Told[], figures: Figures | null = null): Sheet {
  const kinds = [...new Set(changes.map(kindOf))];
  const hints = [
    MW.eachLanguage,
    ...(changes.some((told) => told.venue === true) ? [MW.addressAdded] : []),
    ...(kinds.includes('tables') ? [MW.tableAdded] : []),
  ];

  if (kinds.length <= 1) {
    const kind = kinds[0] ?? 'fields';

    return {
      who: WHO[kind],
      lines: inOrder(changes).map((told) => told.line),
      parts: null,
      hints,
      figures: figures ?? FIGURES[kind],
    };
  }

  return {
    who: null,
    lines: [],
    parts: kinds.map((kind) => {
      const of = inOrder(changes.filter((told) => kindOf(told) === kind));

      return {
        heading: of.map((told) => told.item).join(', '),
        lines: of.map((told) => told.line),
        who: WHO[kind] ?? '',
      };
    }),
    hints,
    figures: figures ?? widest(kinds),
  };
}

export function titleOf(figures: Figures | null): string {
  if (figures == null) return MW.tellGuests;

  return figures.name == null
    ? many('tellTitle', figures.count)
    : filled(MW.tellName, { name: figures.name });
}

export function sentWords(figures: Figures): string {
  return figures.name == null
    ? many('sendingTo', figures.count)
    : filled(MW.sendingToName, { name: figures.name });
}

export function byName(people: readonly Unreachable[]): Unreachable[] {
  return [...people].sort((one, two) => one.name.localeCompare(two.name, 'en'));
}

export type Failure =
  'offline' | 'unconfirmed' | 'role' | 'event' | 'finished' | 'deleted' | 'refused';
export type Line = Failure | 'early' | 'figuresFailed';

export interface Flow {
  figures: 'loading' | 'shown' | 'failed';
  early: boolean;
  again: Failure | null;
  told: boolean;
  line: Line | null;
  presses: number;
}

export const READY: Flow = {
  figures: 'shown',
  early: false,
  again: null,
  told: false,
  line: null,
  presses: 0,
};

const REFUSED_AGAIN: readonly Failure[] = ['role', 'event', 'finished', 'deleted'];

export const FIGURES_MS = 1000;

export function failed(failure: Failure): Flow {
  return {
    ...READY,
    line: failure,
    again: REFUSED_AGAIN.includes(failure) ? failure : null,
    told: failure === 'unconfirmed',
  };
}

export type Pressed = 'none' | 'sent' | 'allTold';

/** Send while the figures load or failed sends nothing; a refusal comes back the same; an unconfirmed send finds the guests already told. */
export function pressSend(flow: Flow): { flow: Flow; result: Pressed } {
  const presses = flow.presses + 1;

  if (flow.figures === 'loading')
    return { flow: { ...flow, early: true, line: null, presses }, result: 'none' };
  if (flow.figures === 'failed')
    return { flow: { ...flow, figures: 'loading', line: null, presses }, result: 'none' };
  if (flow.again != null) return { flow: { ...flow, line: flow.again, presses }, result: 'none' };

  return { flow: { ...flow, line: null, presses }, result: flow.told ? 'allTold' : 'sent' };
}

export function figuresArrive(flow: Flow): Flow {
  return { ...flow, figures: 'shown', early: false, line: flow.early ? 'early' : flow.line };
}

export function lineWords(line: Line): string {
  switch (line) {
    case 'offline':
      return MW.failOffline;
    case 'unconfirmed':
      return MW.failUnconfirmed;
    case 'role':
      return MW.failRole;
    case 'event':
      return MW.failEvent;
    case 'finished':
      return MW.failFinished;
    case 'deleted':
      return MW.failDeleted;
    case 'refused':
      return MW.failRefused;
    case 'early':
      return MW.pressedEarly;
    case 'figuresFailed':
      return MW.figuresFailed;
  }
}

export type Page =
  | 'moved'
  | 'base'
  | 'dates'
  | 'dateTime'
  | 'venueAdded'
  | 'venueGone'
  | 'address'
  | 'addressAdded'
  | 'merged'
  | 'mixed'
  | 'paused'
  | 'calledOff'
  | 'finished';

export interface TellSeed {
  page: Page;
  changes: readonly Told[] | null;
  figures?: Figures;
  flow?: Flow;
  untold?: readonly Told[];
  note?: string;
  said?: string;
}

const START = STARTS_LATER;
const PLACE = NEW_PLACE;
const NOTE = 'Dinner is still at 20:00.';

const SEEDS: Partial<Record<TellState, TellSeed>> = {
  tellPause: { page: 'paused', changes: [toldOfKind('pause')] },
  tellCallOff: { page: 'calledOff', changes: [toldOfKind('callOff')] },
  tellResume: { page: 'base', changes: [toldOfKind('resume')] },
  tellEndNow: { page: 'finished', changes: [toldOfKind('endNow')] },
  tellTables: { page: 'base', changes: [toldOfKind('tables')] },
  tellMenu: { page: 'base', changes: [toldOfKind('menu')] },
  tellLink: { page: 'base', changes: [toldOfKind('link')] },
  tellMenuOne: { page: 'base', changes: [toldOfKind('menu')], figures: MENU_ONE },
  tellSeeWho: { page: 'moved', changes: [START] },
  tellHeld: {
    page: 'moved',
    changes: [START],
    figures: { ...STANDARD, balance: 20, credits: 20, held: 14 },
  },
  tellQuiet: {
    page: 'moved',
    changes: [START],
    figures: { ...STANDARD, quiet: { count: 3, time: '09:00' } },
  },
  tellMerged: { page: 'merged', changes: [PLACE, START], untold: [START, PLACE] },
  tellMixed: {
    page: 'mixed',
    changes: [PLACE, toldOfKind('tables')],
    untold: [PLACE, toldOfKind('tables')],
  },
  untoldEvent: { page: 'moved', changes: null, untold: [START] },
  untoldPaused: { page: 'paused', changes: null, untold: [toldOfKind('pause')] },
  changeSending: { page: 'moved', changes: null, said: many('sendingTo', STANDARD.count) },
  allTold: { page: 'moved', changes: null, said: MW.allTold },
  sendOffline: { page: 'moved', changes: [START], note: NOTE, flow: failed('offline') },
  sendUnconfirmed: { page: 'moved', changes: [START], note: NOTE, flow: failed('unconfirmed') },
  sendRefusedRole: { page: 'moved', changes: [START], note: NOTE, flow: failed('role') },
  sendRefusedEvent: { page: 'moved', changes: [START], note: NOTE, flow: failed('event') },
  sendRefusedFinished: { page: 'moved', changes: [START], note: NOTE, flow: failed('finished') },
  sendRefusedDeleted: { page: 'moved', changes: [START], note: NOTE, flow: failed('deleted') },
  sendRefused: { page: 'moved', changes: [START], note: NOTE, flow: failed('refused') },
  figuresLoading: { page: 'moved', changes: [START], flow: { ...READY, figures: 'loading' } },
  figuresPressedEarly: { page: 'moved', changes: [START], flow: { ...READY, line: 'early' } },
  figuresFailed: {
    page: 'moved',
    changes: [START],
    flow: { ...READY, figures: 'failed', line: 'figuresFailed' },
  },
};

const LANDMARK = { name: 'The Landmark', city: 'London' };

/** The field states, each worded by `toldOf` from what guests were told to the page behind it, as a live save is. */
const FIELD_SEEDS: Partial<
  Record<TellState, { page: Page; told: (event: SampleEvent) => SampleEvent }>
> = {
  tellDates: { page: 'dates', told: (event) => event },
  tellDateTime: { page: 'dateTime', told: (event) => event },
  tellVenueAdded: { page: 'venueAdded', told: (event) => ({ ...event, venue: null }) },
  tellVenueGone: { page: 'venueGone', told: (event) => event },
  tellAddress: {
    page: 'address',
    told: (event) => ({
      ...event,
      venue: { ...LANDMARK, address: '22 Marylebone Road, London NW1 6JQ' },
    }),
  },
  tellAddressAdded: {
    page: 'addressAdded',
    told: (event) => ({ ...event, venue: { ...LANDMARK, address: null } }),
  },
};

export function tellSeedOf(state: TellState): TellSeed | null {
  const field = FIELD_SEEDS[state];
  const base = sampleEvent(SAMPLE_EVENT);

  if (field == null || base == null) return SEEDS[state] ?? null;

  return { page: field.page, changes: toldOf(field.told(base), pageEvent(field.page, base)) };
}

/** A sheet sent or put off answers for what it holds: every field when it has one, each other kind by itself, and a pause once resumed. */
export function withoutTold(untold: readonly Told[], sent: readonly Told[]): Told[] {
  const fields = sent.some((told) => kindOf(told) === 'fields');
  const kinds = new Set(sent.map(kindOf));

  return untold.filter((told) => {
    const kind = kindOf(told);

    if (kind === 'fields') return !fields;
    if (kind === 'pause' && kinds.has('resume')) return false;

    return !sent.some((one) => one.item === told.item);
  });
}

export function mergeUntold(untold: readonly Told[], changes: readonly Told[]): Told[] {
  return [...withoutTold(untold, changes), ...changes];
}

export function changeFor(
  changes: readonly Told[],
  figures: Figures,
  note: string,
  thread: ConvoId,
): Out {
  return changeOutOf(
    changes,
    {
      count: figures.count,
      reached: figures.count - figures.unreachable.length,
      channels: figures.pills.map((pill) => pill.channel),
      note: note.trim(),
    },
    thread,
  );
}

export function pageEvent(page: Page, event: SampleEvent): SampleEvent {
  switch (page) {
    case 'moved':
      return { ...event, startsAt: TELL.movedTo };
    case 'dates':
      return { ...event, endsAt: '2026-11-08T15:00:00Z' };
    case 'dateTime':
      return { ...event, startsAt: '2026-11-06T17:00:00Z', endsAt: '2026-11-06T23:00:00Z' };
    case 'venueAdded':
    case 'mixed':
      return { ...event, venue: ROSEWOOD };
    case 'venueGone':
      return { ...event, venue: null };
    case 'merged':
      return { ...event, startsAt: TELL.movedTo, venue: ROSEWOOD };
    case 'paused':
      return { ...event, status: 'paused' };
    case 'calledOff':
      return { ...event, status: 'ended', concludedAt: CLOCKS.rest.toISOString() };
    case 'finished':
      return { ...event, status: 'ended', concludedAt: CLOCKS.now.toISOString() };
    default:
      return event;
  }
}

export function clockOfPage(page: Page): Date | null {
  return page === 'finished' ? CLOCKS.now : null;
}

/** End now opens Tell guests only while a later day of the event was still to come; an end at midnight belongs to the day before. */
export function dayStillToCome(event: SampleEvent, now: Date): boolean {
  const day = (at: Date) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: event.timeZone }).format(at);

  return day(now) < day(new Date(Date.parse(event.endsAt) - 1));
}

export function linkFigures(name: string): Figures {
  return { ...FIGURES.link, name };
}

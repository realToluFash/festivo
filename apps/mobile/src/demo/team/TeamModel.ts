import { andList, fresh as freshQueue } from '../queue/QueueModel.ts';

export { andList };

/** Team (sc-36034, Team.dc.html on page 35): who is on each section and kitchen station tonight, and the floor lead's move between them. */

export type PlaceKind = 'section' | 'kitchen';
export type Access =
  'floor' | 'pass' | 'run' | 'owner' | 'admin' | 'lead' | 'edit' | 'view' | 'checkin';
export type Mode = 'well' | 'instead';

export interface Spot {
  id: string;
  name: string;
  kind: PlaceKind;
}

export interface Person {
  name: string;
  access: Access;
  here: boolean;
  on: readonly string[];
  you?: boolean;
}

export interface MoveSheet {
  place: string;
  who: string;
  mode: Mode;
  refused: boolean;
}

export type Notice =
  | { kind: 'need'; place: string }
  | { kind: 'conflict'; who: string; by: string; to: string; place: string };

export interface TeamState {
  on: Record<string, string[]>;
  online: boolean;
  sheet: MoveSheet | null;
  notice: Notice | null;
  say: string;
  toast: string;
  manage: boolean;
  empty: boolean;
  rival: boolean;
  lines: Record<string, string>;
  disher: string;
  focus: string | null;
  opened: string | null;
}

export const LEAD = 'Ifeoma Nduka';
export const RIVAL = 'Tobi Adeyemi';
export const NOW = '20:41';
export const NEED_LINE = 'Needs a connection to move anyone.';
export const EMPTY_LINE = 'No sections or kitchen stations at this event.';
export const CHOOSE_LINE = 'Choose who to move.';

export const PLACES: readonly Spot[] = [
  { id: 'A', name: 'Section A', kind: 'section' },
  { id: 'B', name: 'Section B', kind: 'section' },
  { id: 'C', name: 'Section C', kind: 'section' },
  { id: 'D', name: 'Section D', kind: 'section' },
  { id: 'pass', name: 'Pass', kind: 'kitchen' },
  { id: 'jollof', name: 'Rice · Jollof', kind: 'kitchen' },
  { id: 'fried', name: 'Rice · Fried', kind: 'kitchen' },
  { id: 'grill', name: 'Grill', kind: 'kitchen' },
  { id: 'fryer', name: 'Fryer', kind: 'kitchen' },
];

/** sc-4002: Can view and Can check guests in work neither kind of place. */
export const WORKS: Record<PlaceKind, readonly Access[]> = {
  section: ['floor', 'run', 'owner', 'admin', 'lead', 'edit'],
  kitchen: ['pass', 'run', 'owner', 'admin', 'lead', 'edit'],
};

export const STAFF: readonly Person[] = [
  { name: 'Kunle Ajayi', access: 'floor', here: true, on: ['A'] },
  { name: 'Funmi Bakare', access: 'floor', here: true, on: ['B'] },
  { name: 'Grace Udo', access: 'floor', here: true, on: ['B'] },
  { name: 'Chidi Okafor', access: 'floor', here: true, on: ['D'] },
  { name: 'Yinka Hassan', access: 'run', here: true, on: [] },
  { name: LEAD, access: 'lead', here: true, on: [], you: true },
  { name: 'Ronke Alade', access: 'pass', here: true, on: ['pass'] },
  { name: 'Bisi Okon', access: 'pass', here: true, on: ['jollof', 'fried'] },
  { name: 'Tayo Bamidele', access: 'pass', here: true, on: ['grill'] },
  { name: 'Gbenga Salami', access: 'pass', here: true, on: ['fryer'] },
  { name: 'Ada Nnaji', access: 'pass', here: true, on: [] },
  { name: 'Tolu Bello', access: 'checkin', here: true, on: ['door'] },
  { name: 'Emeka Obi', access: 'floor', here: false, on: [] },
];

/** The tray a waiter has out now, from the Queue board's sample: theirs to finish wherever Team puts them. */
export function trayOutOf(who: string): string | null {
  return Object.values(freshQueue().places).find((p) => p.trayOf === who)?.name ?? null;
}

export interface KitchenTray {
  who: string;
  table: string;
  station: string;
  items: string;
  when: string;
}

export const KITCHEN_TRAYS: readonly KitchenTray[] = [
  {
    who: 'Kunle Ajayi',
    table: 'Table 4',
    station: 'grill',
    items: 'Chicken ×2 · Grilled fish ×1',
    when: 'At the Pass now',
  },
  {
    who: 'Funmi Bakare',
    table: 'Table 9',
    station: 'fryer',
    items: 'Plantain ×2',
    when: 'At Rice · Fried now',
  },
  {
    who: 'Chidi Okafor',
    table: 'Table 16',
    station: 'grill',
    items: 'Chicken ×3',
    when: 'At the Pass now',
  },
  {
    who: 'Grace Udo',
    table: 'Table 6',
    station: 'jollof',
    items: 'Jollof rice ×4',
    when: 'At the Pass now',
  },
  {
    who: 'Chidi Okafor',
    table: 'Table 17',
    station: 'fryer',
    items: 'Plantain ×3',
    when: 'Filling at the Pass',
  },
  {
    who: 'Kunle Ajayi',
    table: 'Table 2',
    station: 'pass',
    items: '5 plates to set out',
    when: 'Filling at the Pass',
  },
];

export function firstName(name: string): string {
  return name.split(' ')[0] ?? name;
}

export function initials(name: string): string {
  const parts = name.split(' ');
  return `${parts[0]?.[0] ?? ''}${parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''}`.toUpperCase();
}

export function spotOf(id: string): Spot | undefined {
  return PLACES.find((p) => p.id === id);
}

export function nameOf(id: string): string {
  return spotOf(id)?.name ?? id;
}

export function personOf(name: string): Person | undefined {
  return STAFF.find((p) => p.name === name);
}

/** The sections and kitchen stations someone is on: the Door, the Bar and the Stage are not Team's. */
export function stationsOf(s: TeamState, who: string): string[] {
  return (s.on[who] ?? []).filter((id) => spotOf(id) != null);
}

export function onPlace(s: TeamState, id: string): string[] {
  return STAFF.filter((p) => (s.on[p.name] ?? []).includes(id)).map((p) => p.name);
}

export function stationText(ids: readonly string[]): string {
  return andList(ids.map(nameOf));
}

/** On no station there is no question; on two it is Instead only; on one it is As well until the lead chooses Instead. */
export function modeOf(s: TeamState, who: string): Mode | 'none' {
  const count = stationsOf(s, who).length;
  if (count === 0) return 'none';
  if (count >= 2) return 'instead';
  return s.sheet?.mode ?? 'well';
}

export function emptied(s: TeamState, who: string, target: string, mode: Mode | 'none'): string[] {
  if (mode !== 'instead') return [];
  return stationsOf(s, who).filter((id) => id !== target && onPlace(s, id).every((n) => n === who));
}

/** Only people in Here whose access works the place and who aren't on it already; those on no station first. */
export function candidates(s: TeamState, target: string): Person[] {
  const spot = spotOf(target);
  if (spot == null) return [];
  const able = STAFF.filter(
    (p) => p.here && WORKS[spot.kind].includes(p.access) && !(s.on[p.name] ?? []).includes(target),
  );
  return [
    ...able.filter((p) => stationsOf(s, p.name).length === 0),
    ...able.filter((p) => stationsOf(s, p.name).length > 0),
  ];
}

export function candidateLine(s: TeamState, p: Person): string {
  const on = stationsOf(s, p.name);
  const where =
    on.length > 0 ? `${stationText(on)} now` : p.you === true ? 'on no station' : 'On no station';
  return `${p.you === true ? 'You · ' : ''}${where}${on.length >= 2 ? ' · on two, so Instead only' : ''}`;
}

export function leavesLine(ids: readonly string[]): string {
  return ids.map((id) => `Leaves ${nameOf(id)} with nobody.`).join(' ');
}

export interface Choice {
  label: string;
  modes: readonly Mode[];
  mode: Mode;
  helper: string;
  leaves: string;
  tray: string;
}

export function choiceFor(s: TeamState): Choice | null {
  const sheet = s.sheet;
  if (sheet == null || sheet.who === '') return null;
  const on = stationsOf(s, sheet.who);
  if (on.length === 0) return null;
  const mode = modeOf(s, sheet.who);
  if (mode === 'none') return null;
  const first = firstName(sheet.who);
  const target = nameOf(sheet.place);
  const started = trayOutOf(sheet.who);

  return {
    label:
      on.length >= 2
        ? `${first} is on ${stationText(on)}. Two stations is the most, so this is Instead.`
        : `${first} is on ${stationText(on)} now.`,
    modes: on.length >= 2 ? ['instead'] : ['well', 'instead'],
    mode,
    helper:
      mode === 'well'
        ? `${first} stays on ${stationText(on)} and takes ${target} too.`
        : `${first} leaves ${stationText(on)} and is on ${target} alone.`,
    leaves: leavesLine(emptied(s, sheet.who, sheet.place, mode)),
    tray:
      mode === 'instead' && started != null
        ? `${first} finishes the tray already out to ${started}. Their next tray comes from ${target}.`
        : '',
  };
}

export function primaryLabel(s: TeamState): string {
  const sheet = s.sheet;
  if (sheet == null) return '';
  return sheet.who === ''
    ? `Put someone on ${nameOf(sheet.place)}`
    : `Put ${sheet.who} on ${nameOf(sheet.place)}`;
}

export function fresh(): TeamState {
  const on: Record<string, string[]> = {};
  for (const p of STAFF) on[p.name] = [...p.on];
  return {
    on,
    online: true,
    sheet: null,
    notice: null,
    say: '',
    toast: '',
    manage: true,
    empty: false,
    rival: false,
    lines: {},
    disher: 'Tayo Bamidele',
    focus: null,
    opened: null,
  };
}

export function openSheet(s: TeamState, place: string): TeamState {
  return {
    ...s,
    sheet: { place, who: '', mode: 'well', refused: false },
    notice: null,
    focus: null,
    opened: null,
  };
}

export function closeSheet(s: TeamState): TeamState {
  return s.sheet == null ? s : { ...s, sheet: null, focus: `row|${s.sheet.place}` };
}

export function choose(s: TeamState, who: string): TeamState {
  return s.sheet == null ? s : { ...s, sheet: { ...s.sheet, who, mode: 'well', refused: false } };
}

export function chooseMode(s: TeamState, mode: Mode): TeamState {
  return s.sheet == null ? s : { ...s, sheet: { ...s.sheet, mode } };
}

/** Offline, a Move control says why it does nothing: nothing is made, nothing is queued. */
export function tryOffline(s: TeamState, place: string): TeamState {
  return { ...s, notice: { kind: 'need', place }, say: NEED_LINE };
}

export function goOnline(s: TeamState, online: boolean): TeamState {
  return {
    ...s,
    online,
    sheet: null,
    notice: null,
    say: online ? 'Live again.' : `No connection · as of ${NOW}.`,
  };
}

/** Got it leaves the refusal and goes back to the place the lead was moving someone to. */
export function dismiss(s: TeamState): TeamState {
  const back = s.notice?.kind === 'conflict' ? `row|${s.notice.place}` : s.focus;
  return { ...s, notice: null, say: '', focus: back };
}

export function move(s: TeamState): TeamState {
  const sheet = s.sheet;
  if (sheet == null) return s;
  if (sheet.who === '') return { ...s, sheet: { ...sheet, refused: true }, say: CHOOSE_LINE };
  const who = sheet.who;
  const target = sheet.place;
  const name = nameOf(target);

  if (s.rival && who === 'Grace Udo') {
    return {
      ...s,
      on: { ...s.on, [who]: ['D'] },
      sheet: null,
      notice: { kind: 'conflict', who, by: RIVAL, to: 'D', place: target },
      say: `${who} wasn’t moved. ${RIVAL} has just put them on Section D.`,
      toast: '',
      focus: `row|${target}`,
    };
  }

  const mode = modeOf(s, who);
  const before = stationsOf(s, who);
  const gone = emptied(s, who, target, mode);
  const say = `${who} is on ${name}.${gone.map((g) => ` Nobody on ${nameOf(g)}.`).join('')}`;
  const kind = spotOf(target)?.kind;

  return {
    ...s,
    on: { ...s.on, [who]: mode === 'well' ? [...(s.on[who] ?? []), target] : [target] },
    sheet: null,
    notice: null,
    say,
    toast: say,
    lines: {
      ...s.lines,
      [who]:
        mode === 'well'
          ? `You’re on ${name} now, as well as ${stationText(before)}.`
          : `You’re on ${name} now.`,
    },
    disher: kind === 'kitchen' ? who : s.disher,
    focus: `row|${target}`,
  };
}

export function dishTrays(s: TeamState, who: string): { stations: string[]; trays: KitchenTray[] } {
  const stations = stationsOf(s, who).filter((id) => spotOf(id)?.kind === 'kitchen');
  return { stations, trays: KITCHEN_TRAYS.filter((t) => stations.includes(t.station)) };
}

export function peopleCount(s: TeamState): number {
  return new Set(PLACES.flatMap((p) => onPlace(s, p.id))).size;
}

export const TEAM_STATES = [
  'populated',
  'sheetSection',
  'sheetChosen',
  'sheetInstead',
  'sheetKitchen',
  'sheetTwo',
  'sheetBlank',
  'movedAsWell',
  'movedInstead',
  'movedKitchen',
  'offline',
  'offlineTried',
  'conflict',
  'fromAlert',
  'empty',
  'noManage',
] as const;

export type TeamStateName = (typeof TEAM_STATES)[number];

export function teamStateOf(raw: string | null | undefined): TeamStateName {
  return TEAM_STATES.find((s) => s === raw) ?? 'populated';
}

export function seed(name: TeamStateName): TeamState {
  const s = fresh();
  const settle = (x: TeamState): TeamState => ({ ...x, focus: null });
  const picked = (place: string, who: string, mode: Mode): TeamState =>
    chooseMode(choose(openSheet(s, place), who), mode);

  switch (name) {
    case 'populated':
      return s;
    case 'sheetSection':
      return openSheet(s, 'C');
    case 'sheetChosen':
      return picked('C', 'Kunle Ajayi', 'well');
    case 'sheetInstead':
      return picked('C', 'Kunle Ajayi', 'instead');
    case 'sheetKitchen':
      return openSheet(s, 'fryer');
    case 'sheetTwo':
      return picked('fryer', 'Bisi Okon', 'instead');
    case 'sheetBlank':
      return { ...move(openSheet(s, 'C')), say: '' };
    case 'movedAsWell':
      return settle(move(picked('C', 'Kunle Ajayi', 'well')));
    case 'movedInstead':
      return settle(move(picked('C', 'Kunle Ajayi', 'instead')));
    case 'movedKitchen':
      return settle(move(picked('fryer', 'Tayo Bamidele', 'well')));
    case 'offline':
      return { ...s, online: false };
    case 'offlineTried':
      return { ...s, online: false, notice: { kind: 'need', place: 'C' } };
    case 'conflict': {
      const rival = { ...s, rival: true };
      return settle(move(chooseMode(choose(openSheet(rival, 'C'), 'Grace Udo'), 'well')));
    }
    case 'fromAlert':
      return {
        ...move(picked('C', 'Kunle Ajayi', 'instead')),
        say: '',
        toast: '',
        opened: 'A',
        focus: 'row|A',
      };
    case 'empty':
      return { ...s, empty: true };
    case 'noManage':
      return { ...s, manage: false };
  }
}

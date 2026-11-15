import { type Course, courseItems, servedCourses } from './menuServed.ts';
import { andList } from './queue.ts';
import type { DemoLink } from './settings.ts';

/** Stations on the event's Staff page (sc-3910, Stations-Desktop.dc.html on page e34): places and sections, who is on each, what each place dishes, and the walking order. */
export const STATIONS_EVENT = 'evt-wed-4';
export const PASS = 'pass';
export const NAME_MAX = 60;

export type Kind = 'place' | 'section';

export interface Station {
  id: string;
  name: string;
  kind: Kind;
  tables: number;
  people: readonly string[];
  lead: string | null;
}

export interface Person {
  id: string;
  name: string;
  job: string;
  from: string;
  to: string;
}

export interface CourseRow {
  id: string;
  name: string;
  items: readonly string[];
}

export interface Stations {
  stations: readonly Station[];
  floor: string | null;
  courses: readonly CourseRow[];
  dishedAt: Readonly<Record<string, string>>;
  walk: readonly string[];
}

export type Panel =
  { kind: 'people'; id: string } | { kind: 'floor' } | { kind: 'name'; id: string | null } | null;

export const SW = {
  title: 'Staff',
  sub: 'Who works the event, where they work, and what each place dishes.',
  tabs: ['Roster', 'Jobs and shifts', 'Stations', 'Hours worked'],
  places: 'Places',
  placesSub: 'Where somebody works. Every tray starts at the Pass.',
  placesFoot: 'Rename, add or remove places to fit this venue. The Pass is always first.',
  addPlace: 'Add a place',
  sections: 'Seating sections',
  sectionsSub:
    'From the seating plan, in its order. A table moved to another section takes its waiters with it.',
  sectionsFoot: 'Sections are added, renamed and removed in the seating plan.',
  noSections: 'No sections yet. Once the seating plan has sections, each one appears here.',
  dishes: 'What each station dishes',
  dishesSub:
    'Each course’s items, as the menu lists them. An item with no station is dished at the Pass.',
  dishedAt: 'Dished at',
  noDishes: 'No dishes on this course yet.',
  noCourses: 'This event’s menu has no courses yet.',
  walk: 'Walking order',
  walkSub:
    'The order a waiter walks the kitchen stations from the Pass, the same for every course.',
  walkPass: 'Every tray starts here',
  walkEmpty: 'Every item is dished at the Pass.',
  walkFoot: 'A place joins the end when it gets its first item, and leaves when it loses its last.',
  noStation: 'No station',
  everyone: 'Everybody on tonight’s roster has a station.',
  unFoot:
    'Nobody is given a station automatically. Use People and lead on a station, or the Station column on the roster.',
  floorLead: 'Floor lead',
  noFloorLead: 'No floor lead yet',
  noFloorMeta:
    'Choose one person on the roster. Someone in the Floor lead job is suggested once the roster has one.',
  chooseFloor: 'Choose a floor lead',
  change: 'Change',
  peopleAndLead: 'People and lead',
  rename: 'Rename',
  remove: 'Remove…',
  keepIt: 'Keep it',
  lead: 'Lead',
  noLead: 'No lead',
  leadHelp:
    'One of the people on this station. A lead is a label: what they can do comes from their access.',
  rosterLabel: 'People on tonight’s roster',
  peopleFoot:
    'Putting somebody here takes them off their other station. It shows on the roster and on their shift straight away.',
  done: 'Done',
  whoLeads: 'Who leads the floor',
  choosePerson: 'Choose a person',
  floorHelp:
    'Anyone on tonight’s roster. A person’s lead is their station’s lead, or the floor lead when the station has none.',
  saveFloor: 'Save floor lead',
  chooseWho: 'Choose who leads the floor.',
  cancel: 'Cancel',
  name: 'Name',
  nameHelp: 'At most 60 characters. Each station on this event has its own name.',
  addNote: 'It starts with nobody on it and dishes nothing.',
  renameNote: 'The new name shows on the roster, on each person’s shift and on every tray.',
  addCta: 'Add place',
  saveName: 'Save name',
  blank: 'Enter a name for the station.',
  tooLong: 'Keep the name to 60 characters or fewer.',
  lock: 'You can see stations. Changing them needs permission to manage staff.',
  moveUp: 'Move up',
  moveDown: 'Move down',
  removedTitle: 'Section D was removed from the seating plan.',
  close: 'Close',
};

export function stationsWord(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** sc-3910: a section is named with its table count, from sc-4000's tables by Section. */
export function sectionLabel(station: Pick<Station, 'name' | 'tables'>): string {
  const count =
    station.tables === 0 ? 'No tables yet' : stationsWord(station.tables, 'table', 'tables');

  return `${station.name} · ${count}`;
}

export function labelOf(station: Station): string {
  return station.kind === 'section' ? sectionLabel(station) : station.name;
}

/** add_taken_section reads the part of a section's label before " · ". */
export function baseName(label: string): string {
  return label.split(' · ')[0] ?? label;
}

export function sameName(a: string, b: string): boolean {
  const fold = (x: string) =>
    x.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('en').trim();

  return fold(a) === fold(b);
}

export function itemKey(courseId: string, item: string): string {
  return `${courseId}|${item}`;
}

export function placesOf(state: Stations): Station[] {
  return state.stations.filter((one) => one.kind === 'place');
}

export function sectionsOf(state: Stations): Station[] {
  return state.stations.filter((one) => one.kind === 'section');
}

export function stationById(state: Stations, id: string): Station | undefined {
  return state.stations.find((one) => one.id === id);
}

export function dishedAt(state: Stations, courseId: string, item: string): string {
  return state.dishedAt[itemKey(courseId, item)] ?? PASS;
}

export function itemsAt(state: Stations, placeId: string): number {
  return state.courses.reduce(
    (sum, course) =>
      sum + course.items.filter((item) => dishedAt(state, course.id, item) === placeId).length,
    0,
  );
}

/** A place's row says how many items it dishes, and nothing when it dishes none. */
export function dishesLine(n: number): string | null {
  return n === 0 ? null : `Dishes ${stationsWord(n, 'item', 'items')}`;
}

export function stopLine(name: string, to: number, of: number): string {
  return `${name} moved to stop ${to} of ${of}`;
}

export interface Changed {
  state: Stations;
  said: string;
}

/** Gives an item a place: a place gets its first item and joins the walking order's end; one losing its last leaves it. */
export function setDishedAt(
  state: Stations,
  courseId: string,
  item: string,
  placeId: string,
): Changed {
  const key = itemKey(courseId, item);
  const before = dishedAt(state, courseId, item);
  const dished = { ...state.dishedAt };
  if (placeId === PASS) delete dished[key];
  else dished[key] = placeId;

  const next: Stations = { ...state, dishedAt: dished };
  const kept = state.walk.filter((id) => itemsAt(next, id) > 0);
  const joins = placeId !== PASS && !kept.includes(placeId);
  const walk = joins ? [...kept, placeId] : kept;
  const name = stationById(state, placeId)?.name ?? '';
  const words = [`${item} is dished at ${name}.`];
  if (joins) words.push(`${name} joins the walking order at stop ${walk.length + 1}.`);
  if (before !== PASS && !walk.includes(before))
    words.push(`${stationById(state, before)?.name ?? ''} leaves the walking order.`);

  return { state: { ...next, walk }, said: words.join(' ') };
}

export function moveStop(state: Stations, placeId: string, by: -1 | 1): Changed | null {
  const at = state.walk.indexOf(placeId);
  const to = at + by;
  if (at < 0 || to < 0 || to >= state.walk.length) return null;

  const walk = state.walk.slice();
  walk.splice(at, 1);
  walk.splice(to, 0, placeId);

  return {
    state: { ...state, walk },
    said: stopLine(stationById(state, placeId)?.name ?? '', to + 2, walk.length + 1),
  };
}

/** Removing a place names what goes with it; each clause only when it applies. */
export function removeLine(state: Stations, placeId: string): string {
  const place = stationById(state, placeId);
  if (place == null) return '';
  const people = place.people.length;
  const items = itemsAt(state, placeId);
  const lose = `${stationsWord(people, 'person', 'people')} ${people === 1 ? 'loses' : 'lose'} their station`;
  const go = `${stationsWord(items, 'item', 'items')} ${items === 1 ? 'goes' : 'go'} to the Pass`;
  const ask = `Remove ${place.name}?`;

  if (people > 0 && items > 0) return `${ask} ${lose}, and its ${go}.`;
  if (people > 0) return `${ask} ${lose}.`;
  if (items > 0) return `${ask} Its ${go}.`;

  return ask;
}

export function removePlace(state: Stations, placeId: string): Changed {
  const place = stationById(state, placeId);
  const dished = Object.fromEntries(
    Object.entries(state.dishedAt).filter(([, at]) => at !== placeId),
  );
  const people = place?.people.length ?? 0;
  const said = [`${place?.name ?? ''} removed.`];
  if (people > 0) said.push(`${stationsWord(people, 'person has', 'people have')} no station now.`);

  return {
    state: {
      ...state,
      stations: state.stations.filter((one) => one.id !== placeId),
      dishedAt: dished,
      walk: state.walk.filter((id) => id !== placeId),
    },
    said: said.join(' '),
  };
}

/** A place's name: required, at most 60, unique among the event's stations ignoring case and accents. */
export function checkName(state: Stations, raw: string, except: string | null): string | null {
  const name = raw.trim();
  if (name === '') return SW.blank;
  if (name.length > NAME_MAX) return SW.tooLong;

  const section = sectionsOf(state).find((one) => sameName(baseName(sectionLabel(one)), name));
  if (section != null)
    return `${section.name} is a seating section on this event. Give the place another name.`;
  const place = placesOf(state).find((one) => one.id !== except && sameName(one.name, name));
  if (place != null) return `This event already has a place called ${place.name}.`;

  return null;
}

let added = 0;

export function addPlace(state: Stations, raw: string): Changed {
  added += 1;
  const name = raw.trim();
  const place: Station = {
    id: `new${added}`,
    name,
    kind: 'place',
    tables: 0,
    people: [],
    lead: null,
  };

  return {
    state: { ...state, stations: [...placesOf(state), place, ...sectionsOf(state)] },
    said: `${name} added. Nobody is on it yet.`,
  };
}

export function renamePlace(state: Stations, placeId: string, raw: string): Changed {
  const name = raw.trim();

  return {
    state: {
      ...state,
      stations: state.stations.map((one) => (one.id === placeId ? { ...one, name } : one)),
    },
    said: `Renamed to ${name}.`,
  };
}

export function stationOf(state: Stations, personId: string): Station | undefined {
  return state.stations.find((one) => one.people.includes(personId));
}

export function personById(personId: string): Person {
  return ROSTER.find((one) => one.id === personId) as Person;
}

export function shiftOf(person: Person): string {
  return `${person.from} to ${person.to}`;
}

/** Puts someone on a station, or takes them off it; a lead who leaves stops being its lead. */
export function toggle(state: Stations, personId: string, stationId: string): Changed {
  const person = personById(personId);
  const from = stationOf(state, personId);
  const target = stationById(state, stationId) as Station;
  const off = from?.id === stationId;
  const wasLead = from?.lead === personId;
  const stations = state.stations.map((one) => {
    if (one.id === from?.id)
      return {
        ...one,
        people: one.people.filter((id) => id !== personId),
        lead: wasLead ? null : one.lead,
      };
    if (!off && one.id === stationId) return { ...one, people: [...one.people, personId] };

    return one;
  });
  const fromName = from == null ? '' : labelOf(from);
  const toName = labelOf(target);
  let said = `${person.name} is on ${toName}.`;
  if (off)
    said = wasLead
      ? `${person.name} left ${toName}, so it has no lead now.`
      : `${person.name} has no station now.`;
  else if (from != null)
    said = `${person.name} moved from ${fromName} to ${toName}.${wasLead ? ` ${fromName} has no lead now.` : ''}`;

  return { state: { ...state, stations }, said };
}

export function setLead(state: Stations, stationId: string, personId: string | null): Changed {
  const station = stationById(state, stationId) as Station;
  const name = labelOf(station);

  return {
    state: {
      ...state,
      stations: state.stations.map((one) =>
        one.id === stationId ? { ...one, lead: personId } : one,
      ),
    },
    said: personId == null ? `${name} has no lead.` : `${personById(personId).name} leads ${name}.`,
  };
}

export function noStation(state: Stations): Person[] {
  return ROSTER.filter((one) => stationOf(state, one.id) == null);
}

export function noStationLine(state: Stations): string {
  const names = noStation(state).map((one) => one.name);
  if (names.length === 0) return SW.everyone;

  return `${stationsWord(names.length, 'person', 'people')} on tonight’s roster ${names.length === 1 ? 'has' : 'have'} no station: ${andList(names)}.`;
}

export function noLeadLine(state: Stations): string {
  return state.floor == null
    ? 'No lead, and no floor lead yet.'
    : `No lead. Their lead is the floor lead, ${personById(state.floor).name}.`;
}

export function placeMeta(state: Stations, station: Station): string {
  const parts: string[] = [];
  if (station.people.length > 0)
    parts.push(stationsWord(station.people.length, 'person', 'people'));
  if (station.kind === 'place') {
    const line = dishesLine(itemsAt(state, station.id));
    if (line != null) parts.push(line);
  }

  return parts.join(' · ');
}

const person = (id: string, name: string, job: string, from: string, to: string): Person => ({
  id,
  name,
  job,
  from,
  to,
});

export const ROSTER: readonly Person[] = [
  person('ifeoma', 'Ifeoma Nduka', 'Floor lead', '16:00', '01:00'),
  person('kunle', 'Kunle Ajayi', 'Waiter', '17:00', '00:00'),
  person('grace', 'Grace Udo', 'Waiter', '17:00', '00:00'),
  person('chidi', 'Chidi Okafor', 'Waiter', '17:00', '00:00'),
  person('funmi', 'Funmi Bakare', 'Waiter', '17:00', '00:00'),
  person('emeka', 'Emeka Obi', 'Waiter', '19:00', '23:00'),
  person('yinka', 'Yinka Hassan', 'Runner', '17:00', '00:00'),
  person('ronke', 'Ronke Alade', 'Pass', '16:00', '00:00'),
  person('bisi', 'Bisi Okon', 'Cook', '15:00', '23:00'),
  person('tayo', 'Tayo Bamidele', 'Cook', '15:00', '23:00'),
  person('gbenga', 'Gbenga Salami', 'Cook', '15:00', '23:00'),
  person('ada', 'Ada Nnaji', 'Pastry', '15:00', '23:00'),
  person('tolu', 'Tolu Bello', 'Door', '16:30', '21:00'),
  person('sade', 'Sade Lawal', 'Bar', '16:00', '01:00'),
  person('bola', 'Bola Ajayi', 'Bar', '16:00', '01:00'),
];

const place = (id: string, name: string, people: string[] = [], lead: string | null = null) =>
  ({ id, name, kind: 'place', tables: 0, people, lead }) satisfies Station;
const section = (
  id: string,
  name: string,
  tables: number,
  people: string[] = [],
  lead: string | null = null,
) => ({ id, name, kind: 'section', tables, people, lead }) satisfies Station;

function rowsOf(courses: readonly Course[]): CourseRow[] {
  return courses.map((one) => ({ id: one.id, name: one.name, items: courseItems(one) }));
}

const DISHED: Record<string, string> = {
  [itemKey('c1', 'Canapé selection')]: 'kitchen',
  [itemKey('c2', 'Rice')]: 'kitchen',
  [itemKey('c2', 'Chicken')]: 'grill',
  [itemKey('c2', 'Plantain')]: 'kitchen',
  [itemKey('c2', 'Moi moi')]: 'kitchen',
  [itemKey('c2', 'Croaker')]: 'grill',
  [itemKey('c2', 'Tilapia')]: 'grill',
  [itemKey('c2', 'Yam chips')]: 'kitchen',
  [itemKey('c3', 'Ice cream')]: 'pastry',
};

function base(): Stations {
  return {
    stations: [
      place(PASS, 'Pass', ['ronke', 'yinka'], 'ronke'),
      place('door', 'Door', ['tolu']),
      place('bar', 'Bar', ['sade', 'bola'], 'sade'),
      place('kitchen', 'Kitchen', ['bisi'], 'bisi'),
      place('stage', 'Stage'),
      place('floor', 'Floor', ['ifeoma']),
      place('grill', 'Grill', ['tayo', 'gbenga'], 'tayo'),
      place('pastry', 'Pastry'),
      section('sa', 'Section A', 6, ['kunle', 'grace', 'chidi'], 'grace'),
      section('sb', 'Section B', 1, ['funmi']),
      section('sc', 'Section C', 0),
    ],
    floor: 'ifeoma',
    courses: rowsOf(servedCourses()),
    dishedAt: DISHED,
    walk: ['kitchen', 'grill', 'pastry'],
  };
}

export interface StationsStart {
  name: string;
  note: string;
  state: Stations;
  panel: Panel;
  manage: boolean;
  said: string;
  asking: string | null;
  draft: string;
  pressed: boolean;
  scroll: 'dishes' | 'walk' | null;
  removed: boolean;
}

function start(o: Partial<StationsStart> & Pick<StationsStart, 'name' | 'note'>): StationsStart {
  return {
    state: base(),
    panel: null,
    manage: true,
    said: '',
    asking: null,
    draft: '',
    pressed: false,
    scroll: null,
    removed: false,
    ...o,
  };
}

function allAtPass(): Stations {
  return { ...base(), dishedAt: {}, walk: [] };
}

const STATES = {
  populated: () =>
    start({
      name: 'Populated',
      note: 'Places with the Pass first, sections with their table count, who is on each, and what each place dishes.',
    }),
  people: () =>
    start({
      name: 'People and lead, on Grill',
      note: 'The panel docks beside the list: Put on, Move here or Take off for each person, and the Lead select.',
      panel: { kind: 'people', id: 'grill' },
    }),
  allPass: () =>
    start({
      name: 'Every item at the Pass',
      note: 'A new menu: each Dished at reads Pass, and no place says it dishes anything.',
      state: allAtPass(),
      scroll: 'dishes',
    }),
  courseEmpty: () =>
    start({
      name: 'A course with no dishes',
      note: 'The Dessert has no dishes yet.',
      state: {
        ...base(),
        courses: base().courses.map((one) => (one.id === 'c3' ? { ...one, items: [] } : one)),
        dishedAt: Object.fromEntries(
          Object.entries(DISHED).filter(([key]) => !key.startsWith('c3|')),
        ),
        walk: ['kitchen', 'grill'],
      },
      scroll: 'dishes',
    }),
  noCourses: () =>
    start({
      name: 'A menu with no courses',
      note: 'Nothing to give a station yet, so the walking order is the Pass alone.',
      state: { ...base(), courses: [], dishedAt: {}, walk: [] },
      scroll: 'dishes',
    }),
  walkEmpty: () =>
    start({
      name: 'Walking order, the Pass alone',
      note: 'With no kitchen station but the Pass, the walking order says every item is dished there.',
      state: allAtPass(),
      scroll: 'walk',
    }),
  moved: () =>
    start({
      name: 'After a move',
      note: 'Grill moved up: the move is announced, and focus stays on the button pressed.',
      state: { ...base(), walk: ['grill', 'kitchen', 'pastry'] },
      said: stopLine('Grill', 2, 4),
      scroll: 'walk',
    }),
  removeBoth: () =>
    start({
      name: 'Remove a place with people and items',
      note: 'Each clause shows only when it applies.',
      asking: 'grill',
    }),
  removePeople: () =>
    start({ name: 'Remove a place with people only', note: 'Bar dishes nothing.', asking: 'bar' }),
  removeItems: () =>
    start({
      name: 'Remove a place with items only',
      note: 'Nobody is on Pastry.',
      asking: 'pastry',
    }),
  removeEmpty: () =>
    start({
      name: 'Remove a place with neither',
      note: 'Nobody on Stage and nothing dished there: still asked first.',
      asking: 'stage',
    }),
  readOnly: () =>
    start({
      name: 'Read only, with staff.read alone',
      note: 'Every select and button shown as text.',
      manage: false,
    }),
  addBlank: () =>
    start({
      name: 'Add a place, no name',
      note: 'Add place pressed with the name empty: nothing is sent.',
      panel: { kind: 'name', id: null },
      pressed: true,
    }),
  addTaken: () =>
    start({
      name: 'Add a place, a place’s name',
      note: 'Another place has the name, ignoring case and accents.',
      panel: { kind: 'name', id: null },
      draft: 'bar',
      pressed: true,
    }),
  addTakenSection: () =>
    start({
      name: 'Add a place, a section’s name',
      note: 'The part before “ · ” is the section’s name.',
      panel: { kind: 'name', id: null },
      draft: 'section a',
      pressed: true,
    }),
  sectionRemoved: () =>
    start({
      name: 'A section removed from the seating plan',
      note: 'Its people have no station now, and the roster says so.',
      state: {
        ...base(),
        stations: base().stations.map((one) =>
          one.id === 'sa' ? { ...one, people: ['kunle', 'grace'] } : one,
        ),
      },
      removed: true,
    }),
  noFloorLead: () =>
    start({
      name: 'No floor lead',
      note: 'Before anyone chooses one.',
      state: { ...base(), floor: null },
    }),
  floorLeadBlank: () =>
    start({
      name: 'Floor lead, nobody chosen',
      note: 'Save floor lead pressed with nobody chosen.',
      state: { ...base(), floor: null },
      panel: { kind: 'floor' },
      pressed: true,
    }),
} satisfies Record<string, () => StationsStart>;

export type StationsStateName = keyof typeof STATES;

export const STATIONS_STATES = Object.keys(STATES) as StationsStateName[];

export function stationsStart(raw: string | null): StationsStart {
  const name: StationsStateName =
    raw != null && Object.hasOwn(STATES, raw) ? (raw as StationsStateName) : 'populated';

  return STATES[name]();
}

export function stationsAt(state?: StationsStateName): string {
  return `/demo/events/${STATIONS_EVENT}/staff${state == null ? '' : `?state=${state}`}`;
}

function link(state: StationsStateName): DemoLink {
  return { to: stationsAt(state), name: STATES[state]().name };
}

export const STATIONS_PAGES: readonly { name: string; states: readonly DemoLink[] }[] = [
  {
    name: 'Stations, places and sections',
    states: (
      [
        'populated',
        'people',
        'readOnly',
        'noFloorLead',
        'floorLeadBlank',
        'sectionRemoved',
      ] as const
    ).map(link),
  },
  {
    name: 'What each station dishes, and the walking order',
    states: (['allPass', 'courseEmpty', 'noCourses', 'walkEmpty', 'moved'] as const).map(link),
  },
  {
    name: 'Adding and removing a place',
    states: (
      [
        'addBlank',
        'addTaken',
        'addTakenSection',
        'removeBoth',
        'removePeople',
        'removeItems',
        'removeEmpty',
      ] as const
    ).map(link),
  },
];

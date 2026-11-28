import i18next from 'i18next';

import { writtenTime } from './clock.ts';
import type { DemoLink } from './settings.ts';

/** The event's Schedule page (sc-3893, RunOfShow.dc.html on page e33): a table per place for each event day, and the item form. */
export const SCHEDULE_EVENT = 'evt-wed-4';
export const EVENT_ZONE = 'Europe/London';
export const EARLIEST = '2026-11-05T06:00';
export const LATEST = '2026-11-07T15:00';
export const DAYS = ['2026-11-05', '2026-11-06', '2026-11-07'] as const;
/** The unmatched value of sc-64803: an event of seven days, Thursday to Wednesday. */
export const SEVEN_DAYS = [
  '2026-11-05',
  '2026-11-06',
  '2026-11-07',
  '2026-11-08',
  '2026-11-09',
  '2026-11-10',
  '2026-11-11',
] as const;
export const MAIN = 'Main';
export const MOST_ITEMS = 200;
export const TITLE_MAX = 120;
export const OWNER_MAX = 120;
export const ROLE_MAX = 40;
export const NOTE_MAX = 500;
export const LASTS_MAX = 720;
const DAY_TURNS_AT = 5;

export interface Item {
  id: string;
  title: string;
  /** Wall-clock time in the event's zone, `YYYY-MM-DDTHH:mm`. */
  starts: string;
  lasts: number | null;
  place: string | null;
  owner: string | null;
  role: string | null;
  note: string | null;
  fixed: boolean;
  guests: boolean;
  course: string | null;
}

/** A course on the event's menu (epic 32), in menu order. Its own served time shows only while no item links it (sc-3898, Decided 28 Nov). */
export interface Course {
  id: string;
  name: string;
  servedAt: string | null;
}

export interface Form {
  title: string;
  date: string;
  time: string;
  lasts: string;
  place: string;
  owner: string;
  role: string;
  note: string;
  fixed: boolean;
  guests: boolean;
  course: string | null;
}

export type Field = 'title' | 'date' | 'time' | 'lasts' | 'owner' | 'role' | 'note';

export const FIELD_ORDER: readonly Field[] = [
  'title',
  'date',
  'time',
  'lasts',
  'owner',
  'role',
  'note',
];

export type Errors = Partial<Record<Field, string>>;

export const RW = {
  title: 'Schedule',
  failed: 'The schedule did not load.',
  items: (n: number) => `${n} ${n === 1 ? 'item' : 'items'}`,
  addItem: 'Add item',
  empty: 'Nothing scheduled yet',
  emptyLine:
    'Add the first item for this day: when it starts, how long it lasts, where and who runs it.',
  lock: 'You can see this schedule. Ask whoever runs the event to change it.',
  days: 'Days',
  starts: 'Starts',
  lasts: 'Lasts',
  item: 'Item',
  owner: 'Owner',
  noOwner: 'No owner',
  noLength: 'No length',
  minutes: (n: number) => `${n} min`,
  fixed: 'Fixed time',
  shown: 'Shown to guests',
  placePicker: (place: string) => `Place: ${place}`,
  editItem: 'Edit item',
  close: 'Close',
  back: 'Back to schedule',
  save: 'Save item',
  cancel: 'Cancel',
  optional: 'Optional',
  titleLabel: 'Title',
  date: 'Date',
  time: 'Time',
  lastsLabel: 'Lasts, in minutes',
  place: 'Place',
  ownerLabel: 'Owner',
  role: 'Role',
  note: 'Note for the owner',
  showToGuests: 'Show to guests',
  fixedLine: 'It keeps this time when the items around it run late.',
  guestsLine: 'Guests see its time, title and place on their page.',
  count: (n: number, of: number) => `${n} of ${of}`,
  noteHelp: (n: number) => `${n} of ${NOTE_MAX}. Only the owner sees it, on their cues.`,
  runsOn: 'With no length, it runs until the next item starts.',
  endsAt: (time: string) => `Ends at ${time}.`,
  window: (earliest: string, end: string) => `Choose a time between ${earliest} and ${end}.`,
  zoneLine: (zone: string) => `Times are in ${zone}.`,
  newPlace: (name: string) => `A new place. ${name} gets its own table on this day.`,
  moves: (place: string) => `[It moves to ${place}’s table and keeps its start.]`,
  blankTitle: 'Enter a title.',
  longTitle: (n: number) => `That title is ${n} characters. Use ${TITLE_MAX} or fewer.`,
  noStart: 'Choose the date and time it starts.',
  badLength: `Enter a length from 0 to ${LASTS_MAX} minutes, or leave it empty.`,
  longOwner: (n: number) => `That name is ${n} characters. Use ${OWNER_MAX} or fewer.`,
  longRole: (n: number) => `That role is ${n} characters. Use ${ROLE_MAX} or fewer.`,
  longNote: (n: number) => `That note is ${n} characters. Use ${NOTE_MAX} or fewer.`,
  limit: `This schedule has ${MOST_ITEMS} items, the most an event can hold. Delete one to add another. Nothing was saved.`,
  conflict: '[Someone else changed this item while you had it open. Choose which version to keep.]',
  theirs: 'Theirs',
  yours: 'Yours',
  field: 'Field',
  useTheirs: 'Use theirs',
  keepMine: 'Keep mine',
  deleteItem: 'Delete item',
  deleteAsk: (title: string) => `Delete ${title}?`,
  keepIt: 'Keep it',
  deleted: (title: string) => `${title} deleted.`,
  undoOpen: 'Undo is open for 10 seconds.',
  added: (title: string) => `${title} added.`,
  saved: (title: string) => `${title} saved.`,
  restored: (title: string) => `${title} is back.`,
  notSaved: 'Not saved. What you entered is still here. Try again.',
  notDeleted: 'Not deleted. Nothing was changed. Try again.',
  notRestored: (title: string) => `${title} was not brought back. Add it again with Add item.`,
  gone: 'Someone else deleted this item while you had it open. Nothing was saved.',
  addAgain: 'Add it again',
  move: 'Move',
  more: 'More',
  course: 'Course',
  noCourse: 'No course',
  courseHelp: 'While it is linked, the menu shows this item’s start as the course’s served time.',
  courseList: 'Courses on the menu',
  courseTag: (name: string) => `Course · ${name}`,
  served: (time: string) => `served ${time}`,
  linkedTo: (title: string) => `linked to ${title}`,
  moveAsk: (course: string, other: string) => `${course} is linked to ${other}.`,
  moveLine: (other: string) => `Link it to this item instead? ${other} loses it.`,
  moveIt: 'Move the link',
  keepOn: (other: string) => `Keep it on ${other}`,
  moving: (other: string) => `${other} loses this course when you save.`,
  noCourses: 'No courses on the menu yet',
  noCoursesLine: 'Add the courses on the Menu page, then link one here.',
  openMenu: 'Open the menu',
  unlinked: (title: string) => `${title} is no longer linked to a course.`,
  unlinkedWhy: 'Its course was removed from the menu. The item keeps its title and time.',
  dismiss: 'Dismiss',
} as const;

const item = (
  id: string,
  title: string,
  starts: string,
  lasts: number | null,
  place: string | null,
  owner: string | null = null,
  role: string | null = null,
  extra: Partial<Item> = {},
): Item => ({
  id,
  title,
  starts,
  lasts,
  place,
  owner,
  role,
  note: null,
  fixed: false,
  guests: false,
  course: null,
  ...extra,
});

export function sampleItems(): Item[] {
  return [
    item('drinks', 'Welcome drinks', '2026-11-05T18:00', 120, null, 'Ebele Nwosu', 'Venue', {
      guests: true,
    }),
    item('families', 'The families meet', '2026-11-05T20:00', 60, null, 'Ngozi Obi', 'Aunt'),
    item(
      'seated',
      'Guests seated',
      '2026-11-06T13:30',
      30,
      null,
      'Chief Mrs Folasade Okonkwo-Williams',
      'Aunt',
    ),
    item('ceremony', 'Ceremony', '2026-11-06T14:00', 45, null, 'Father Okafor', 'Officiant', {
      fixed: true,
      guests: true,
    }),
    item('photos', 'Photos', '2026-11-06T15:00', 60, 'Garden', 'Dayo Bello', 'Photographer'),
    item(
      'reception',
      'Drinks reception',
      '2026-11-06T15:00',
      90,
      'Garden',
      'Ebele Nwosu',
      'Venue',
      {
        guests: true,
      },
    ),
    item('entrance', 'Grand entrance', '2026-11-06T17:00', 15, 'Ballroom', 'Kemi Adebayo', 'MC', {
      fixed: true,
      guests: true,
    }),
    item('dinner', 'Dinner', '2026-11-06T17:30', 90, 'Ballroom', 'Amara Eze', 'Kitchen', {
      guests: true,
    }),
    item('speeches', 'Speeches', '2026-11-06T19:15', 30, 'Ballroom', 'Kemi Adebayo', 'MC', {
      note: 'Father of the bride first, then the best man. Keep each to five minutes.',
    }),
    item('dance', 'First dance', '2026-11-06T20:00', 10, 'Ballroom', null, null, {
      fixed: true,
      guests: true,
    }),
    item('dancing', 'Dancing', '2026-11-06T20:15', 240, 'Ballroom', 'Femi Ade', 'DJ'),
    item('late', 'Late food', '2026-11-07T00:30', 30, 'Ballroom', 'Amara Eze', 'Kitchen'),
  ];
}

/** Seven days: Saturday holds 1 item and Sunday 12, the two counts sc-64803 reads in every language. */
export function sevenDayItems(): Item[] {
  const sunday = Array.from({ length: 12 }, (_, at) =>
    item(
      `sun-${at + 1}`,
      `Sunday item ${at + 1}`,
      `2026-11-08T${String(9 + at).padStart(2, '0')}:00`,
      30,
      null,
    ),
  );

  return [
    ...sampleItems(),
    item('brunch', 'Brunch', '2026-11-07T11:00', 90, 'Garden', 'Ebele Nwosu', 'Venue'),
    ...sunday,
    item('golf', 'Golf', '2026-11-09T10:00', 240, null, 'Tunde Bakare', 'Groom'),
    item('market', 'Market walk', '2026-11-10T10:00', 120, null),
    item('market-lunch', 'Lunch by the river', '2026-11-10T13:00', 90, null),
    item('farewell', 'Farewell breakfast', '2026-11-11T09:00', 60, null, 'Ngozi Obi', 'Aunt'),
  ];
}

/** A day tab's count in the reader's language, read from the product's schedule.items so the two cannot drift (sc-64803). */
export function dayCount(n: number, locale: string): string {
  return i18next.getFixedT(locale.slice(0, 2))('schedule.items', { count: n });
}

export function atLimit(): Item[] {
  const items = sampleItems();
  const pad = MOST_ITEMS - items.length;
  const padded = Array.from({ length: pad }, (_, at) => {
    const minutes = 6 * 60 + at * 5;
    const hh = String(Math.floor(minutes / 60)).padStart(2, '0');
    const mm = String(minutes % 60).padStart(2, '0');
    return item(
      `pad-${at + 1}`,
      `Run-through ${at + 1}`,
      `2026-11-06T${hh}:${mm}`,
      5,
      'Rehearsal room',
    );
  });

  return [...items, ...padded];
}

const pad2 = (n: number): string => String(n).padStart(2, '0');

function wallMinutes(wall: string): number {
  return Date.UTC(
    Number(wall.slice(0, 4)),
    Number(wall.slice(5, 7)) - 1,
    Number(wall.slice(8, 10)),
    Number(wall.slice(11, 13)),
    Number(wall.slice(14, 16)),
  );
}

function wallOf(ms: number): string {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}T${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`;
}

/** An item is on the event day of its start; an event day runs from 05:00 to 05:00 (sc-3895, Decided 1 Nov). */
export function dayOf(starts: string): string {
  return wallOf(wallMinutes(starts) - DAY_TURNS_AT * 3600_000).slice(0, 10);
}

export function endOf(one: Item): string {
  return wallOf(wallMinutes(one.starts) + (one.lasts ?? 0) * 60_000);
}

export function placeOf(one: Item): string {
  return one.place ?? MAIN;
}

const byStart = (a: Item, b: Item): number =>
  a.starts === b.starts ? a.title.localeCompare(b.title) : a.starts < b.starts ? -1 : 1;

export function itemsOn(items: readonly Item[], day: string): Item[] {
  return items.filter((one) => dayOf(one.starts) === day).sort(byStart);
}

export interface Table {
  place: string;
  items: Item[];
}

export function tablesOn(items: readonly Item[], day: string): Table[] {
  const tables = new Map<string, Item[]>();
  for (const one of itemsOn(items, day)) {
    const place = placeOf(one);
    tables.set(place, [...(tables.get(place) ?? []), one]);
  }

  return [...tables.entries()]
    .map(([place, rows]) => ({ place, items: rows }))
    .sort((a, b) => byStart(a.items[0] as Item, b.items[0] as Item));
}

export function placesOn(items: readonly Item[], day: string): string[] {
  return tablesOn(items, day).map((table) => table.place);
}

export function placeKey(typed: string, known: readonly string[] = []): string | null {
  const trimmed = typed.trim();
  if (trimmed === '' || trimmed.toLowerCase() === MAIN.toLowerCase()) return null;

  return known.find((one) => one.toLowerCase() === trimmed.toLowerCase()) ?? trimmed;
}

/** The places on the event day the form's start falls on, so a typed place matches that day's tables. */
export function formPlaces(items: readonly Item[], form: Form): string[] {
  if (form.date === '') return [];
  const day = form.time === '' ? form.date : dayOf(`${form.date}T${form.time}`);

  return placesOn(items, day);
}

export interface Reader {
  locale: string;
  zone: string;
}

export const HOME_READER: Reader = { locale: 'en-GB', zone: EVENT_ZONE };

const asUtc = (wall: string): Date => new Date(wallMinutes(wall));

export function timeOf(wall: string, reader: Reader): string {
  return writtenTime(wall, reader.locale);
}

export function dayName(day: string, reader: Reader): string {
  return new Intl.DateTimeFormat(reader.locale, {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(asUtc(`${day}T12:00`));
}

export function dayAndTime(wall: string, reader: Reader): string {
  return `${dayName(wall.slice(0, 10), reader)}, ${timeOf(wall, reader)}`;
}

/** A start after midnight carries its weekday, since it sits on the tab of the day before. */
export function startsCell(one: Item, day: string, reader: Reader): string {
  if (one.starts.slice(0, 10) === day) return timeOf(one.starts, reader);
  const weekday = new Intl.DateTimeFormat(reader.locale, {
    timeZone: 'UTC',
    weekday: 'short',
  }).format(asUtc(one.starts));

  return `${weekday} ${timeOf(one.starts, reader)}`;
}

export function zoneNamed(reader: Reader): string | null {
  if (reader.zone === EVENT_ZONE) return null;
  const part = new Intl.DateTimeFormat(reader.locale, {
    timeZone: EVENT_ZONE,
    timeZoneName: 'longGeneric',
  })
    .formatToParts(new Date(Date.UTC(2026, 10, 6, 12)))
    .find((one) => one.type === 'timeZoneName');

  return part?.value ?? EVENT_ZONE;
}

export function headingLine(items: readonly Item[], day: string, reader: Reader): string | null {
  const rows = itemsOn(items, day);
  if (rows.length === 0) return null;
  const first = (rows[0] as Item).starts;
  const last = rows.map(endOf).sort().at(-1) as string;
  const places = placesOn(items, day).length;
  const zone = zoneNamed(reader);

  return [
    RW.items(rows.length),
    `${timeOf(first, reader)} to ${timeOf(last, reader)}`,
    `${places} ${places === 1 ? 'place' : 'places'}`,
    ...(zone == null ? [] : [zone]),
  ].join(' · ');
}

export function lastsCell(one: Item): string {
  return one.lasts == null ? RW.noLength : RW.minutes(one.lasts);
}

export function underLine(one: Item): string {
  return [one.lasts == null ? null : RW.minutes(one.lasts), one.role, one.owner ?? RW.noOwner]
    .filter((part): part is string => part != null && part !== '')
    .join(' · ');
}

export function blankForm(day: string): Form {
  return {
    title: '',
    date: day,
    time: '',
    lasts: '',
    place: '',
    owner: '',
    role: '',
    note: '',
    fixed: false,
    guests: false,
    course: null,
  };
}

export function formOf(one: Item): Form {
  return {
    title: one.title,
    date: one.starts.slice(0, 10),
    time: one.starts.slice(11, 16),
    lasts: one.lasts == null ? '' : String(one.lasts),
    place: one.place ?? '',
    owner: one.owner ?? '',
    role: one.role ?? '',
    note: one.note ?? '',
    fixed: one.fixed,
    guests: one.guests,
    course: one.course,
  };
}

const blankToNull = (typed: string): string | null => (typed.trim() === '' ? null : typed.trim());

export function itemOf(id: string, form: Form, known: readonly string[] = []): Item {
  return {
    id,
    title: form.title.trim(),
    starts: `${form.date}T${form.time}`,
    lasts: form.lasts.trim() === '' ? null : Number(form.lasts),
    place: placeKey(form.place, known),
    owner: blankToNull(form.owner),
    role: blankToNull(form.role),
    note: blankToNull(form.note),
    fixed: form.fixed,
    guests: form.guests,
    course: form.course,
  };
}

/** The event's menu, in the Menu demo's order and with its own times (menuCourses.ts sampleCourses). */
export function sampleCourses(): Course[] {
  return [
    { id: 'k1', name: 'Starter', servedAt: '18:30' },
    { id: 'k2', name: 'Main', servedAt: '20:00' },
    { id: 'k3', name: 'Dessert', servedAt: '21:30' },
    { id: 'k4', name: 'Late-night bites', servedAt: null },
  ];
}

/** Dinner is the Starter and Mains go out the Main; Late food has no course yet. */
export function linkedItems(): Item[] {
  return [
    ...sampleItems().map((one) => (one.id === 'dinner' ? { ...one, course: 'k1' } : one)),
    item('mains', 'Mains go out', '2026-11-06T19:50', 20, 'Ballroom', 'Amara Eze', 'Kitchen', {
      course: 'k2',
    }),
  ];
}

export function courseOf(id: string | null, courses: readonly Course[]): Course | null {
  return id == null ? null : (courses.find((one) => one.id === id) ?? null);
}

/** The other item holding a course, so choosing it asks before the link moves. */
export function holderOf(
  courseId: string,
  items: readonly Item[],
  editingId: string | null,
): Item | null {
  return items.find((one) => one.course === courseId && one.id !== editingId) ?? null;
}

/** A linked course is served at its item's planned start; an unlinked one at its own time, if it has one (Decided 28 Nov). */
export function servedTime(course: Course, items: readonly Item[], reader: Reader): string | null {
  const holder = items.find((one) => one.course === course.id);
  if (holder != null) return timeOf(holder.starts, reader);

  return course.servedAt;
}

/** The item being edited at the time typed on its form, so the picker shows the time its course will be served at on Save. */
export function withTypedStart(
  items: readonly Item[],
  editingId: string | null,
  form: Pick<Form, 'date' | 'time'>,
): readonly Item[] {
  if (editingId == null || form.date === '' || form.time === '') return items;
  const starts = `${form.date}T${form.time}`;

  return items.map((one) => (one.id === editingId ? { ...one, starts } : one));
}

export function courseLine(
  course: Course,
  items: readonly Item[],
  editingId: string | null,
  reader: Reader,
): string | null {
  const time = servedTime(course, items, reader);
  const holder = holderOf(course.id, items, editingId);

  return (
    [time == null ? null : RW.served(time), holder == null ? null : RW.linkedTo(holder.title)]
      .filter((part): part is string => part != null)
      .join(' · ') || null
  );
}

/** Saving an item with a course takes that course from whichever item held it. */
export function withCourseKept(items: readonly Item[], saved: Item): Item[] {
  return [
    ...items
      .filter((one) => one.id !== saved.id)
      .map((one) =>
        saved.course != null && one.course === saved.course ? { ...one, course: null } : one,
      ),
    saved,
  ];
}

export function windowLine(reader: Reader): string {
  return RW.window(dayAndTime(EARLIEST, reader), dayAndTime(LATEST, reader));
}

export function check(form: Form, reader: Reader): Errors {
  const errors: Errors = {};
  const title = form.title.trim();
  if (title === '') errors.title = RW.blankTitle;
  else if (title.length > TITLE_MAX) errors.title = RW.longTitle(title.length);

  if (form.date === '') errors.date = RW.noStart;
  else if (form.time === '') errors.time = RW.noStart;
  else {
    const starts = `${form.date}T${form.time}`;
    if (starts < EARLIEST || starts > LATEST) errors.date = windowLine(reader);
  }

  const lasts = form.lasts.trim();
  if (lasts !== '' && !(/^\d+$/.test(lasts) && Number(lasts) <= LASTS_MAX))
    errors.lasts = RW.badLength;

  const owner = form.owner.trim();
  if (owner.length > OWNER_MAX) errors.owner = RW.longOwner(owner.length);
  const role = form.role.trim();
  if (role.length > ROLE_MAX) errors.role = RW.longRole(role.length);
  if (form.note.length > NOTE_MAX) errors.note = RW.longNote(form.note.length);

  return errors;
}

export function firstWrong(errors: Errors): Field | null {
  return FIELD_ORDER.find((field) => errors[field] != null) ?? null;
}

export function lastsHelp(form: Form, reader: Reader): string | null {
  const lasts = form.lasts.trim();
  if (lasts === '') return RW.runsOn;
  if (form.date === '' || form.time === '' || !/^\d+$/.test(lasts)) return null;
  if (Number(lasts) > LASTS_MAX) return null;

  return RW.endsAt(
    timeOf(wallOf(wallMinutes(`${form.date}T${form.time}`) + Number(lasts) * 60_000), reader),
  );
}

export function placeHelp(items: readonly Item[], form: Form, editing: Item | null): string | null {
  const known = formPlaces(items, form);
  const typed = placeKey(form.place, known);
  if (typed != null && !known.includes(typed)) return RW.newPlace(typed);
  if (editing != null && typed !== editing.place) return RW.moves(typed ?? MAIN);

  return null;
}

export interface Difference {
  field: string;
  theirs: string;
  yours: string;
}

export function differences(theirs: Item, yours: Form, reader: Reader): Difference[] {
  const mine = itemOf(theirs.id, yours);
  const rows: [string, string, string][] = [
    [RW.titleLabel, theirs.title, mine.title],
    [RW.starts, dayAndTime(theirs.starts, reader), dayAndTime(mine.starts, reader)],
    [RW.lasts, lastsCell(theirs), lastsCell(mine)],
    [RW.place, placeOf(theirs), placeOf(mine)],
    [RW.ownerLabel, theirs.owner ?? RW.noOwner, mine.owner ?? RW.noOwner],
    [RW.role, theirs.role ?? '', mine.role ?? ''],
    [RW.note, theirs.note ?? '', mine.note ?? ''],
    [RW.fixed, theirs.fixed ? 'On' : 'Off', mine.fixed ? 'On' : 'Off'],
    [RW.showToGuests, theirs.guests ? 'On' : 'Off', mine.guests ? 'On' : 'Off'],
  ];

  return rows
    .filter(([, a, b]) => a !== b)
    .map(([field, a, b]) => ({ field, theirs: a, yours: b }));
}

export const THEIRS: Item = {
  ...(sampleItems().find((one) => one.id === 'speeches') as Item),
  starts: '2026-11-06T19:30',
  owner: 'Tunde Bakare',
  role: 'Groom',
};

export type Failure = 'save' | 'delete' | 'undo' | 'gone';

export type Panel = { kind: 'add' } | { kind: 'edit'; id: string } | null;

export interface ScheduleStart {
  name: string;
  items: Item[];
  days: readonly string[];
  day: string;
  manage: boolean;
  panel: Panel;
  form: Form | null;
  pressed: boolean;
  limit: boolean;
  conflict: Item | null;
  asking: boolean;
  deleted: Item | null;
  unrestored: string | null;
  picking: boolean;
  failed: Failure | null;
  focus: Field | 'limit' | 'conflict' | 'ask' | 'failed' | 'course' | 'move' | null;
  screens: ScreensStart | null;
  courses: Course[];
  menuRead: boolean;
  courseOpen: boolean;
  moveTo: string | null;
  unlinked: string | null;
}

/** Where Show on a screen opens (sc-3897). */
export type ScreensStart =
  'list' | 'replace' | 'replaced' | 'refused' | 'loading' | 'failed' | 'replaceFailed';

const FRIDAY = DAYS[1];

function start(over: Partial<ScheduleStart> & { name: string }): ScheduleStart {
  return {
    items: sampleItems(),
    days: DAYS,
    day: FRIDAY,
    manage: true,
    panel: null,
    form: null,
    pressed: false,
    limit: false,
    conflict: null,
    asking: false,
    deleted: null,
    unrestored: null,
    picking: false,
    failed: null,
    focus: null,
    screens: null,
    courses: sampleCourses(),
    menuRead: true,
    courseOpen: false,
    moveTo: null,
    unlinked: null,
    ...over,
  };
}

const speeches = (): Item => sampleItems().find((one) => one.id === 'speeches') as Item;

/** One word wider than the page can give it: the Owner field takes 120 characters (sc-63743). */
function ownedBy(owner: string, name: string): ScheduleStart {
  const items = sampleItems().map((one) => (one.id === 'seated' ? { ...one, owner } : one));
  const seated = items.find((one) => one.id === 'seated') as Item;

  return start({ name, items, panel: { kind: 'edit', id: 'seated' }, form: formOf(seated) });
}

const lateFood = (items: readonly Item[]): Item => items.find((one) => one.id === 'late') as Item;

function editingLate(over: Partial<ScheduleStart> & { name: string }): ScheduleStart {
  const items = over.items ?? linkedItems();

  return start({
    items,
    panel: { kind: 'edit', id: 'late' },
    form: formOf(lateFood(items)),
    ...over,
  });
}

const LONG_FR = 'Plat principal : filet de bœuf, purée de patates douces et sauce au poivre';
const LONG_PT = 'Prato principal: filé ao molho de pimenta com purê de batata-doce e farofa';

function longCourse(name: string, label: string): ScheduleStart {
  return start({
    name: label,
    items: linkedItems(),
    courses: sampleCourses().map((one) => (one.id === 'k2' ? { ...one, name } : one)),
  });
}

const STATES = {
  populated: () => start({ name: 'Friday, three places' }),
  onePlace: () => start({ name: 'Thursday, one place, headed Main', day: DAYS[0] }),
  emptyDay: () => start({ name: 'Saturday, a day with no items', day: DAYS[2] }),
  empty: () => start({ name: 'Nothing scheduled yet', items: [] }),
  addBlank: () =>
    start({
      name: 'Add item, Save pressed with nothing filled in',
      panel: { kind: 'add' },
      form: blankForm(FRIDAY),
      pressed: true,
      focus: 'title',
    }),
  startOutside: () =>
    start({
      name: 'Add item, a start outside the event',
      panel: { kind: 'add' },
      form: {
        ...blankForm(DAYS[2]),
        title: 'Fireworks',
        time: '22:00',
        lasts: '15',
        place: 'Garden',
      },
      pressed: true,
      focus: 'date',
    }),
  tooLong: () =>
    start({
      name: 'Add item, too long in four fields',
      panel: { kind: 'add' },
      form: {
        ...blankForm(FRIDAY),
        title:
          'Cutting of the cake, with the couple’s families on the stage and the band playing the song both mothers chose',
        time: '21:00',
        lasts: '800',
        owner: 'Kemi Adebayo',
        role: 'Master of ceremonies for the whole evening',
        note: 'Ask the band for the song. '.repeat(20).trim(),
      },
      pressed: true,
      focus: 'lasts',
    }),
  editing: () =>
    start({
      name: 'Editing Speeches, the row tinted',
      panel: { kind: 'edit', id: 'speeches' },
      form: formOf(speeches()),
    }),
  ownerHyphenLong: () =>
    ownedBy(
      'Oluwadamilareoluwatobiloba-Adekunleogundipeadeyemi',
      'Editing Guests seated, an owner one long hyphenated word',
    ),
  ownerOneWord: () =>
    ownedBy(
      'Oluwadamilareoluwatobilobaadekunleogundipeadeyemi',
      'Editing Guests seated, an owner one long word with no hyphen',
    ),
  placeMoved: () =>
    start({
      name: 'Editing, Place changed to another table',
      panel: { kind: 'edit', id: 'speeches' },
      form: { ...formOf(speeches()), place: 'Garden' },
    }),
  newPlace: () =>
    start({
      name: 'Add item, a new place typed',
      panel: { kind: 'add' },
      form: { ...blankForm(FRIDAY), title: 'Sparkler send-off', time: '23:30', place: 'Terrace' },
    }),
  conflict: () =>
    start({
      name: 'Someone else changed it, 412',
      panel: { kind: 'edit', id: 'speeches' },
      form: { ...formOf(speeches()), title: 'Speeches and toasts' },
      conflict: THEIRS,
      focus: 'conflict',
    }),
  deleteConfirm: () =>
    start({
      name: 'Delete item, asking',
      panel: { kind: 'edit', id: 'speeches' },
      form: formOf(speeches()),
      asking: true,
      focus: 'ask',
    }),
  undo: () =>
    start({
      name: 'Deleted, with Undo for 10 seconds',
      items: sampleItems().filter((one) => one.id !== 'speeches'),
      deleted: speeches(),
    }),
  saveFailed: () =>
    start({
      name: 'Save failed on the network',
      panel: { kind: 'edit', id: 'speeches' },
      form: { ...formOf(speeches()), title: 'Speeches and toasts' },
      failed: 'save',
      focus: 'failed',
    }),
  deleteFailed: () =>
    start({
      name: 'Delete failed on the network',
      panel: { kind: 'edit', id: 'speeches' },
      form: formOf(speeches()),
      failed: 'delete',
      focus: 'failed',
    }),
  undoFailed: () =>
    start({
      name: 'Undo failed, the item stays deleted',
      items: sampleItems().filter((one) => one.id !== 'speeches'),
      unrestored: speeches().title,
      failed: 'undo',
      focus: 'failed',
    }),
  gone: () =>
    start({
      name: 'Someone else deleted it, 404 on Save',
      items: sampleItems().filter((one) => one.id !== 'speeches'),
      panel: { kind: 'edit', id: 'speeches' },
      form: { ...formOf(speeches()), title: 'Speeches and toasts' },
      failed: 'gone',
      focus: 'failed',
    }),
  atLimit: () =>
    start({
      name: 'Add item when the event holds 200',
      items: atLimit(),
      panel: { kind: 'add' },
      form: { ...blankForm(FRIDAY), title: 'Fireworks', time: '23:00', place: 'Garden' },
      limit: true,
      focus: 'limit',
    }),
  readOnly: () => start({ name: 'Read only, without run_of_show.manage', manage: false }),
  courseEmpty: () => editingLate({ name: 'Editing Late food, Course empty: No course' }),
  coursePicker: () =>
    editingLate({
      name: 'The course list open, in menu order, two linked elsewhere',
      courseOpen: true,
      focus: 'course',
    }),
  courseMove: () =>
    editingLate({
      name: 'Main chosen, linked to Mains go out: asking before the link moves',
      moveTo: 'k2',
      focus: 'move',
    }),
  courseMoving: () => {
    const items = linkedItems();
    return editingLate({
      name: 'Move the link pressed: Main waits for Save',
      items,
      form: { ...formOf(lateFood(items)), course: 'k2' },
    });
  },
  courseLinked: () =>
    start({ name: 'Linked items: the course beside the title', items: linkedItems() }),
  courseNone: () =>
    editingLate({
      name: 'No courses on the menu: the list points to the Menu page',
      items: sampleItems(),
      courses: [],
      courseOpen: true,
      focus: 'course',
    }),
  courseRefused: () =>
    editingLate({
      name: 'Without menu.read: no Course field, the rest as before',
      menuRead: false,
    }),
  courseUnlinked: () =>
    start({
      name: 'Main removed from the menu: Mains go out no longer linked',
      items: linkedItems().map((one) => (one.id === 'mains' ? { ...one, course: null } : one)),
      courses: sampleCourses().filter((one) => one.id !== 'k2'),
      unlinked: 'Mains go out',
    }),
  courseLongFr: () => longCourse(LONG_FR, 'A long course name, cut short on the row, in fr-FR'),
  courseLongPt: () => longCourse(LONG_PT, 'A long course name, cut short on the row, in pt-BR'),
  sevenDays: () =>
    start({
      name: 'Seven days, the tabs wrap to a second row',
      items: sevenDayItems(),
      days: SEVEN_DAYS,
    }),
  placePicker: () => start({ name: 'The place picker open (at 40rem and under)', picking: true }),
  formPage: () =>
    start({
      name: 'The form as its own page (at 40rem and under)',
      panel: { kind: 'edit', id: 'speeches' },
      form: formOf(speeches()),
    }),
  screens: () => start({ name: 'Show on a screen: a link for each place', screens: 'list' }),
  screensReplace: () =>
    start({ name: 'Replace link, asking first in the row', screens: 'replace' }),
  screensReplaced: () => start({ name: 'The Ballroom’s link replaced', screens: 'replaced' }),
  screensRefused: () =>
    start({ name: 'Copy refused by the browser: the link selected', screens: 'refused' }),
  screensLoading: () =>
    start({ name: 'The links loading: three rows held at their height', screens: 'loading' }),
  screensFailed: () => start({ name: 'The links did not load, with Try again', screens: 'failed' }),
  screensReplaceFailed: () =>
    start({ name: 'Replace link failed: the old link kept', screens: 'replaceFailed' }),
} satisfies Record<string, () => ScheduleStart>;

export type ScheduleStateName = keyof typeof STATES;

export const SCHEDULE_STATES = Object.keys(STATES) as ScheduleStateName[];

export function scheduleStart(raw: string | null): ScheduleStart {
  const name: ScheduleStateName =
    raw != null && Object.hasOwn(STATES, raw) ? (raw as ScheduleStateName) : 'populated';

  return STATES[name]();
}

const LOCALES = ['en-GB', 'en-US', 'fr-FR', 'es-ES', 'pt-BR'] as const;

export function readerOf(locale: string | null, zone: string | null): Reader {
  return {
    locale: LOCALES.find((one) => one === locale) ?? HOME_READER.locale,
    zone: zone === 'away' ? 'America/New_York' : EVENT_ZONE,
  };
}

export function scheduleAt(state?: ScheduleStateName, extra = ''): string {
  const query = [state == null ? null : `state=${state}`, extra === '' ? null : extra]
    .filter(Boolean)
    .join('&');

  return `/demo/events/${SCHEDULE_EVENT}/schedule${query === '' ? '' : `?${query}`}`;
}

function link(state: ScheduleStateName): DemoLink {
  return { to: scheduleAt(state), name: STATES[state]().name };
}

export const SCHEDULE_PAGES: readonly { name: string; states: readonly DemoLink[] }[] = [
  {
    name: 'The page: day tabs, a table per place, empty',
    states: (['populated', 'onePlace', 'emptyDay', 'empty', 'readOnly'] as const).map(link),
  },
  {
    name: 'The item form and its refusals',
    states: (
      [
        'addBlank',
        'startOutside',
        'tooLong',
        'editing',
        'ownerHyphenLong',
        'ownerOneWord',
        'placeMoved',
        'newPlace',
        'atLimit',
      ] as const
    ).map(link),
  },
  {
    name: 'Course, a menu course linked to an item (sc-3898)',
    states: [
      ...(
        [
          'courseEmpty',
          'coursePicker',
          'courseMove',
          'courseMoving',
          'courseLinked',
          'courseNone',
          'courseRefused',
          'courseUnlinked',
        ] as const
      ).map(link),
      { to: scheduleAt('courseLongFr', 'locale=fr-FR'), name: STATES.courseLongFr().name },
      { to: scheduleAt('courseLongPt', 'locale=pt-BR'), name: STATES.courseLongPt().name },
      {
        to: scheduleAt('coursePicker'),
        name: 'The course list as a sheet at 40rem and under (narrow the window)',
      },
    ],
  },
  {
    name: 'Someone else’s change, delete and Undo',
    states: (['conflict', 'deleteConfirm', 'undo'] as const).map(link),
  },
  {
    name: 'When the network or someone else gets in the way',
    states: (['saveFailed', 'deleteFailed', 'undoFailed', 'gone'] as const).map(link),
  },
  {
    name: 'Show on a screen, the room screen’s links (sc-3897)',
    states: (
      [
        'screens',
        'screensReplace',
        'screensReplaced',
        'screensRefused',
        'screensLoading',
        'screensFailed',
        'screensReplaceFailed',
      ] as const
    ).map(link),
  },
  {
    name: 'At 40rem and under (narrow the window)',
    states: (['placePicker', 'formPage'] as const).map(link),
  },
  {
    name: 'The day tabs keep their words whole, from 375 to 1440 (sc-64803)',
    states: [
      { to: scheduleAt('populated', 'locale=fr-FR'), name: 'Three days, read in fr-FR' },
      { to: scheduleAt('editing', 'locale=fr-FR'), name: 'Three days, Edit item open, in fr-FR' },
      { to: scheduleAt('populated', 'locale=es-ES'), name: 'Three days, read in es-ES' },
      { to: scheduleAt('populated', 'locale=pt-BR'), name: 'Three days, read in pt-BR' },
      { to: scheduleAt('sevenDays'), name: STATES.sevenDays().name },
      { to: scheduleAt('sevenDays', 'locale=fr-FR'), name: 'Seven days, read in fr-FR' },
    ],
  },
  {
    name: 'Times in the reader’s locale and zone',
    states: [
      { to: scheduleAt('populated', 'locale=en-US'), name: 'Read in en-US' },
      { to: scheduleAt('populated', 'locale=fr-FR'), name: 'Read in fr-FR' },
      { to: scheduleAt('populated', 'zone=away'), name: 'The reader in New York, the zone named' },
      { to: scheduleAt('addBlank', 'zone=away'), name: 'The form, the reader in New York' },
    ],
  },
];

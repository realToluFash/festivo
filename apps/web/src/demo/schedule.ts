import { writtenTime } from './clock.ts';
import type { DemoLink } from './settings.ts';

/** The event's Schedule page (sc-3893, RunOfShow.dc.html on page e33): a table per place for each event day, and the item form. */
export const SCHEDULE_EVENT = 'evt-wed-4';
export const EVENT_ZONE = 'Europe/London';
export const EARLIEST = '2026-11-05T06:00';
export const LATEST = '2026-11-07T15:00';
export const DAYS = ['2026-11-05', '2026-11-06', '2026-11-07'] as const;
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
  ...extra,
});

export function sampleItems(): Item[] {
  return [
    item('drinks', 'Welcome drinks', '2026-11-05T18:00', 120, null, 'Ebele Nwosu', 'Venue', {
      guests: true,
    }),
    item('families', 'The families meet', '2026-11-05T20:00', 60, null, 'Ngozi Obi', 'Aunt'),
    item('seated', 'Guests seated', '2026-11-06T13:30', 30, null, 'Ebele Nwosu', 'Venue'),
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
  };
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
  focus: Field | 'limit' | 'conflict' | 'ask' | 'failed' | null;
  screens: 'list' | 'replace' | 'replaced' | null;
}

const FRIDAY = DAYS[1];

function start(over: Partial<ScheduleStart> & { name: string }): ScheduleStart {
  return {
    items: sampleItems(),
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
    ...over,
  };
}

const speeches = (): Item => sampleItems().find((one) => one.id === 'speeches') as Item;

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
        'placeMoved',
        'newPlace',
        'atLimit',
      ] as const
    ).map(link),
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
    states: (['screens', 'screensReplace', 'screensReplaced'] as const).map(link),
  },
  {
    name: 'At 40rem and under (narrow the window)',
    states: (['placePicker', 'formPage'] as const).map(link),
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

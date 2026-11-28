import {
  SCHEDULE_LENGTH_MAXIMUM,
  SCHEDULE_NOTE_MAXIMUM,
  SCHEDULE_OWNER_MAXIMUM,
  SCHEDULE_ROLE_MAXIMUM,
  SCHEDULE_TITLE_MAXIMUM,
  type MenuCourse,
  type Schedule,
  type ScheduleItem,
  type ScheduleItemDetails,
} from '@soirely/api-client';
import {
  eventDayOf,
  eventDaysBetween,
  formatWallClock,
  wallOfZoned,
  wallPlusMinutes,
  visibleLength,
} from '@soirely/domain';
import type { TFunction } from 'i18next';

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
  /** The menu course this item is (sc-3898), by its id; null when none. */
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

export const API_FIELDS: Record<string, Field> = {
  title: 'title',
  startsAt: 'date',
  lengthMinutes: 'lasts',
  ownerName: 'owner',
  ownerRole: 'role',
  note: 'note',
};

export interface Reader {
  locale: string;
  zone: string;
}

export function startOf(one: ScheduleItem): string {
  return wallOfZoned(one.startsAt);
}

export function endOf(one: ScheduleItem): string {
  return wallPlusMinutes(startOf(one), one.lengthMinutes ?? 0);
}

/** An item with no place sits under Main, which is a word on the page and never stored. */
export function placeOf(one: ScheduleItem, main: string): string {
  return one.place ?? main;
}

const byStart = (a: ScheduleItem, b: ScheduleItem): number => {
  const one = startOf(a);
  const other = startOf(b);

  return one === other ? a.title.localeCompare(b.title) : one < other ? -1 : 1;
};

export function itemsOn(items: readonly ScheduleItem[], day: string): ScheduleItem[] {
  return items.filter((one) => one.day === day).sort(byStart);
}

export interface Table {
  place: string;
  items: ScheduleItem[];
}

export function tablesOn(items: readonly ScheduleItem[], day: string, main: string): Table[] {
  const tables = new Map<string, ScheduleItem[]>();
  for (const one of itemsOn(items, day)) {
    const place = placeOf(one, main);
    tables.set(place, [...(tables.get(place) ?? []), one]);
  }

  return [...tables.entries()]
    .map(([place, rows]) => ({ place, items: rows }))
    .sort((a, b) => byStart(a.items[0] as ScheduleItem, b.items[0] as ScheduleItem));
}

export function placesOn(items: readonly ScheduleItem[], day: string, main: string): string[] {
  return tablesOn(items, day, main).map((table) => table.place);
}

/** A tab for every event day the event spans, and any day an item already sits on outside them. */
export function daysOf(eventStartsAt: string, schedule: Schedule): string[] {
  const first = eventDayOf(wallOfZoned(eventStartsAt));
  const last = eventDayOf(wallOfZoned(schedule.latest));
  const spanned = first <= last ? eventDaysBetween(first, last) : [first];

  return [...new Set([...spanned, ...schedule.items.map((one) => one.day)])].sort();
}

/** A typed place as stored: blank or Main is none, and a name matching one of the day's in any case is that one. */
export function placeKey(typed: string, known: readonly string[], main: string): string | null {
  const trimmed = typed.trim();
  if (trimmed === '' || trimmed.toLowerCase() === main.toLowerCase()) return null;

  return known.find((one) => one.toLowerCase() === trimmed.toLowerCase()) ?? trimmed;
}

export function formPlaces(items: readonly ScheduleItem[], form: Form, main: string): string[] {
  if (form.date === '') return [];
  const day = eventDayOf(`${form.date}T${form.time === '' ? '12:00' : form.time}`);

  return placesOn(items, day, main);
}

export function timeOf(wall: string, reader: Reader): string {
  return formatWallClock(wall, reader.locale);
}

export function dayName(day: string, reader: Reader): string {
  return new Intl.DateTimeFormat(reader.locale, {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(`${day}T12:00:00Z`));
}

export function dayAndTime(wall: string, reader: Reader, t: TFunction): string {
  return t('schedule.dayAndTime', {
    day: dayName(wall.slice(0, 10), reader),
    time: timeOf(wall, reader),
  });
}

/** A start after midnight carries its weekday, since it sits on the tab of the day before. */
export function startsCell(one: ScheduleItem, reader: Reader, t: TFunction): string {
  const wall = startOf(one);
  if (wall.slice(0, 10) === one.day) return timeOf(wall, reader);
  const weekday = new Intl.DateTimeFormat(reader.locale, {
    timeZone: 'UTC',
    weekday: 'short',
  }).format(new Date(`${wall.slice(0, 10)}T12:00:00Z`));

  return t('schedule.weekdayAndTime', { weekday, time: timeOf(wall, reader) });
}

export function zoneNamed(timeZone: string, reader: Reader, at: string): string | null {
  if (reader.zone === timeZone) return null;
  const part = new Intl.DateTimeFormat(reader.locale, {
    timeZone,
    timeZoneName: 'longGeneric',
  })
    .formatToParts(new Date(at))
    .find((one) => one.type === 'timeZoneName');

  return part?.value ?? timeZone;
}

export function headingLine(
  schedule: Schedule,
  day: string,
  reader: Reader,
  main: string,
  t: TFunction,
): string | null {
  const rows = itemsOn(schedule.items, day);
  if (rows.length === 0) return null;
  const first = startOf(rows[0] as ScheduleItem);
  const last = rows.map(endOf).sort().at(-1) as string;
  const places = placesOn(schedule.items, day, main).length;
  const zone = zoneNamed(schedule.timeZone, reader, (rows[0] as ScheduleItem).startsAt);

  return [
    t('schedule.items', { count: rows.length }),
    t('schedule.span', { first: timeOf(first, reader), last: timeOf(last, reader) }),
    t('schedule.places', { count: places }),
    ...(zone == null ? [] : [zone]),
  ].join(' · ');
}

export function lastsCell(lengthMinutes: number | null, t: TFunction): string {
  return lengthMinutes == null
    ? t('schedule.noLength')
    : t('schedule.minutes', { count: lengthMinutes });
}

export function underLine(one: ScheduleItem, t: TFunction): string {
  return [
    one.lengthMinutes == null ? null : t('schedule.minutes', { count: one.lengthMinutes }),
    one.ownerRole,
    one.ownerName ?? t('schedule.noOwner'),
  ]
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

export function formOf(one: ScheduleItem): Form {
  const wall = startOf(one);

  return {
    title: one.title,
    date: wall.slice(0, 10),
    time: wall.slice(11, 16),
    lasts: one.lengthMinutes == null ? '' : String(one.lengthMinutes),
    place: one.place ?? '',
    owner: one.ownerName ?? '',
    role: one.ownerRole ?? '',
    note: one.note ?? '',
    fixed: one.fixedTime,
    guests: one.showToGuests,
    course: one.course?.id ?? null,
  };
}

const blankToNull = (typed: string): string | null => (typed.trim() === '' ? null : typed.trim());

/** `withCourse` is whether this reader can see the menu: only then is Course sent, so a save without it keeps the item's link (sc-3898). */
export function detailsOf(
  form: Form,
  known: readonly string[],
  main: string,
  withCourse = false,
): ScheduleItemDetails {
  return {
    title: form.title.trim(),
    startsAt: `${form.date}T${form.time}`,
    lengthMinutes: form.lasts.trim() === '' ? null : Number(form.lasts),
    place: placeKey(form.place, known, main),
    ownerName: blankToNull(form.owner),
    ownerRole: blankToNull(form.role),
    note: blankToNull(form.note),
    fixedTime: form.fixed,
    showToGuests: form.guests,
    ...(withCourse ? { courseId: form.course } : {}),
  };
}

export function detailsOfItem(one: ScheduleItem): ScheduleItemDetails {
  return {
    title: one.title,
    startsAt: startOf(one),
    lengthMinutes: one.lengthMinutes,
    place: one.place,
    ownerName: one.ownerName,
    ownerRole: one.ownerRole,
    note: one.note,
    fixedTime: one.fixedTime,
    showToGuests: one.showToGuests,
  };
}

export function windowLine(schedule: Schedule, reader: Reader, t: TFunction): string {
  return t('schedule.window', {
    earliest: dayAndTime(wallOfZoned(schedule.earliest), reader, t),
    end: dayAndTime(wallOfZoned(schedule.latest), reader, t),
  });
}

export function check(form: Form, schedule: Schedule, reader: Reader, t: TFunction): Errors {
  const errors: Errors = {};
  const title = form.title.trim();
  if (title === '') errors.title = t('schedule.blankTitle');
  else if (visibleLength(title) > SCHEDULE_TITLE_MAXIMUM)
    errors.title = t('schedule.longTitle', {
      n: visibleLength(title),
      max: SCHEDULE_TITLE_MAXIMUM,
    });

  if (form.date === '') errors.date = t('schedule.noStart');
  else if (form.time === '') errors.time = t('schedule.noStart');
  else {
    const starts = `${form.date}T${form.time}`;
    if (starts < wallOfZoned(schedule.earliest) || starts > wallOfZoned(schedule.latest))
      errors.date = windowLine(schedule, reader, t);
  }

  const lasts = form.lasts.trim();
  if (lasts !== '' && !(/^\d+$/.test(lasts) && Number(lasts) <= SCHEDULE_LENGTH_MAXIMUM))
    errors.lasts = t('schedule.badLength', { max: SCHEDULE_LENGTH_MAXIMUM });

  const owner = form.owner.trim();
  if (visibleLength(owner) > SCHEDULE_OWNER_MAXIMUM)
    errors.owner = t('schedule.longOwner', {
      n: visibleLength(owner),
      max: SCHEDULE_OWNER_MAXIMUM,
    });
  const role = form.role.trim();
  if (visibleLength(role) > SCHEDULE_ROLE_MAXIMUM)
    errors.role = t('schedule.longRole', { n: visibleLength(role), max: SCHEDULE_ROLE_MAXIMUM });
  if (visibleLength(form.note) > SCHEDULE_NOTE_MAXIMUM)
    errors.note = t('schedule.longNote', {
      n: visibleLength(form.note),
      max: SCHEDULE_NOTE_MAXIMUM,
    });

  return errors;
}

export function firstWrong(errors: Errors): Field | null {
  return FIELD_ORDER.find((field) => errors[field] != null) ?? null;
}

export function lastsHelp(form: Form, reader: Reader, t: TFunction): string | null {
  const lasts = form.lasts.trim();
  if (lasts === '') return t('schedule.runsOn');
  if (form.date === '' || form.time === '' || !/^\d+$/.test(lasts)) return null;
  if (Number(lasts) > SCHEDULE_LENGTH_MAXIMUM) return null;

  return t('schedule.endsAt', {
    time: timeOf(wallPlusMinutes(`${form.date}T${form.time}`, Number(lasts)), reader),
  });
}

export function placeHelp(
  items: readonly ScheduleItem[],
  form: Form,
  editing: ScheduleItem | null,
  main: string,
  t: TFunction,
): string | null {
  const known = formPlaces(items, form, main);
  const typed = placeKey(form.place, known, main);
  if (typed != null && !known.includes(typed)) return t('schedule.newPlace', { name: typed });
  if (editing != null && typed !== editing.place)
    return t('schedule.moves', { place: typed ?? main });

  return null;
}

export interface Difference {
  field: string;
  theirs: string;
  yours: string;
}

export function differences(
  theirs: ScheduleItem,
  yours: Form,
  reader: Reader,
  main: string,
  t: TFunction,
): Difference[] {
  const mine = detailsOf(yours, [], main);
  const onOff = (on: boolean): string => t(on ? 'schedule.on' : 'schedule.off');
  const rows: [string, string, string][] = [
    [t('schedule.titleLabel'), theirs.title, mine.title],
    [
      t('schedule.starts'),
      dayAndTime(startOf(theirs), reader, t),
      dayAndTime(mine.startsAt, reader, t),
    ],
    [
      t('schedule.lasts'),
      lastsCell(theirs.lengthMinutes, t),
      lastsCell(Number.isNaN(mine.lengthMinutes) ? null : mine.lengthMinutes, t),
    ],
    [t('schedule.place'), theirs.place ?? main, mine.place ?? main],
    [
      t('schedule.ownerLabel'),
      theirs.ownerName ?? t('schedule.noOwner'),
      mine.ownerName ?? t('schedule.noOwner'),
    ],
    [t('schedule.role'), theirs.ownerRole ?? '', mine.ownerRole ?? ''],
    [t('schedule.note'), theirs.note ?? '', mine.note ?? ''],
    [t('schedule.fixed'), onOff(theirs.fixedTime), onOff(mine.fixedTime)],
    [t('schedule.showToGuests'), onOff(theirs.showToGuests), onOff(mine.showToGuests)],
  ];

  return rows
    .filter(([, a, b]) => a !== b)
    .map(([field, a, b]) => ({ field, theirs: a, yours: b }));
}

/** The item holding a course, other than the one being edited. */
export function holderOf(
  courseId: string,
  items: readonly ScheduleItem[],
  editingId: string | null,
): ScheduleItem | null {
  return items.find((one) => one.course?.id === courseId && one.id !== editingId) ?? null;
}

/** A course's secondary line in the list: "served 20:30", and " · linked to {item}" while another item holds it (sc-3898). A linked course is served at its item's start, and for the item being edited at the start on its form, as the Menu page writes times. */
export function courseLine(
  course: MenuCourse,
  items: readonly ScheduleItem[],
  editingId: string | null,
  formTime: string,
  t: TFunction,
): string | null {
  const holder = holderOf(course.id, items, editingId);
  const linked = items.find((one) => one.course?.id === course.id);
  const served =
    linked == null
      ? course.servedAt
      : linked.id === editingId && formTime !== ''
        ? formTime
        : startOf(linked).slice(11, 16);

  return (
    [
      served == null ? null : t('schedule.served', { time: served }),
      holder == null ? null : t('schedule.linkedTo', { title: holder.title }),
    ]
      .filter((part): part is string => part != null)
      .join(' · ') || null
  );
}

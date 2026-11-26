import { type ShiftClockCard, asShiftClockCard } from './shiftHours.ts';

/** A person's own night (sc-3915): what their page shows, and nothing about anybody else beyond their lead. Times are in the event's offset. Past access (sc-234) it carries the event's name and the clock card alone: no station, shift, lead, timing or tables. */
export interface MyNight {
  /** Past the person's access, still clocked in: the page is the clock card alone, until `endsAt`. */
  pastAccess: boolean;
  /** Their shift's clock card (sc-234); null once it is gone. */
  clock: ShiftClockCard | null;
  event: { name: string; timeZone: string };
  /** The link's end, when the browser is signed out. */
  endsAt: string;
  station: string | null;
  job: string | null;
  shift: { job: string; startsAt: string; endsAt: string } | null;
  later: { job: string; startsAt: string } | null;
  /** Their station's lead, else the floor lead (`floor`); `phone` in E.164. */
  lead: { name: string; phone: string | null; floor: boolean } | null;
  timing: MyNightMoment[];
  doorsAt: string;
  /** Null with no section station; empty until doors open. */
  tables: MyNightTable[] | null;
}

export interface MyNightMoment {
  at: string;
  title: string;
  for: 'staff' | 'guests';
}

export interface MyNightTable {
  name: string;
  guests: MyNightGuest[];
}

/** A name and dietary needs alone: never a contact detail. */
export interface MyNightGuest {
  name: string;
  allergens: string[];
  diets: string[];
  otherAllergy: string | null;
  otherDiet: string | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value != null && !Array.isArray(value);
}

const text = (value: unknown): value is string | null =>
  value === null || typeof value === 'string';

const strings = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((one) => typeof one === 'string');

function every<T>(raw: unknown, read: (one: unknown) => T | null): T[] | null {
  if (!Array.isArray(raw)) return null;
  const rows = raw.map(read);

  return rows.every((row) => row != null) ? (rows as T[]) : null;
}

function asMoment(raw: unknown): MyNightMoment | null {
  if (!isRecord(raw)) return null;
  const { at, title, for: audience } = raw;

  return typeof at === 'string' &&
    typeof title === 'string' &&
    (audience === 'staff' || audience === 'guests')
    ? { at, title, for: audience }
    : null;
}

function asGuest(raw: unknown): MyNightGuest | null {
  if (!isRecord(raw)) return null;
  const { name, allergens, diets, otherAllergy, otherDiet } = raw;

  return typeof name === 'string' &&
    strings(allergens) &&
    strings(diets) &&
    text(otherAllergy) &&
    text(otherDiet)
    ? { name, allergens, diets, otherAllergy, otherDiet }
    : null;
}

function asTable(raw: unknown): MyNightTable | null {
  if (!isRecord(raw) || typeof raw.name !== 'string') return null;
  const guests = every(raw.guests, asGuest);

  return guests == null ? null : { name: raw.name, guests };
}

function asShift(raw: unknown): MyNight['shift'] | undefined {
  if (raw === null) return null;
  if (!isRecord(raw)) return undefined;
  const { job, startsAt, endsAt } = raw;

  return typeof job === 'string' && typeof startsAt === 'string' && typeof endsAt === 'string'
    ? { job, startsAt, endsAt }
    : undefined;
}

function asLater(raw: unknown): MyNight['later'] | undefined {
  if (raw === null) return null;
  if (!isRecord(raw)) return undefined;
  const { job, startsAt } = raw;

  return typeof job === 'string' && typeof startsAt === 'string' ? { job, startsAt } : undefined;
}

function asLead(raw: unknown): MyNight['lead'] | undefined {
  if (raw === null) return null;
  if (!isRecord(raw)) return undefined;
  const { name, phone, floor } = raw;

  return typeof name === 'string' && text(phone) && typeof floor === 'boolean'
    ? { name, phone, floor }
    : undefined;
}

/** The night, or null when it is not one this client knows. */
export function asMyNight(raw: unknown): MyNight | null {
  if (!isRecord(raw) || !isRecord(raw.event)) return null;
  const { name, timeZone } = raw.event;
  const { endsAt, station, job, doorsAt } = raw;
  const shift = asShift(raw.shift);
  const later = asLater(raw.later);
  const lead = asLead(raw.lead);
  const timing = every(raw.timing, asMoment);
  const tables = raw.tables === null ? null : every(raw.tables, asTable);
  const clock = raw.clock === null ? null : asShiftClockCard(raw.clock);

  if (
    typeof name !== 'string' ||
    typeof timeZone !== 'string' ||
    typeof endsAt !== 'string' ||
    typeof doorsAt !== 'string' ||
    !text(station) ||
    !text(job) ||
    shift === undefined ||
    later === undefined ||
    lead === undefined ||
    timing == null ||
    (raw.tables !== null && tables == null) ||
    typeof raw.pastAccess !== 'boolean' ||
    (raw.clock !== null && clock == null)
  )
    return null;

  return {
    pastAccess: raw.pastAccess,
    clock,
    event: { name, timeZone },
    endsAt,
    station,
    job,
    shift,
    later,
    lead,
    timing,
    doorsAt,
    tables,
  };
}

import type { components } from './schema.d.ts';

/** An event's seating plan as the API answers and the hub publishes it (sc-3998, sc-4000, sc-4003). */

export const SECTION_COLOURS = [
  'blue',
  'purple',
  'plum',
  'wine',
  'rose',
  'brown',
  'olive',
  'teal',
] as const;

export type SectionColour = (typeof SECTION_COLOURS)[number];

export type MeasurementSystem = 'metric' | 'us';

/** Generated from the API's App\Enum\TableShape: a fifth spelling fails here, not on a drawing. */
export type TableShape = components['schemas']['TableShape'];

export const TABLE_SHAPES = [
  'round',
  'rectangular',
  'head',
  'cocktail',
] as const satisfies readonly TableShape[];

type EveryShapeListed =
  Exclude<TableShape, (typeof TABLE_SHAPES)[number]> extends never ? true : never;
const everyShapeListed: EveryShapeListed = true;
void everyShapeListed;

/** The API's TableShape::defaults(): a round or cocktail table's width and length are its diameter. */
export const TABLE_DEFAULTS: Record<
  TableShape,
  { widthCm: number; lengthCm: number; seats: number }
> = {
  round: { widthCm: 180, lengthCm: 180, seats: 10 },
  rectangular: { widthCm: 180, lengthCm: 76, seats: 6 },
  head: { widthCm: 240, lengthCm: 76, seats: 4 },
  cocktail: { widthCm: 60, lengthCm: 60, seats: 4 },
};

/** A guest in one of a place's chairs, by seat number from 1 (sc-4013). */
export interface SeatedGuest {
  seat: number;
  guestId: string;
}

export type SeatingPlaceKind = 'table' | 'row' | 'seat';

/** A chair: a table's, a row's or a single seat's (always seat 1). */
export interface SeatingChair {
  kind: SeatingPlaceKind;
  id: string;
  seat: number;
}

export type SeatingReply = 'noReply' | 'coming' | 'maybe';

/** A guest who may be seated: never Not coming or off the list; a companion's reply is their lead's, and `fullName` is null for a companion with no name yet. */
export interface SeatingGuest {
  id: string;
  fullName: string | null;
  leadId: string | null;
  position: number;
  reply: SeatingReply;
  groupId: string | null;
  groupName: string | null;
  seat: SeatingChair | null;
}

/** One guest's move in a seating action: `from` and `to` are null for Without a seat. Sent back whole, they are its Undo. */
export interface SeatingMove {
  guestId: string;
  from: SeatingChair | null;
  to: SeatingChair | null;
}

export interface SeatingMoved {
  seating: Seating;
  moves: SeatingMove[];
  /** A party at a table with room but no run of neighbouring free chairs. */
  apart: boolean;
}

export interface SeatingTable {
  id: string;
  name: string;
  sectionId: string | null;
  shape: TableShape;
  seats: number;
  /** A round or cocktail table's diameter, as `lengthCm` is too. */
  widthCm: number;
  lengthCm: number;
  endSeats: number;
  rotation: number;
  /** The table's centre from the room's top left corner. */
  xCm: number;
  yCm: number;
  unusableSeats: number[];
  version: number;
  changedBy: string | null;
  seated: SeatedGuest[];
}

export interface SeatingTableChanges {
  name?: string;
  sectionId?: string | null;
  shape?: TableShape;
  seats?: number;
  widthCm?: number;
  lengthCm?: number;
  endSeats?: number;
  rotation?: number;
  unusableSeats?: number[];
}

/** One item in a Floor plan step: where it goes, and a table's or row's turn and a table's size (sc-5028). */
export interface SeatingArrangement {
  kind: 'table' | 'row' | 'seat';
  id: string;
  version: number;
  xCm: number;
  yCm: number;
  rotation?: number;
  widthCm?: number;
  lengthCm?: number;
}

/** A chosen item as a step names it: which one, and the version it was chosen at (sc-4717). */
export interface SeatingItemRef {
  kind: 'table' | 'row' | 'seat';
  id: string;
  version: number;
}

/** A deleted item put back by Undo, as the plan served it: a row's label as `name` (sc-4717). */
export interface SeatingRestoredItem {
  kind: 'table' | 'row' | 'seat';
  name: string;
  sectionId: string | null;
  xCm: number;
  yCm: number;
  shape?: TableShape;
  seats?: number;
  widthCm?: number;
  lengthCm?: number;
  endSeats?: number;
  rotation?: number;
  spacingCm?: number;
  unusableSeats?: number[];
  unusable?: boolean;
  /** Who the Delete freed from it, back in the chairs they had (sc-57680). */
  guests?: { guestId: string; seat: number }[];
}

/** The plan after a step that made items, and their ids to choose. */
export interface SeatingWithChosen {
  seating: Seating;
  chosen: string[];
}

/** A straight line of numbered seats: seat 1 on the left of a guest sitting in it and facing the front, its number staying with it as the row turns. */
export interface SeatingRow {
  id: string;
  label: string;
  sectionId: string | null;
  seats: number;
  /** Centre to centre. */
  spacingCm: number;
  rotation: number;
  /** The row's centre from the room's top left corner. */
  xCm: number;
  yCm: number;
  unusableSeats: number[];
  version: number;
  changedBy: string | null;
  seated: SeatedGuest[];
}

export interface SeatingRowChanges {
  label?: string;
  sectionId?: string | null;
  seats?: number;
  spacingCm?: number;
  rotation?: number;
  unusableSeats?: number[];
}

/** A seat that belongs to no table: a name as typed, and no number. */
export interface SingleSeat {
  id: string;
  name: string;
  sectionId: string | null;
  xCm: number;
  yCm: number;
  unusable: boolean;
  version: number;
  changedBy: string | null;
  seated: SeatedGuest[];
}

export interface SingleSeatChanges {
  name?: string;
  sectionId?: string | null;
  unusable?: boolean;
}

/** `seats` counts every chair at the tables, in the rows and the single seats. */
export interface SectionContents {
  tables: number;
  rows: number;
  singleSeats: number;
  seats: number;
}

export interface SeatingSection extends SectionContents {
  id: string;
  name: string;
  colour: SectionColour;
  version: number;
}

/** Whether guests see their table on their page, and the day to share by (sc-4022). */
export interface TableSharing {
  /** With the event zone's offset; null while guests see nothing about seating. */
  sharedAt: string | null;
  /** A day in the event's zone. */
  shareBy: string | null;
}

export interface SeatingPlan {
  id: string;
  roomName: string | null;
  widthCm: number;
  lengthCm: number;
  version: number;
  changedBy: string | null;
  sharing: TableSharing;
  sections: SeatingSection[];
  tables: SeatingTable[];
  rows: SeatingRow[];
  singleSeats: SingleSeat[];
  withoutSection: SectionContents;
  guests: SeatingGuest[];
  counts: {
    sections: number;
    tables: number;
    rows: number;
    singleSeats: number;
    seatedGuests: number;
  };
}

export interface Seating {
  measurementSystem: MeasurementSystem;
  plan: SeatingPlan | null;
}

export interface SeatingRoom {
  roomName?: string | null;
  widthCm?: number;
  lengthCm?: number;
}

const SECTION_NAME_MAXIMUM = 40;
const SECTIONS_MAXIMUM = 30;
const ROOM_NAME_MAXIMUM = 60;

/** The API's SeatingPlan, SeatingSection, SeatingTable, SeatingRow and SeatingSeat limits, which the forms check before sending */
export const SEATING_LIMITS = {
  roomNameMaximum: ROOM_NAME_MAXIMUM,
  sectionNameMaximum: SECTION_NAME_MAXIMUM,
  sectionsMaximum: SECTIONS_MAXIMUM,
  tableNameMaximum: 30,
  tableSeatsMinimum: 1,
  tableSeatsMaximum: 30,
  tableSizeMinimumCm: 40,
  tableSizeMaximumCm: 1000,
  rotationStep: 15,
  rowLabelMaximum: 10,
  rowSeatsMinimum: 1,
  rowSeatsMaximum: 60,
  rowSpacingMinimumCm: 40,
  rowSpacingMaximumCm: 100,
  seatNameMaximum: 30,
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value != null && !Array.isArray(value);
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function asContents(raw: unknown): SectionContents | null {
  if (!isRecord(raw)) return null;
  const { tables, rows, singleSeats, seats } = raw;

  if (!isCount(tables) || !isCount(rows) || !isCount(singleSeats) || !isCount(seats)) return null;

  return { tables, rows, singleSeats, seats };
}

function asSection(raw: unknown): SeatingSection | null {
  if (!isRecord(raw)) return null;
  const { id, name, colour, version } = raw;
  const contents = asContents(raw);

  if (
    typeof id !== 'string' ||
    typeof name !== 'string' ||
    !(SECTION_COLOURS as readonly unknown[]).includes(colour) ||
    !isCount(version) ||
    contents == null
  )
    return null;

  return { id, name, colour: colour as SectionColour, version, ...contents };
}

function asTable(raw: unknown): SeatingTable | null {
  if (!isRecord(raw)) return null;
  const { id, name, sectionId, shape, seats, widthCm, lengthCm, endSeats, rotation, xCm, yCm } =
    raw;
  const { unusableSeats, version, changedBy } = raw;

  if (
    typeof id !== 'string' ||
    typeof name !== 'string' ||
    !(sectionId === null || typeof sectionId === 'string') ||
    !(TABLE_SHAPES as readonly unknown[]).includes(shape) ||
    !isCount(seats) ||
    !isCount(widthCm) ||
    !isCount(lengthCm) ||
    !isCount(endSeats) ||
    !isCount(rotation) ||
    !Number.isInteger(xCm) ||
    !Number.isInteger(yCm) ||
    !Array.isArray(unusableSeats) ||
    !unusableSeats.every(isCount) ||
    !isCount(version) ||
    !(changedBy === null || typeof changedBy === 'string')
  )
    return null;

  return {
    id,
    name,
    sectionId,
    shape: shape as TableShape,
    seats,
    widthCm,
    lengthCm,
    endSeats,
    rotation,
    xCm: xCm as number,
    yCm: yCm as number,
    unusableSeats: unusableSeats as number[],
    version,
    changedBy,
    seated: asSeated(raw.seated),
  };
}

function asRow(raw: unknown): SeatingRow | null {
  if (!isRecord(raw)) return null;
  const { id, label, sectionId, seats, spacingCm, rotation, xCm, yCm } = raw;
  const { unusableSeats, version, changedBy } = raw;

  if (
    typeof id !== 'string' ||
    typeof label !== 'string' ||
    !(sectionId === null || typeof sectionId === 'string') ||
    !isCount(seats) ||
    !isCount(spacingCm) ||
    !isCount(rotation) ||
    !Number.isInteger(xCm) ||
    !Number.isInteger(yCm) ||
    !Array.isArray(unusableSeats) ||
    !unusableSeats.every(isCount) ||
    !isCount(version) ||
    !(changedBy === null || typeof changedBy === 'string')
  )
    return null;

  return {
    id,
    label,
    sectionId,
    seats,
    spacingCm,
    rotation,
    xCm: xCm as number,
    yCm: yCm as number,
    unusableSeats: unusableSeats as number[],
    version,
    changedBy,
    seated: asSeated(raw.seated),
  };
}

function asSingleSeat(raw: unknown): SingleSeat | null {
  if (!isRecord(raw)) return null;
  const { id, name, sectionId, xCm, yCm, unusable, version, changedBy } = raw;

  if (
    typeof id !== 'string' ||
    typeof name !== 'string' ||
    !(sectionId === null || typeof sectionId === 'string') ||
    !Number.isInteger(xCm) ||
    !Number.isInteger(yCm) ||
    typeof unusable !== 'boolean' ||
    !isCount(version) ||
    !(changedBy === null || typeof changedBy === 'string')
  )
    return null;

  return {
    id,
    name,
    sectionId,
    xCm: xCm as number,
    yCm: yCm as number,
    unusable,
    version,
    changedBy,
    seated: asSeated(raw.seated),
  };
}

/** Who sits in a place's chairs; none when a plan predates seating. */
function asSeated(raw: unknown): SeatedGuest[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (one): one is SeatedGuest =>
      isRecord(one) && isCount(one.seat) && typeof one.guestId === 'string',
  );
}

function asChair(raw: unknown): SeatingChair | null {
  if (!isRecord(raw)) return null;
  const { kind, id, seat } = raw;
  if (
    (kind !== 'table' && kind !== 'row' && kind !== 'seat') ||
    typeof id !== 'string' ||
    !isCount(seat)
  )
    return null;
  return { kind, id, seat };
}

function asGuest(raw: unknown): SeatingGuest | null {
  if (!isRecord(raw)) return null;
  const { id, fullName, leadId, position, reply, groupId, groupName, seat } = raw;
  if (
    typeof id !== 'string' ||
    !(fullName === null || typeof fullName === 'string') ||
    !(leadId === null || typeof leadId === 'string') ||
    !isCount(position) ||
    (reply !== 'noReply' && reply !== 'coming' && reply !== 'maybe') ||
    !(groupId === null || typeof groupId === 'string') ||
    !(groupName === null || typeof groupName === 'string')
  )
    return null;
  return { id, fullName, leadId, position, reply, groupId, groupName, seat: asChair(seat) };
}

function asGuests(raw: unknown): SeatingGuest[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(asGuest).filter((one): one is SeatingGuest => one != null);
}

/** Null for anything but a seating action's answer. */
export function asSeatingMoved(raw: unknown): SeatingMoved | null {
  if (!isRecord(raw) || !Array.isArray(raw.moves)) return null;
  const seating = asSeating(raw.seating);
  const moves: SeatingMove[] = [];
  for (const one of raw.moves) {
    if (!isRecord(one) || typeof one.guestId !== 'string') return null;
    moves.push({ guestId: one.guestId, from: asChair(one.from), to: asChair(one.to) });
  }
  if (seating == null) return null;
  return { seating, moves, apart: raw.apart === true };
}

function asSharing(raw: unknown): TableSharing {
  if (!isRecord(raw)) return { sharedAt: null, shareBy: null };

  return {
    sharedAt: typeof raw.sharedAt === 'string' ? raw.sharedAt : null,
    shareBy: typeof raw.shareBy === 'string' ? raw.shareBy : null,
  };
}

function asPlan(raw: unknown): SeatingPlan | null {
  if (!isRecord(raw)) return null;
  const { id, roomName, widthCm, lengthCm, version, changedBy, sections, counts } = raw;
  const withoutSection = asContents(raw.withoutSection);
  const read = Array.isArray(sections) ? sections.map(asSection) : null;
  const tables = Array.isArray(raw.tables) ? raw.tables.map(asTable) : null;
  const rows = Array.isArray(raw.rows) ? raw.rows.map(asRow) : null;
  const singleSeats = Array.isArray(raw.singleSeats) ? raw.singleSeats.map(asSingleSeat) : null;

  if (
    typeof id !== 'string' ||
    !(roomName === null || typeof roomName === 'string') ||
    !isCount(widthCm) ||
    !isCount(lengthCm) ||
    !isCount(version) ||
    !(changedBy === null || typeof changedBy === 'string') ||
    read == null ||
    !read.every((section) => section != null) ||
    tables == null ||
    !tables.every((table) => table != null) ||
    rows == null ||
    !rows.every((row) => row != null) ||
    singleSeats == null ||
    !singleSeats.every((seat) => seat != null) ||
    withoutSection == null ||
    !isRecord(counts) ||
    !isCount(counts.sections) ||
    !isCount(counts.tables) ||
    !isCount(counts.rows) ||
    !isCount(counts.singleSeats) ||
    !isCount(counts.seatedGuests)
  )
    return null;

  return {
    id,
    roomName,
    widthCm,
    lengthCm,
    version,
    changedBy,
    sharing: asSharing(raw.sharing),
    sections: read as SeatingSection[],
    tables: tables as SeatingTable[],
    rows: rows as SeatingRow[],
    singleSeats: singleSeats as SingleSeat[],
    withoutSection,
    guests: asGuests(raw.guests),
    counts: {
      sections: counts.sections,
      tables: counts.tables,
      rows: counts.rows,
      singleSeats: counts.singleSeats,
      seatedGuests: counts.seatedGuests,
    },
  };
}

/** Null for anything else, a published update included, so a stray message is dropped rather than drawn. */
export function asSeating(raw: unknown): Seating | null {
  if (!isRecord(raw)) return null;
  const { measurementSystem, plan } = raw;

  if (measurementSystem !== 'metric' && measurementSystem !== 'us') return null;
  if (plan === null) return { measurementSystem, plan: null };

  const read = asPlan(plan);

  return read == null ? null : { measurementSystem, plan: read };
}

/** The ETag the API gave the room's, a section's, a table's, a row's or a seat's version (`EntityTag::of`). */
export function versionTag(version: number): string {
  return `"${version}"`;
}

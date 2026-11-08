/** An event's seating plan as the API answers and the hub publishes it (sc-3998). */

import { ROOM_MAXIMUM_CM, ROOM_MINIMUM_CM } from '@soirely/domain';

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

export interface SeatingSection {
  id: string;
  name: string;
  colour: SectionColour;
  version: number;
  tables: number;
  seats: number;
}

export interface SeatingPlan {
  id: string;
  roomName: string | null;
  widthCm: number;
  lengthCm: number;
  version: number;
  changedBy: string | null;
  sections: SeatingSection[];
  withoutSection: { tables: number; seats: number };
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

/** The API's SeatingPlan and SeatingSection limits, which the forms check before sending. */
export const SEATING_LIMITS = {
  roomMinimumCm: ROOM_MINIMUM_CM,
  roomMaximumCm: ROOM_MAXIMUM_CM,
  roomNameMaximum: ROOM_NAME_MAXIMUM,
  sectionNameMaximum: SECTION_NAME_MAXIMUM,
  sectionsMaximum: SECTIONS_MAXIMUM,
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value != null && !Array.isArray(value);
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function asSection(raw: unknown): SeatingSection | null {
  if (!isRecord(raw)) return null;
  const { id, name, colour, version, tables, seats } = raw;

  if (
    typeof id !== 'string' ||
    typeof name !== 'string' ||
    !(SECTION_COLOURS as readonly unknown[]).includes(colour) ||
    !isCount(version) ||
    !isCount(tables) ||
    !isCount(seats)
  )
    return null;

  return { id, name, colour: colour as SectionColour, version, tables, seats };
}

function asPlan(raw: unknown): SeatingPlan | null {
  if (!isRecord(raw)) return null;
  const { id, roomName, widthCm, lengthCm, version, changedBy, sections, withoutSection, counts } =
    raw;
  const read = Array.isArray(sections) ? sections.map(asSection) : null;

  if (
    typeof id !== 'string' ||
    !(roomName === null || typeof roomName === 'string') ||
    !isCount(widthCm) ||
    !isCount(lengthCm) ||
    !isCount(version) ||
    !(changedBy === null || typeof changedBy === 'string') ||
    read == null ||
    !read.every((section) => section != null) ||
    !isRecord(withoutSection) ||
    !isCount(withoutSection.tables) ||
    !isCount(withoutSection.seats) ||
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
    sections: read as SeatingSection[],
    withoutSection: { tables: withoutSection.tables, seats: withoutSection.seats },
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

/** The ETag the API gave the room's or a section's version (`EntityTag::of`). */
export function versionTag(version: number): string {
  return `"${version}"`;
}

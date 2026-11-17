/** An event's running order as the API answers and the hub publishes it (sc-3893). */

export interface ScheduleItem {
  id: string;
  title: string;
  /** RFC 3339 with the event zone's offset. */
  startsAt: string;
  /** When it was marked started and done, RFC 3339 in the event zone's offset (sc-1404); null until then. */
  startedAt: string | null;
  endedAt: string | null;
  /** Marked as not happening on the night screen (sc-3895); it takes no time and has no start or end. */
  skipped: boolean;
  /** The event day it sits on, `YYYY-MM-DD`: an event day runs from 05:00 to 05:00 in the event's zone. */
  day: string;
  lengthMinutes: number | null;
  place: string | null;
  ownerName: string | null;
  ownerRole: string | null;
  note: string | null;
  fixedTime: boolean;
  showToGuests: boolean;
  version: number;
}

export interface Schedule {
  timeZone: string;
  /** The earliest start an item may have: the event's start less 12 hours. */
  earliest: string;
  /** The latest: the event's end. */
  latest: string;
  itemsMaximum: number;
  items: ScheduleItem[];
}

/** What an add or a save sends: the whole item, its start a wall-clock `YYYY-MM-DDTHH:mm` in the event's zone. */
export interface ScheduleItemDetails {
  title: string;
  startsAt: string;
  lengthMinutes: number | null;
  place: string | null;
  ownerName: string | null;
  ownerRole: string | null;
  note: string | null;
  fixedTime: boolean;
  showToGuests: boolean;
}

/** Done, Start now or Skip on the night screen (sc-3895). */
export type ScheduleItemPress = 'start' | 'done' | 'skip';

/** One press as it is kept until the API has it: the key made when it was pressed, and the moment by the corrected clock. */
export interface PressSent {
  key: string;
  pressedAt: string;
}

/** A moment as the API reads a press's `pressedAt`: RFC 3339 to the millisecond, in UTC, so two presses in one second keep their order. */
export function pressedAtOf(moment: Date): string {
  return moment.toISOString();
}

export interface ScheduleWithItem {
  schedule: Schedule;
  itemId: string;
}

/** The API's limits, which the form checks before sending. */
export const SCHEDULE_TITLE_MAXIMUM = 120;
export const SCHEDULE_OWNER_MAXIMUM = 120;
export const SCHEDULE_ROLE_MAXIMUM = 40;
export const SCHEDULE_NOTE_MAXIMUM = 500;
export const SCHEDULE_LENGTH_MAXIMUM = 720;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value != null && !Array.isArray(value);
}

const text = (value: unknown): value is string | null =>
  value === null || typeof value === 'string';

export function asScheduleItem(raw: unknown): ScheduleItem | null {
  if (!isRecord(raw)) return null;
  const {
    id,
    title,
    startsAt,
    startedAt,
    endedAt,
    skipped,
    day,
    lengthMinutes,
    place,
    ownerName,
    ownerRole,
    note,
    fixedTime,
    showToGuests,
    version,
  } = raw;

  if (
    typeof id !== 'string' ||
    typeof title !== 'string' ||
    typeof startsAt !== 'string' ||
    !text(startedAt) ||
    !text(endedAt) ||
    typeof skipped !== 'boolean' ||
    typeof day !== 'string' ||
    !(lengthMinutes === null || typeof lengthMinutes === 'number') ||
    !text(place) ||
    !text(ownerName) ||
    !text(ownerRole) ||
    !text(note) ||
    typeof fixedTime !== 'boolean' ||
    typeof showToGuests !== 'boolean' ||
    typeof version !== 'number'
  )
    return null;

  return {
    id,
    title,
    startsAt,
    startedAt,
    endedAt,
    skipped,
    day,
    lengthMinutes,
    place,
    ownerName,
    ownerRole,
    note,
    fixedTime,
    showToGuests,
    version,
  };
}

/** The schedule object itself, as GET's `schedule` and the hub's message carry it; null when any part is not one this client knows. */
export function asSchedule(raw: unknown): Schedule | null {
  if (!isRecord(raw)) return null;
  const { timeZone, earliest, latest, itemsMaximum, items } = raw;

  if (
    typeof timeZone !== 'string' ||
    typeof earliest !== 'string' ||
    typeof latest !== 'string' ||
    typeof itemsMaximum !== 'number' ||
    !Array.isArray(items)
  )
    return null;

  const rows = items.map(asScheduleItem);

  return rows.every((row) => row != null)
    ? { timeZone, earliest, latest, itemsMaximum, items: rows as ScheduleItem[] }
    : null;
}

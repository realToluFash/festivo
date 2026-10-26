/** The API's event name limit, counted in characters after trimming. */
export const EVENT_NAME_MAXIMUM = 120;

/** The API's EventType, in the order the forms offer them, Other last (sc-3588). */
export const EVENT_TYPES = [
  'wedding',
  'birthday',
  'anniversary',
  'engagement',
  'baby_shower',
  'graduation',
  'memorial',
  'religious',
  'cultural',
  'party',
  'gala',
  'conference',
  'corporate',
  'other',
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export function isEventType(value: unknown): value is EventType {
  return (EVENT_TYPES as readonly unknown[]).includes(value);
}

export type EventField = 'name' | 'type' | 'startsAt' | 'endsAt';

export type EventProblem =
  'nameBlank' | 'nameTooLong' | 'typeMissing' | 'startMissing' | 'endMissing' | 'endBeforeStart';

export interface EventDraft {
  name: string;
  /** Empty until one is chosen, on a new event only. */
  type: EventType | '';
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
}

export function eventNameOf(typed: string): string {
  return typed.trim();
}

export function eventNameLength(typed: string): number {
  return Array.from(eventNameOf(typed)).length;
}

/** ISO 8601 with no offset, as the API takes it: the time is local to the event's zone. */
export function localDateTime(date: string, time: string): string | null {
  return date === '' || time === '' ? null : `${date}T${time}`;
}

/** In the order the form shows its fields, so the first is the one focus goes to. */
export function eventProblems(
  draft: EventDraft,
  timeZone: string,
): { field: EventField; problem: EventProblem }[] {
  const problems: { field: EventField; problem: EventProblem }[] = [];
  const length = eventNameLength(draft.name);
  const startsAt = savedWallClock(draft.startDate, draft.startTime, timeZone);
  const endsAt = savedWallClock(draft.endDate, draft.endTime, timeZone);

  if (length === 0) problems.push({ field: 'name', problem: 'nameBlank' });
  else if (length > EVENT_NAME_MAXIMUM) problems.push({ field: 'name', problem: 'nameTooLong' });

  if (draft.type === '') problems.push({ field: 'type', problem: 'typeMissing' });

  if (startsAt == null) problems.push({ field: 'startsAt', problem: 'startMissing' });

  if (endsAt == null) problems.push({ field: 'endsAt', problem: 'endMissing' });
  else if (startsAt != null && endsAt < startsAt)
    problems.push({ field: 'endsAt', problem: 'endBeforeStart' });

  return problems;
}

const MINUTE = 60_000;
const DAY = 86_400_000;

/** As the API's LocalTimeResolver saves it (RFC 5545 §3.3.5): a time the clocks skip moves later by the gap. */
export function savedWallClock(date: string, time: string, timeZone: string): string | null {
  const typed = localDateTime(date, time);

  if (typed == null) return null;

  return skippedTime(date, time, timeZone)?.savedAs ?? typed;
}

export function skippedTime(
  date: string,
  time: string,
  timeZone: string,
): { savedAs: string } | null {
  const typed = localDateTime(date, time);
  const local = typed == null ? Number.NaN : Date.parse(`${typed}Z`);

  if (Number.isNaN(local) || timeZone === '') return null;

  const offsetAt = zoneOffsets(timeZone);

  if (offsetAt == null) return null;

  const before = offsetAt(local - DAY);
  const after = offsetAt(local + DAY);
  const held = [before, after].some((offset) => offsetAt(local - offset) === offset);

  if (held || after <= before) return null;

  return { savedAs: new Date(local - before + after).toISOString().slice(0, 16) };
}

function zoneOffsets(timeZone: string): ((instant: number) => number) | null {
  let format: Intl.DateTimeFormat;

  try {
    format = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
    });
  } catch {
    return null;
  }

  return (instant) => {
    const parts = format.formatToParts(instant);
    const part = (type: Intl.DateTimeFormatPartTypes): number =>
      Number(parts.find((one) => one.type === type)?.value);
    const wall = Date.UTC(
      part('year'),
      part('month') - 1,
      part('day'),
      part('hour'),
      part('minute'),
    );

    return wall - Math.floor(instant / MINUTE) * MINUTE;
  };
}

/** The end date follows the start date, typed partial dates included, until the host chooses one. */
export function filledEndDate(startDate: string, endDate: string, endChosen: boolean): string {
  return endChosen ? endDate : startDate;
}

/** An event's saved values as the form types them: its wall-clock date and time, read off the offset form the API serves. */
export function draftOf(event: {
  name: string;
  type: EventType;
  startsAt: string;
  endsAt: string;
}): EventDraft {
  return {
    name: event.name,
    type: event.type,
    startDate: event.startsAt.slice(0, 10),
    startTime: event.startsAt.slice(11, 16),
    endDate: event.endsAt.slice(0, 10),
    endTime: event.endsAt.slice(11, 16),
  };
}

/** The API's venue limits, counted in characters after trimming (sc-3589). */
export const VENUE_NAME_MAXIMUM = 120;
export const VENUE_ADDRESS_MAXIMUM = 300;

/** `addressId` is the suggestion the address was picked from, and is cleared by typing in it. */
export interface VenueDraft {
  name: string;
  address: string;
  addressId: string | null;
}

export interface SavedVenue {
  name: string | null;
  address: { formatted: string } | null;
}

/** What the API takes: both blank is null, which removes the venue. */
export interface VenueSent {
  name: string | null;
  address: string | null;
  addressId?: string | null;
}

export type VenueField = 'venueName' | 'venueAddress';

export type VenueProblem = 'venueNameTooLong' | 'venueAddressTooLong';

export function venueDraftOf(venue: SavedVenue | null): VenueDraft {
  return { name: venue?.name ?? '', address: venue?.address?.formatted ?? '', addressId: null };
}

export function venueProblems(draft: VenueDraft): { field: VenueField; problem: VenueProblem }[] {
  const problems: { field: VenueField; problem: VenueProblem }[] = [];

  if (Array.from(draft.name.trim()).length > VENUE_NAME_MAXIMUM)
    problems.push({ field: 'venueName', problem: 'venueNameTooLong' });
  if (Array.from(draft.address.trim()).length > VENUE_ADDRESS_MAXIMUM)
    problems.push({ field: 'venueAddress', problem: 'venueAddressTooLong' });

  return problems;
}

export function venueSent(draft: VenueDraft): VenueSent | null {
  const name = draft.name.trim();
  const address = draft.address.trim();

  if (name === '' && address === '') return null;

  return {
    name: name === '' ? null : name,
    address: address === '' ? null : address,
    ...(draft.addressId == null || address === '' ? {} : { addressId: draft.addressId }),
  };
}

export interface EventDetails {
  name: string;
  type: EventType;
  startsAt: string;
  endsAt: string;
  timeZone: string;
  currency: string;
}

/** Only what differs from the saved event, in the API's terms; empty when nothing changed, and then nothing is sent (sc-3587). */
export function eventChanges(
  saved: EventDetails & { venue: SavedVenue | null },
  typed: { draft: EventDraft; timeZone: string; currency: string; venue: VenueDraft },
): Partial<EventDetails & { venue: VenueSent | null }> {
  const was = { ...draftOf(saved), timeZone: saved.timeZone, currency: saved.currency };
  const changes: Partial<EventDetails & { venue: VenueSent | null }> = {};
  const venue = venueSent(typed.venue);
  const savedVenue = venueSent(venueDraftOf(saved.venue));
  const startsAt = localDateTime(typed.draft.startDate, typed.draft.startTime) ?? '';
  const endsAt = localDateTime(typed.draft.endDate, typed.draft.endTime) ?? '';

  if (eventNameOf(typed.draft.name) !== was.name) changes.name = eventNameOf(typed.draft.name);
  if (typed.draft.type !== '' && typed.draft.type !== was.type) changes.type = typed.draft.type;
  if (startsAt !== localDateTime(was.startDate, was.startTime)) changes.startsAt = startsAt;
  if (endsAt !== localDateTime(was.endDate, was.endTime)) changes.endsAt = endsAt;
  if (typed.timeZone !== was.timeZone) changes.timeZone = typed.timeZone;
  if (typed.currency !== was.currency) changes.currency = typed.currency;
  if (
    venue?.addressId != null ||
    venue?.name !== savedVenue?.name ||
    venue?.address !== savedVenue?.address
  )
    changes.venue = venue;

  return changes;
}

/** Soonest start first, the same start by name in the reader's collation (CLDR), as both clients list them (sc-1593). */
export function eventsInOrder<T extends { name: string; startsAt: string }>(
  events: readonly T[],
  locale: string,
): T[] {
  const collator = new Intl.Collator(locale);

  return [...events].sort(
    (a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt) || collator.compare(a.name, b.name),
  );
}

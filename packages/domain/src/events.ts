/** The API's event name limit, counted in characters after trimming. */
export const EVENT_NAME_MAXIMUM = 120;

export type EventField = 'name' | 'startsAt' | 'endsAt';

export type EventProblem =
  'nameBlank' | 'nameTooLong' | 'startMissing' | 'endMissing' | 'endBeforeStart';

export interface EventDraft {
  name: string;
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
export function draftOf(event: { name: string; startsAt: string; endsAt: string }): EventDraft {
  return {
    name: event.name,
    startDate: event.startsAt.slice(0, 10),
    startTime: event.startsAt.slice(11, 16),
    endDate: event.endsAt.slice(0, 10),
    endTime: event.endsAt.slice(11, 16),
  };
}

export interface EventDetails {
  name: string;
  startsAt: string;
  endsAt: string;
  timeZone: string;
  currency: string;
}

/** Only what differs from the saved event, in the API's terms; empty when nothing changed, and then nothing is sent (sc-3587). */
export function eventChanges(
  saved: EventDetails,
  typed: { draft: EventDraft; timeZone: string; currency: string },
): Partial<EventDetails> {
  const was = { ...draftOf(saved), timeZone: saved.timeZone, currency: saved.currency };
  const changes: Partial<EventDetails> = {};
  const startsAt = localDateTime(typed.draft.startDate, typed.draft.startTime) ?? '';
  const endsAt = localDateTime(typed.draft.endDate, typed.draft.endTime) ?? '';

  if (eventNameOf(typed.draft.name) !== was.name) changes.name = eventNameOf(typed.draft.name);
  if (startsAt !== localDateTime(was.startDate, was.startTime)) changes.startsAt = startsAt;
  if (endsAt !== localDateTime(was.endDate, was.endTime)) changes.endsAt = endsAt;
  if (typed.timeZone !== was.timeZone) changes.timeZone = typed.timeZone;
  if (typed.currency !== was.currency) changes.currency = typed.currency;

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

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
export function eventProblems(draft: EventDraft): { field: EventField; problem: EventProblem }[] {
  const problems: { field: EventField; problem: EventProblem }[] = [];
  const length = eventNameLength(draft.name);
  const startsAt = localDateTime(draft.startDate, draft.startTime);
  const endsAt = localDateTime(draft.endDate, draft.endTime);

  if (length === 0) problems.push({ field: 'name', problem: 'nameBlank' });
  else if (length > EVENT_NAME_MAXIMUM) problems.push({ field: 'name', problem: 'nameTooLong' });

  if (startsAt == null) problems.push({ field: 'startsAt', problem: 'startMissing' });

  if (endsAt == null) problems.push({ field: 'endsAt', problem: 'endMissing' });
  else if (startsAt != null && endsAt < startsAt)
    problems.push({ field: 'endsAt', problem: 'endBeforeStart' });

  return problems;
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

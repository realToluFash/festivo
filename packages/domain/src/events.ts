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

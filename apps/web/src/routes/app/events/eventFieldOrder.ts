import { type EventDraft, type EventField } from '@soirely/domain';

export type Field = EventField | 'timeZone' | 'currency';
export type Errors = Partial<Record<Field, string | undefined>>;

/** In the order the form shows them, so the first refused is the one focus goes to. */
export const FIELDS: readonly Field[] = ['name', 'startsAt', 'endsAt', 'timeZone', 'currency'];

/** The input focus goes to: the empty half of a start or an end, or the end's date when it is too early. */
export function inputFor(field: Field, draft: EventDraft): string {
  if (field === 'name') return 'event-name';
  if (field === 'timeZone') return 'event-time-zone';
  if (field === 'currency') return 'event-currency';

  const [prefix, date, time] =
    field === 'startsAt'
      ? ['event-start', draft.startDate, draft.startTime]
      : ['event-end', draft.endDate, draft.endTime];

  return date !== '' && time === '' ? `${prefix}-time` : `${prefix}-date`;
}

export function describedBy(...ids: (string | null)[]): string | undefined {
  const joined = ids.filter((id) => id != null).join(' ');

  return joined === '' ? undefined : joined;
}

import {
  EVENT_FORM_FIELDS,
  EVENT_NAME_MAXIMUM,
  type EventDraft,
  type EventFormField,
  VENUE_ADDRESS_MAXIMUM,
  VENUE_NAME_MAXIMUM,
  eventFormProblems,
} from '@soirely/domain';
import { type TFunction } from 'i18next';

export type Field = EventFormField;
export type Errors = Partial<Record<Field, string | undefined>>;

export const FIELDS = EVENT_FORM_FIELDS;

type Problem = ReturnType<typeof eventFormProblems>[number]['problem'];

export function problemWords(field: Field, problem: Problem, t: TFunction): string {
  if (problem === 'currencyBlank') return t('orgGeneral.currencyBlank');

  return t(`eventForm.${problem}`, {
    most:
      field === 'venueName'
        ? VENUE_NAME_MAXIMUM
        : field === 'venueAddress'
          ? VENUE_ADDRESS_MAXIMUM
          : EVENT_NAME_MAXIMUM,
  });
}

/** The input focus goes to: the empty half of a start or an end, or the end's date when it is too early. */
export function inputFor(field: Field, draft: EventDraft): string {
  if (field === 'name') return 'event-name';
  if (field === 'type') return 'event-type';
  if (field === 'timeZone') return 'event-time-zone';
  if (field === 'currency') return 'event-currency';
  if (field === 'venueName') return 'event-venue-name';
  if (field === 'venueAddress') return 'event-venue-address';

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

import { formatWallClock, formatWallDay } from './datetime.ts';
import {
  EVENT_NAME_MAXIMUM,
  type EventDraft,
  type EventFormField,
  VENUE_ADDRESS_MAXIMUM,
  VENUE_NAME_MAXIMUM,
  type VenueDraft,
  eventFormProblems,
  skippedTime,
} from './events.ts';

/** Each client's `t`, so the words both forms say are worked out once. */
export interface Translate {
  (key: string): string;
  (key: string, values: Record<string, string | number>): string;
}

/** What the event form says under each field its checks refuse, the same on the web and in the app. */
export function eventFormErrors(
  typed: { draft: EventDraft; venue: VenueDraft; timeZone: string; currency: string },
  t: Translate,
): Partial<Record<EventFormField, string>> {
  const errors: Partial<Record<EventFormField, string>> = {};

  for (const { field, problem } of eventFormProblems(typed))
    errors[field] =
      problem === 'currencyBlank'
        ? t('orgGeneral.currencyBlank')
        : t(`eventForm.${problem}`, {
            most:
              field === 'venueName'
                ? VENUE_NAME_MAXIMUM
                : field === 'venueAddress'
                  ? VENUE_ADDRESS_MAXIMUM
                  : EVENT_NAME_MAXIMUM,
          });

  return errors;
}

/** The line under a time the clocks skip (sc-10638): what it is saved as instead. */
export function skippedLine(
  date: string,
  time: string,
  timeZone: string,
  locale: string,
  t: Translate,
): string | null {
  const skipped = skippedTime(date, time, timeZone);

  if (skipped == null) return null;

  const savedDate = skipped.savedAs.slice(0, 10);
  const words = {
    time: formatWallClock(time, locale),
    day: formatWallDay(date, locale),
    zone: timeZone,
    savedAs: formatWallClock(skipped.savedAs, locale),
  };

  return savedDate === date
    ? t('eventForm.clocksSkip', words)
    : t('eventForm.clocksSkipNextDay', { ...words, savedDay: formatWallDay(savedDate, locale) });
}

import { dateLocale } from '../../../i18n/index.ts';

/** A day on the guest list: the day it was in the event's zone, in the shown language. */
export function replyDate(at: string, timeZone: string): string {
  return new Intl.DateTimeFormat(dateLocale(), { month: 'short', day: 'numeric', timeZone }).format(
    new Date(at),
  );
}

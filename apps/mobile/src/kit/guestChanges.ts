import { type GuestListChange, type Person, changeAnswer, changeWhen } from '@soirely/domain';
import type { TFunction } from 'i18next';

/** The menu's choice that is not a reply (sc-4331), and the route param its last look travels in. */
export const CHANGED = 'changed';
export const GUESTS_SINCE = 'since';

/** The menu is wider while Changed since you looked leads it, so its French and Portuguese names fit. */
export function filterMenuWidth(apart: boolean): number {
  return apart ? 300 : 230;
}

export function changeLine(
  t: TFunction,
  change: GuestListChange,
  person: Person,
  timeZone: string,
  locale: string,
  now: Date,
): string {
  return t('guestList.changed.line', {
    answer: changeAnswer(t, change, person),
    when: changeWhen(t, change, timeZone, locale, now),
  });
}

import type { KitchenAllergic, KitchenSheet } from '@soirely/api-client';
import type { TFunction } from 'i18next';

import { dayIn, dayWords } from './courseDefault.ts';

/** "As of Tuesday, 8 Jun · 19:42": the snapshot's day and its time on the 24-hour clock, in the event's time zone. */
export function asOfLine(t: TFunction, asOf: string, timeZone: string, locale: string): string {
  const at = new Date(asOf);
  const time = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  }).format(at);

  return t('kitchenSheet.asOf', { at: `${dayWords(dayIn(at, timeZone), locale)} · ${time}` });
}

export function summaryLine(t: TFunction, sheet: KitchenSheet): string {
  return [
    t('kitchenSheet.coming', { count: sheet.coming }),
    t('kitchenSheet.allergic', { count: sheet.allergicCount }),
    t('kitchenSheet.courses', { count: sheet.courses.length }),
  ].join(' · ');
}

/** An allergen as the guest record names it; Other reads as the guest typed it, "Kiwi (other)". */
export function allergenName(t: TFunction, code: string, other: string | null = null): string {
  return code === 'other' && other != null
    ? t('kitchenSheet.otherAllergy', { what: other })
    : t(`guestNeeds.allergen.${code}`);
}

/** "Peanuts, Celery", or for someone a diet alone kept from the default, "No allergy · Vegan" or "No allergy · No garlic (other)". */
export const allergensOf = (t: TFunction, person: KitchenAllergic): string =>
  person.allergens.length > 0
    ? person.allergens.map((code) => allergenName(t, code, person.otherAllergy)).join(', ')
    : t('kitchenSheet.noAllergy', {
        diets: person.diets.map((code) => dietName(t, code, person.otherDiet)).join(', '),
      });

/** A diet as the guest record names it; a named Other diet reads as the guest typed it, as an Other allergy does. */
export function dietName(t: TFunction, code: string, other: string | null = null): string {
  if (code !== 'other') return t(`guestNeeds.dietName.${code}`);

  return other == null
    ? t('kitchenSheet.otherDiet')
    : t('kitchenSheet.otherAllergy', { what: other });
}

export function saveSheet(bytes: Uint8Array<ArrayBuffer>, name: string): void {
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
  const link = document.createElement('a');

  link.href = url;
  link.download = name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

export type DueError = 'start' | 'past';

/** Before submit, both in the event's zone: on or after the start's day, or a newly typed day before today. A day left as it was is never refused. */
export function dueError(
  typed: string,
  was: string | null,
  startsAt: string,
  timeZone: string,
  now: Date,
): DueError | null {
  if (typed === '' || typed === was) return null;
  if (typed >= dayIn(new Date(startsAt), timeZone)) return 'start';
  if (typed < dayIn(now, timeZone)) return 'past';

  return null;
}

/** "Tue, Nov 3": a stored day, as the Final numbers row writes it. */
export function shortDay(day: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${day}T12:00:00Z`));
}

/** "Given to the kitchen on Friday 7 Aug at 17:00 by Ada Obi": the reader's locale, the event's zone, the 24-hour clock. */
export function copyLine(
  t: TFunction,
  recordedAt: string,
  by: string,
  timeZone: string,
  locale: string,
): string {
  const at = new Date(recordedAt);
  const date = new Intl.DateTimeFormat(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    timeZone,
  }).format(at);
  const time = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  }).format(at);

  return t('kitchenSheet.copy', { date, time, name: by });
}

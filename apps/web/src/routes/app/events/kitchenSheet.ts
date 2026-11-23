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

export const allergensOf = (t: TFunction, person: KitchenAllergic): string =>
  person.allergens.map((code) => allergenName(t, code, person.otherAllergy)).join(', ');

export const dietName = (t: TFunction, code: string): string =>
  code === 'other' ? t('kitchenSheet.otherDiet') : t(`guestNeeds.dietName.${code}`);

export function saveSheet(bytes: Uint8Array<ArrayBuffer>, name: string): void {
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
  const link = document.createElement('a');

  link.href = url;
  link.download = name;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

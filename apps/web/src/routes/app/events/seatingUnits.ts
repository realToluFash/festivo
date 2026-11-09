import { type MeasurementSystem } from '@soirely/api-client';
import { feetAndInchesOf } from '@soirely/domain';
import { type TFunction } from 'i18next';

type Display = 'short' | 'long';

function unit(locale: string, name: 'meter' | 'foot' | 'inch', value: number, display: Display) {
  return new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: name,
    unitDisplay: display,
    maximumFractionDigits: 2,
    useGrouping: false,
  }).format(value);
}

/** "24 m" or "12 ft 6 in", never grouped: readRoomSide reads "," as a decimal point, so a size the page shows is one its fields read back. */
export function lengthWords(
  t: TFunction,
  locale: string,
  cm: number,
  system: MeasurementSystem,
  { display = 'short' }: { display?: Display } = {},
): string {
  if (system === 'metric') return unit(locale, 'meter', cm / 100, display);
  const { feet, inches } = feetAndInchesOf(cm);
  const shownFeet = unit(locale, 'foot', feet, display);

  return inches === 0
    ? shownFeet
    : t('seating.feetInches', {
        feet: shownFeet,
        inches: unit(locale, 'inch', inches, display),
      });
}

/** What a Room settings field holds: a number in metres, or the feet and inches it reads back. */
export function lengthField(
  t: TFunction,
  locale: string,
  cm: number,
  system: MeasurementSystem,
): string {
  return system === 'metric'
    ? new Intl.NumberFormat(locale, { maximumFractionDigits: 2, useGrouping: false }).format(
        cm / 100,
      )
    : lengthWords(t, locale, cm, system);
}

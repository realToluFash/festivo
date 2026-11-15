import { type MeasurementSystem } from '@soirely/api-client';
import { feetAndInchesOf, numberFormat } from '@soirely/domain';
import { type TFunction } from 'i18next';

type Display = 'short' | 'long';

function unit(
  locale: string,
  name: 'meter' | 'foot' | 'inch',
  value: number,
  display: Display,
  grouping: boolean,
) {
  return numberFormat(locale, {
    style: 'unit',
    unit: name,
    unitDisplay: display,
    maximumFractionDigits: 2,
    ...(grouping ? {} : { useGrouping: false }),
  }).format(value);
}

/** "24 m" or "12 ft 6 in"; readRoomSide reads "," as a decimal point, so a field's value has no grouping. */
export function lengthWords(
  t: TFunction,
  locale: string,
  cm: number,
  system: MeasurementSystem,
  { display = 'short', grouping = true }: { display?: Display; grouping?: boolean } = {},
): string {
  if (system === 'metric') return unit(locale, 'meter', cm / 100, display, grouping);
  const { feet, inches } = feetAndInchesOf(cm);
  const shownFeet = unit(locale, 'foot', feet, display, grouping);

  return inches === 0
    ? shownFeet
    : t('seating.feetInches', {
        feet: shownFeet,
        inches: unit(locale, 'inch', inches, display, grouping),
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
    ? numberFormat(locale, { maximumFractionDigits: 2, useGrouping: false }).format(cm / 100)
    : lengthWords(t, locale, cm, system, { grouping: false });
}

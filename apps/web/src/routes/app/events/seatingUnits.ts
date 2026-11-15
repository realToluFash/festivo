import { type MeasurementSystem } from '@soirely/api-client';
import { feetAndInchesOf, numberFormat } from '@soirely/domain';
import { type TFunction } from 'i18next';

type Display = 'short' | 'long';

function unit(
  locale: string,
  name: 'meter' | 'centimeter' | 'foot' | 'inch',
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

/** A table's side: "180 cm", or feet and inches; a limit of whole metres reads "10 m". */
export function tableLengthWords(
  t: TFunction,
  locale: string,
  cm: number,
  system: MeasurementSystem,
  { grouping = true }: { grouping?: boolean } = {},
): string {
  if (system === 'us') return lengthWords(t, locale, cm, system, { grouping });
  return cm >= 100 && cm % 100 === 0
    ? unit(locale, 'meter', cm / 100, 'short', grouping)
    : unit(locale, 'centimeter', cm, 'short', grouping);
}

/** "180 cm" round, "180 × 76 cm" long: in metric the unit is said once, after the length. */
export function tableSizeWords(
  t: TFunction,
  locale: string,
  table: { shape: string; widthCm: number; lengthCm: number },
  system: MeasurementSystem,
): string {
  const length = (cm: number) =>
    system === 'us'
      ? lengthWords(t, locale, cm, system)
      : unit(locale, 'centimeter', cm, 'short', true);

  if (table.shape === 'round' || table.shape === 'cocktail') return length(table.widthCm);
  return t('seating.tableSize', {
    width:
      system === 'us'
        ? length(table.widthCm)
        : numberFormat(locale, { maximumFractionDigits: 0 }).format(table.widthCm),
    tableLength: length(table.lengthCm),
  });
}

/** What a table's size field holds: whole centimetres, or the feet and inches it reads back. */
export function tableSizeField(
  t: TFunction,
  locale: string,
  cm: number,
  system: MeasurementSystem,
): string {
  return system === 'metric' ? String(cm) : lengthWords(t, locale, cm, system, { grouping: false });
}

/** The centimetre's short word in the reader's language, beside a table's size field. */
export function centimetreUnit(locale: string): string {
  return (
    numberFormat(locale, { style: 'unit', unit: 'centimeter', unitDisplay: 'short' })
      .formatToParts(1)
      .find((part) => part.type === 'unit')?.value ?? 'cm'
  );
}

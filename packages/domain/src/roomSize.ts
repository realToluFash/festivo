/** A room's width or length as a person types it, in metres or in feet and inches (sc-3998). */

export type RoomUnits = 'metric' | 'us';

export const ROOM_MINIMUM_CM = 200;
export const ROOM_MAXIMUM_CM = 50_000;

const CM_PER_INCH = 2.54;

export type RoomSideReading =
  { kind: 'cm'; cm: number } | { kind: 'blank' } | { kind: 'unreadable' } | { kind: 'outOfRange' };

const NUMBER = '(\\d+(?:[.,]\\d+)?)';

function escaped(word: string): string {
  return word.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

/** CLDR's short and long words for a unit in the reader's language, beside the English ones every language accepts. */
function unitWords(unit: 'foot' | 'inch', locale: string): string[] {
  const english = unit === 'foot' ? ['ft', 'feet', 'foot'] : ['in', 'inch', 'inches'];
  const words = new Set(english);

  for (const unitDisplay of ['short', 'long', 'narrow'] as const) {
    for (const count of [1, 2]) {
      const part = new Intl.NumberFormat(locale, { style: 'unit', unit, unitDisplay })
        .formatToParts(count)
        .find((one) => one.type === 'unit')?.value;

      if (part != null && part.trim() !== '') words.add(part.trim().toLowerCase());
    }
  }

  return [...words].sort((a, b) => b.length - a.length);
}

function decimal(text: string): number {
  return Number(text.replace(',', '.'));
}

/** Total inches, or null: "12′ 4″", "12' 4\"", "12 ft 4 in", "12.5 ft", "148 in", or a bare "12" as feet. */
export function readFeetAndInches(text: string, locale: string): number | null {
  const typed = text.trim().toLowerCase().replace(/\s+/gu, ' ');
  const feet = ['′', "'", '’', ...unitWords('foot', locale)].map(escaped).join('|');
  const inches = ['″', '"', '”', ...unitWords('inch', locale)].map(escaped).join('|');
  const inchesAlone = new RegExp(`^${NUMBER} ?(?:${inches})$`, 'u').exec(typed);

  if (inchesAlone?.[1] != null) return decimal(inchesAlone[1]);

  const both = new RegExp(`^${NUMBER} ?(?:${feet})(?: ?${NUMBER} ?(?:${inches}))?$`, 'u').exec(
    typed,
  );

  if (both?.[1] != null) return decimal(both[1]) * 12 + (both[2] == null ? 0 : decimal(both[2]));

  const bare = new RegExp(`^${NUMBER}$`, 'u').exec(typed);

  return bare?.[1] == null ? null : decimal(bare[1]) * 12;
}

/** "." and "," are both the decimal point in every language: 2 to 500 needs no thousands separator. */
export function readRoomSide(text: string, units: RoomUnits, locale: string): RoomSideReading {
  return readLength(text, units, locale, 100, [ROOM_MINIMUM_CM, ROOM_MAXIMUM_CM]);
}

/** A table's width, length or diameter (sc-4000): whole centimetres, or feet and inches. */
export function readTableSide(text: string, units: RoomUnits, locale: string): RoomSideReading {
  return readLength(text, units, locale, 1, [TABLE_MINIMUM_CM, TABLE_MAXIMUM_CM]);
}

export const TABLE_MINIMUM_CM = 40;
export const TABLE_MAXIMUM_CM = 1000;

/** A row's spacing, centre to centre (sc-4003). */
export function readRowSpacing(text: string, units: RoomUnits, locale: string): RoomSideReading {
  return readLength(text, units, locale, 1, [ROW_SPACING_MINIMUM_CM, ROW_SPACING_MAXIMUM_CM]);
}

export const ROW_SPACING_MINIMUM_CM = 40;
export const ROW_SPACING_MAXIMUM_CM = 100;

/** Where an item stands on the floor (sc-5028): metres, "m" or "cm" written or not, or feet and inches with the unit written, since a bare number could be either; inches are stored whole. */
export function readFloorPosition(text: string, units: RoomUnits, locale: string): RoomSideReading {
  return readLength(text, units, locale, 100, [0, ROOM_MAXIMUM_CM], {
    metricWords: { m: 100, cm: 1 },
    bareFeet: false,
    wholeInches: true,
  });
}

function readLength(
  text: string,
  units: RoomUnits,
  locale: string,
  cmPerMetricUnit: number,
  [minimum, maximum]: [number, number],
  {
    metricWords = {},
    bareFeet = true,
    wholeInches = false,
  }: { metricWords?: Record<string, number>; bareFeet?: boolean; wholeInches?: boolean } = {},
): RoomSideReading {
  if (text.trim() === '') return { kind: 'blank' };

  let cm: number | null;

  if (units === 'us') {
    const bare = new RegExp(`^${NUMBER}$`, 'u').test(text.trim());
    const inches = !bareFeet && bare ? null : readFeetAndInches(text, locale);

    cm =
      inches == null ? null : Math.round((wholeInches ? Math.round(inches) : inches) * CM_PER_INCH);
  } else {
    const words = Object.keys(metricWords).map(escaped).join('|');
    const typed = new RegExp(`^${NUMBER}${words === '' ? '' : `\\s?(${words})?`}$`, 'u').exec(
      text.trim().toLowerCase(),
    );
    const perUnit =
      typed?.[2] == null ? cmPerMetricUnit : (metricWords[typed[2]] ?? cmPerMetricUnit);

    cm = typed?.[1] == null ? null : Math.round(decimal(typed[1]) * perUnit);
  }

  if (cm == null || !Number.isFinite(cm)) return { kind: 'unreadable' };
  if (cm < minimum || cm > maximum) return { kind: 'outOfRange' };

  return { kind: 'cm', cm };
}

/** Whole feet and the inches left over; a limit rounds inward so the size it states is accepted. */
export function feetAndInchesOf(
  cm: number,
  rounding: 'nearest' | 'up' | 'down' = 'nearest',
): { feet: number; inches: number } {
  const round = { nearest: Math.round, up: Math.ceil, down: Math.floor }[rounding];
  const total = round(cm / CM_PER_INCH);

  return { feet: Math.floor(total / 12), inches: total % 12 };
}

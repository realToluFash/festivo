/** A room's width or length as a person types it, in metres or in feet and inches (sc-3998). */

export type RoomUnits = 'metric' | 'us';

export const ROOM_MINIMUM_CM = 200;
export const ROOM_MAXIMUM_CM = 50_000;

const CM_PER_INCH = 2.54;

export type RoomSideReading =
  | { kind: 'cm'; cm: number }
  | { kind: 'blank' }
  | { kind: 'unreadable' }
  | { kind: 'outOfRange' };

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
  if (text.trim() === '') return { kind: 'blank' };

  let cm: number | null;

  if (units === 'us') {
    const inches = readFeetAndInches(text, locale);
    cm = inches == null ? null : Math.round(inches * CM_PER_INCH);
  } else {
    const metres = new RegExp(`^${NUMBER}$`, 'u').exec(text.trim());
    cm = metres?.[1] == null ? null : Math.round(decimal(metres[1]) * 100);
  }

  if (cm == null || !Number.isFinite(cm)) return { kind: 'unreadable' };
  if (cm < ROOM_MINIMUM_CM || cm > ROOM_MAXIMUM_CM) return { kind: 'outOfRange' };

  return { kind: 'cm', cm };
}

/** Whole feet and the inches left over, rounded to the whole inch. */
export function feetAndInchesOf(cm: number): { feet: number; inches: number } {
  const total = Math.round(cm / CM_PER_INCH);

  return { feet: Math.floor(total / 12), inches: total % 12 };
}

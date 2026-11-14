import type { TextStyle } from 'react-native';

export const SANS = {
  400: 'InstrumentSans-Regular',
  500: 'InstrumentSans-Medium',
  600: 'InstrumentSans-SemiBold',
  700: 'InstrumentSans-Bold',
} as const;

/** Google's own typeface for the words on its sign-in button, and nowhere else. Google publishes the one weight. */
export const GOOGLE_SANS = {
  500: 'GoogleSans-Medium',
} as const;

const FAMILIES = { sans: SANS, googleSans: GOOGLE_SANS } as const;

/** `system` is the platform's own font, for the words on Apple's sign-in button on iOS alone. */
export type Family = keyof typeof FAMILIES | 'system';

let loaded = false;

/** Called once by the root when every face has loaded. Until then, and forever if one failed, text keeps the platform font. */
export function facesLoaded(): void {
  loaded = true;
}

/** With the phone's Bold text on, each Instrument Sans weight is drawn one step heavier, up to Bold, so a line stays one step under its title (sc-19877). Google Sans ships one weight, and keeps it. */
export const ONE_STEP_HEAVIER = {
  400: 600,
  500: 600,
  600: 700,
  700: 700,
} as const satisfies Record<keyof typeof SANS, keyof typeof SANS>;

/** Drops the weight once it has chosen the file: Android would look a 700 up in a BOLD slot that is empty, and draw Roboto. */
export function faceStyle(flat: TextStyle, family: Family = 'sans', bold = false): TextStyle {
  // React Native caches iOS's system font by family, size and weight, made once with Bold text as it was then; a family of its own under Bold text is a font made with it on (sc-19877).
  if (family === 'system') return bold ? { ...flat, fontFamily: 'system-ui' } : flat;
  if (!loaded) return flat;

  const { fontWeight, ...rest } = flat;

  return { ...rest, fontFamily: faceFor(fontWeight, family, bold) };
}

/** A field's face, its weight and slant stated on Android as React Native reads them from the span over text it hands the field, so the span draws the face the field does. */
export function inputFaceStyle(
  flat: TextStyle,
  family: Family,
  os: string,
  bold = false,
): TextStyle {
  const faced = faceStyle(flat, family, bold);
  if (!loaded || os !== 'android') return faced;

  return { ...faced, fontWeight: 'normal', fontStyle: flat.fontStyle ?? 'normal' };
}

export function faceFor(
  asked: string | number | undefined,
  family: Exclude<Family, 'system'> = 'sans',
  bold = false,
): string {
  const wanted = numeric(asked);
  const files: Record<number, string> = FAMILIES[family];
  const weight = Object.keys(files)
    .map(Number)
    .reduce((best, next) => (Math.abs(next - wanted) <= Math.abs(best - wanted) ? next : best));

  const drawn = bold && family === 'sans' ? ONE_STEP_HEAVIER[weight as keyof typeof SANS] : weight;

  return files[drawn] as string;
}

function numeric(asked: string | number | undefined): number {
  if (asked == null || asked === 'normal') return 400;
  if (asked === 'bold') return 700;

  const weight = Number(asked);

  return Number.isNaN(weight) ? 400 : weight;
}

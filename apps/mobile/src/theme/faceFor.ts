import type { TextStyle } from 'react-native';

/** JetBrains Mono is for step numbers, keyboard shortcuts and codes copied character by character, never for money. */
export const SANS = {
  400: 'InstrumentSans-Regular',
  500: 'InstrumentSans-Medium',
  600: 'InstrumentSans-SemiBold',
  700: 'InstrumentSans-Bold',
} as const;

export const MONO = {
  500: 'JetBrainsMono-Medium',
  700: 'JetBrainsMono-Bold',
} as const;

let loaded = false;

/** Called once by the root when every face has loaded. Until then, and forever if one failed, text keeps the platform font. */
export function facesLoaded(): void {
  loaded = true;
}

/** Drops the weight once it has chosen the file: Android would look a 700 up in a BOLD slot that is empty, and draw Roboto. */
export function faceStyle(flat: TextStyle, mono = false): TextStyle {
  if (!loaded) return flat;

  const { fontWeight, ...rest } = flat;

  return { ...rest, fontFamily: faceFor(fontWeight, mono) };
}

export function faceFor(asked: string | number | undefined, mono = false): string {
  const wanted = numeric(asked);
  const files: Record<number, string> = mono ? MONO : SANS;
  const weight = Object.keys(files)
    .map(Number)
    .reduce((best, next) => (Math.abs(next - wanted) <= Math.abs(best - wanted) ? next : best));

  return files[weight] as string;
}

function numeric(asked: string | number | undefined): number {
  if (asked == null || asked === 'normal') return 400;
  if (asked === 'bold') return 700;

  const weight = Number(asked);

  return Number.isNaN(weight) ? 400 : weight;
}

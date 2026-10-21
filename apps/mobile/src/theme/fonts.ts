import { StyleSheet, type StyleProp, type TextStyle } from 'react-native';

import { MONO, SANS, faceFor } from './faceFor.ts';

/**
 * Weights, never family names. This is a convention with teeth.
 *
 * A custom face ships as one file per weight, so `face()` below resolves
 * `fontWeight` to the right file. Setting `fontFamily` directly bypasses that
 * mapper — and on React Native Web the previous build CRASHED whenever it
 * happened, because the mapper was mid-resolution on a style it did not expect.
 *
 * Two rules follow, and textGuard.test.ts enforces the second:
 *
 *   1. Never write `fontFamily` in a style. Write `fontWeight`.
 *   2. Never nest a `Text` inside a `Text`, and never give a `Text` an
 *      `onPress`. Use sibling `Text` elements and wrap in a `Pressable`.
 */
export const WEIGHTS = {
  regular: '400',
  medium: '500',
  /** The design's workhorse emphasis: row titles, labels, pills, buttons. */
  semibold: '600',
  bold: '700',
} as const satisfies Record<string, TextStyle['fontWeight']>;

export type WeightName = keyof typeof WEIGHTS;

/** The only sanctioned way to ask for a weight. */
export function weight(name: WeightName): Pick<TextStyle, 'fontWeight'> {
  return { fontWeight: WEIGHTS[name] };
}

/** Bundled in assets/fonts beside their licences, so nothing is fetched at runtime. Keyed by the family `faceFor()` names. */
export const FONT_FACES = {
  [SANS[400]]: require('../../assets/fonts/instrument-sans/InstrumentSans-Regular.ttf'),
  [SANS[500]]: require('../../assets/fonts/instrument-sans/InstrumentSans-Medium.ttf'),
  [SANS[600]]: require('../../assets/fonts/instrument-sans/InstrumentSans-SemiBold.ttf'),
  [SANS[700]]: require('../../assets/fonts/instrument-sans/InstrumentSans-Bold.ttf'),
  [MONO[500]]: require('../../assets/fonts/jetbrains-mono/JetBrainsMono-Medium.ttf'),
  [MONO[700]]: require('../../assets/fonts/jetbrains-mono/JetBrainsMono-Bold.ttf'),
} as Record<string, number>;

let loaded = false;

/** Called once by the root when every face has loaded. Until then, and forever if one failed, text keeps the platform font. */
export function facesLoaded(): void {
  loaded = true;
}

/**
 * The one place a family is chosen, from the weight the whole style asks for.
 * Text and every field put their style through this.
 */
export function faced(style: StyleProp<TextStyle>, mono = false): TextStyle {
  const flat = StyleSheet.flatten(style);

  if (!loaded) return flat;

  const { family, weight } = faceFor(flat.fontWeight, mono);

  return { ...flat, fontFamily: family, fontWeight: String(weight) as TextStyle['fontWeight'] };
}

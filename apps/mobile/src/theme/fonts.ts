import type { TextStyle } from 'react-native';

/**
 * Weights, never family names. This is a convention with teeth.
 *
 * A custom face ships as one file per weight, so a mapper resolves
 * `fontWeight` to the right file. Setting `fontFamily` directly bypasses that
 * mapper — and on React Native Web the previous build CRASHED whenever it
 * happened, because the mapper was mid-resolution on a style it did not expect.
 *
 * Two rules follow, and textGuard.test.ts enforces the second:
 *
 *   1. Never write `fontFamily` in a style. Write `fontWeight`.
 *   2. Never nest a `Text` inside a `Text`, and never give a `Text` an
 *      `onPress`. Use sibling `Text` elements and wrap in a `Pressable`.
 *
 * No face is registered yet, so these resolve to the platform font. That is
 * deliberate: a font file is a design decision, and inventing one here would
 * be a choice made by whoever happened to write the skeleton. The mechanism and
 * the rule are what Foundation owes the design.
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

/**
 * Custom faces, when there are any: one entry per weight, keyed so a mapper
 * can resolve fontWeight to a file.
 *
 * The design names Instrument Sans (400/500/600/700) for everything a person
 * reads, and JetBrains Mono (500/700) for step numbers and keyboard shortcuts
 * only. No file is bundled yet — these resolve to the platform font until the
 * faces are added — but the weights above are the set to ship, so a style
 * asking for 600 is asking for something that will exist.
 */
export const FONT_FACES: Record<string, never> = {};

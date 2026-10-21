/** JetBrains Mono is for step numbers and keyboard shortcuts only, never for money. */
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

export interface Face {
  family: string;
  /** The file's own weight, so a platform never synthesises one. */
  weight: number;
}

export function faceFor(asked: string | number | undefined, mono = false): Face {
  const wanted = numeric(asked);
  const files: Record<number, string> = mono ? MONO : SANS;
  const weight = Object.keys(files)
    .map(Number)
    .reduce((best, next) => (Math.abs(next - wanted) <= Math.abs(best - wanted) ? next : best));

  return { family: files[weight] ?? SANS[400], weight };
}

function numeric(asked: string | number | undefined): number {
  if (asked == null || asked === 'normal') return 400;
  if (asked === 'bold') return 700;

  const weight = Number(asked);

  return Number.isNaN(weight) ? 400 : weight;
}

import { SANS } from '../../theme/faceFor.ts';

export type Asked = keyof typeof SANS;

const ASKED: readonly Asked[] = [400, 500, 600, 700];

/** One step heavier, capped at Instrument Sans's Bold (sc-19877, decided 8 Nov): lines stay under their titles. */
const ONE_STEP: Record<Asked, Asked> = { 400: 600, 500: 600, 600: 700, 700: 700 };

const PLAIN: Readonly<Record<Asked, string>> = { ...SANS };

const FACE_NAME: Record<Asked, string> = {
  400: 'Instrument Sans Regular 400',
  500: 'Instrument Sans Medium 500',
  600: 'Instrument Sans SemiBold 600',
  700: 'Instrument Sans Bold 700',
};

export function drawnWeight(asked: Asked, on: boolean): Asked {
  return on ? ONE_STEP[asked] : asked;
}

/** A weight's own file, whatever the switch says: the specimen draws both columns at once. */
export function plainFace(weight: Asked): string {
  return PLAIN[weight];
}

/** The face table every Text and field reads: the demo moves it, so its screens draw the map as they are. */
export function drawFaces(on: boolean): void {
  for (const asked of ASKED) Object.assign(SANS, { [asked]: PLAIN[drawnWeight(asked, on)] });
}

export interface MapRow {
  asked: Asked;
  drawn: Asked;
  off: string;
  on: string;
  sample: string;
  size: number;
}

/** Each sample is what the app draws at that weight and size. */
export const MAP_ROWS: readonly MapRow[] = (
  [
    [400, 'Your name, email addresses and phone numbers', 15],
    [500, 'Email', 14],
    [600, 'Sign in with email', 16],
    [700, 'Settings', 34],
  ] as const
).map(([asked, sample, size]) => ({
  asked,
  drawn: drawnWeight(asked, true),
  off: FACE_NAME[asked],
  on:
    asked === drawnWeight(asked, true)
      ? `${FACE_NAME[asked]}, unchanged`
      : FACE_NAME[drawnWeight(asked, true)],
  sample,
  size,
}));

/** Asked for in the system font, so outside the table: the iPhone's own Medium and Bold. */
export function appleIosWeight(on: boolean): 'medium' | 'bold' {
  return on ? 'bold' : 'medium';
}

export const APPLE_ANDROID = {
  off: FACE_NAME[500],
  on: FACE_NAME[drawnWeight(500, true)],
  offWeight: 500,
  onWeight: drawnWeight(500, true),
} as const;

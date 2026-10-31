import { tokens } from '../theme/tokens.ts';

// iOS's eighth step of Larger Text draws text 1.79 times, its ninth 2.14, and Android's largest 2.
const ACCESSIBILITY_SCALE = 1.7;
const NINTH_STEP_SCALE = 2;

export function atAccessibilitySizes(fontScale: number): boolean {
  return fontScale >= ACCESSIBILITY_SCALE;
}

// iOS's Title 1 and Title 3 at the eighth and the ninth steps (Apple HIG, Typography, Dynamic Type sizes).
const TITLE_STEPS: Readonly<Record<number, readonly [number, number]>> = {
  20: [31, 37],
  26: [38, 43],
  28: [38, 43],
};

/** The size a title is drawn at: the full scale below the accessibility sizes, iOS's own steps from them on. */
export function titleSize(size: number, fontScale: number): number {
  const steps = TITLE_STEPS[size];
  if (steps == null || !atAccessibilitySizes(fontScale)) return size * fontScale;

  return fontScale >= NINTH_STEP_SCALE ? steps[1] : steps[0];
}

// WCAG 2.2 SC 1.4.4 asks for text at twice its size; past that the header's back stays put and only the title grows (sc-23361).
const BACK_GROWS_TO = 2;

/** The size a header's back label is drawn at: the full scale up to twice its default, no further. */
export function backLabelSize(fontScale: number): number {
  return tokens.typeBodyPhone.size * Math.min(fontScale, BACK_GROWS_TO);
}

/** Every distinct word in these texts. */
export function wordsIn(texts: readonly string[]): string[] {
  return [...new Set(texts.flatMap((text) => text.split(/\s+/u)).filter((word) => word !== ''))];
}

/** The one size for labels whose widest word, drawn at `start`, measures `widest` in a slot `slot` wide: `start` when it fits, never below `size`. */
export function fitWidest(size: number, start: number, widest: number, slot: number): number {
  if (widest <= slot) return start;

  return Math.max(size, Math.floor((start * slot) / widest));
}

/** A name in the frame takes one line, and two at the accessibility sizes, before it is cut. */
export function nameLines(fontScale: number): 1 | 2 {
  return atAccessibilitySizes(fontScale) ? 2 : 1;
}

const RAIL_WIDTH = 220;
const RAIL_WIDTH_ACCESSIBLE = 300;

export function railWidth(fontScale: number): number {
  return atAccessibilitySizes(fontScale) ? RAIL_WIDTH_ACCESSIBLE : RAIL_WIDTH;
}

/** A list beside a page on a tablet: its own width, or 40 percent of the content at the accessibility sizes. */
export function sideListWidth(width: number, contentWidth: number, fontScale: number): number {
  return atAccessibilitySizes(fontScale) ? Math.max(width, Math.round(contentWidth * 0.4)) : width;
}

/** An email as drawn, free to break after its @ when it is wider than its line. Its accessibility label stays the address. */
export function breakableEmail(email: string): string {
  return email.replace('@', '@​');
}

export const SMALL_LINE = tokens.typeSmall.size * tokens.typeSmall.lineHeight;
export const TITLE_LINE = tokens.typeRowTitle.size * tokens.typeRowTitle.lineHeight;

/** A line as the text view draws it: Android rounds each line up to a whole pixel (`CustomLineHeightSpan`), iOS keeps the fraction. */
export function drawnLine(
  lineHeight: number,
  fontScale: number,
  pixelRatio: number | null,
): number {
  const scaled = lineHeight * fontScale;

  return pixelRatio == null ? scaled : Math.ceil(scaled * pixelRatio) / pixelRatio;
}

/** The height of two upcoming rows, held while loading, failed or Finished so the panels below do not move; worked from the lines the rows are set in, not measured on one screen. */
export function rowsFloor(fontScale: number, pixelRatio: number | null): number {
  const line = (height: number) => drawnLine(height, fontScale, pixelRatio);
  const lines = line(SMALL_LINE) * 2 + line(TITLE_LINE);
  const row = lines + tokens.spaceMd * 2 + tokens.spaceXxs * 2 + tokens.spaceXxs * 2;

  return row * 2 + 1;
}

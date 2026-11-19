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
  30: [38, 43],
  34: [38, 43],
};

/** The size a title is drawn at: the full scale below the accessibility sizes, iOS's own steps from them on. */
export function titleSize(size: number, fontScale: number): number {
  const steps = TITLE_STEPS[size];
  if (steps == null || !atAccessibilitySizes(fontScale)) return size * fontScale;

  return fontScale >= NINTH_STEP_SCALE ? steps[1] : steps[0];
}

/** A page's title as it reported the size it drew at, for the page and text size `key` it drew on. */
export interface DrawnTitle {
  key: string;
  size: number;
}

/** The page and the text size a title's report holds for: a report on another page or at another size caps nothing. */
export function titleCapKey(at: string, fontScale: number): string {
  return `${at}|${fontScale}`;
}

/** A title's report of `size` on `key`, keeping `now` where it says the same, so an unchanged report draws nothing again. */
export function reportTitle(now: DrawnTitle | null, key: string, size: number): DrawnTitle {
  return now?.key === key && now.size === size ? now : { key, size };
}

/** The cap under a page's title of `size` on `key`: the size it reported there, or until it does, the size it will draw at unless a word steps it down. */
export function titleCapOn(
  drawn: DrawnTitle | null,
  key: string,
  size: number,
  fontScale: number,
): { cap: number; drawn: boolean } {
  const reported = drawn?.key === key;

  return { cap: reported ? drawn.size : titleSize(size, fontScale), drawn: reported };
}

/** The most a text of `size` may grow so it never draws larger than a title drawn at `title`; React Native ignores a multiplier under 1. */
export function capUnderTitle(title: number, size: number, own?: number): number {
  return Math.max(1, Math.min(own ?? Infinity, title / size));
}

/** Where a label starts before its words are fitted: `size × scale`, no larger than `cap`, never under `size`. */
export function labelStart(size: number, scale: number, cap: number): number {
  return size * capUnderTitle(cap, size, scale);
}

/** The line under a title starts no larger than the title draws, so a stepped-down title never has a larger line under it. */
export function lineStart(line: number, scale: number, cap: number, title: number): number {
  return labelStart(line, scale, Math.min(cap, title));
}

/** The most a disc's initials of `size` may grow: to half the disc's side, which keeps its size at every text size (sc-37693). */
export function capInDisc(side: number, size: number): number {
  return Math.max(1, (side * 0.5) / size);
}

// A bold digit, a plus and a space in the faces' chip are each at most this share of their size wide.
const CHIP_CHARACTER = 0.62;
const CHIP_ROOM = 0.8;

/** The most a chip of `characters` in a disc may grow: as `capInDisc`, and no wider than the disc's middle, so 99+ is never cut (sc-37693). */
export function capChipInDisc(side: number, size: number, characters: number): number {
  const across = (side * CHIP_ROOM) / (size * characters * CHIP_CHARACTER);

  return Math.max(1, Math.min(capInDisc(side, size), across));
}

// An iPhone SE or mini is 375 across; an iPhone 17 Pro, 402.
const COMPACT_PHONE_SIDE = 390;

/** The header band's title, the same on every screen: 34 on a phone, 30 on an SE and on a tablet (page 29, sc-26270). */
export function frameTitleSize(tablet: boolean, shortSide: number): number {
  return tablet || shortSide < COMPACT_PHONE_SIDE
    ? tokens.typeTitleFrameCompact.size
    : tokens.typeTitleFrame.size;
}

/** Every distinct word in these texts. */
export function wordsIn(texts: readonly string[]): string[] {
  return [...new Set(texts.flatMap((text) => text.split(/\s+/u)).filter((word) => word !== ''))];
}

/** Every distinct piece a line may wrap between: each word, split after a hyphen it already has, the hyphen kept on the first part (sc-69816). */
export function piecesIn(texts: readonly string[]): string[] {
  return [
    ...new Set(
      wordsIn(texts).flatMap((word) =>
        word
          .replace(/([-\u2010])/gu, '$1\n')
          .split('\n')
          .filter((piece) => piece !== ''),
      ),
    ),
  ];
}

/** The one size for labels whose widest word, drawn at `start`, measures `widest` in a slot `slot` wide: `start` when it fits, never below `size`. */
export function fitWidest(size: number, start: number, widest: number, slot: number): number {
  if (widest <= slot) return start;

  return Math.max(size, Math.floor((start * slot) / widest));
}

/** A label beside a glyph that grows with it, `glyph` per unit of the label's size: `start` while the widest word and the glyph fit `inside`, never below `size` (sc-13496). */
export function besideGlyph(
  size: number,
  start: number,
  widest: number,
  glyph: number,
  inside: number,
): number {
  return fitWidest(size, start, widest + glyph * start, inside);
}

export const LABEL_LINE = 1.22;

/** 12 above and below a growing pill's words, or what main's height leaves around them at the default size, so a tablet on its side keeps 44 (sc-66900). */
export function grownPad(height: number, size: number, ring: number): number {
  return Math.min(tokens.spaceLg, (height - 2 * ring - size * LABEL_LINE) / 2);
}

export interface WordsRoom {
  /** The width a text drawn at the start wrapped at, when it wrapped. */
  wrapped: number | null;
  /** That width, kept under the start and window width it was read at. */
  kept: { key: string; width: number } | null;
  /** A container's width, as its caller reports it, under the window width it was read at. */
  reported: { windowWidth: number; width: number } | null;
}

/** What a wrapped text's width holds for: its start, the window's width, and the room its container reported, so a new room is never fitted to a width read in an old one (sc-69816). */
export function wordsRoomKey(start: number, windowWidth: number, given?: number): string {
  return given == null ? `${start}|${windowWidth}` : `${start}|${windowWidth}|${given}`;
}

/** The width the texts have to fit, 0 while it is not known. */
export function wordsSlot(
  { wrapped, kept, reported }: WordsRoom,
  start: number,
  windowWidth: number,
  given?: number,
): number {
  if (wrapped != null) return wrapped;
  if (kept?.key === wordsRoomKey(start, windowWidth, given)) return kept.width;
  // A container's onLayout does not fire again when only the text size changes (sc-37298).
  return reported?.windowWidth === windowWidth ? reported.width : 0;
}

/** A name in the frame takes one line, and two at the accessibility sizes, before it is cut. */
export function nameLines(fontScale: number): 1 | 2 {
  return atAccessibilitySizes(fontScale) ? 2 : 1;
}

/** iPad landscape's sidebar, at every text size: past its height it scrolls. */
export const SIDEBAR_WIDTH = 252;

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

/** The padding above and below a line that sets its middle at the middle of a row `row` tall; none once the line is taller. */
export function paddingToCentre(row: number, line: number): number {
  return Math.max(0, (row - line) / 2);
}

export const BAND_MARK = 18;
export const BAND_MARK_GAP = tokens.spaceMd;
export const BAND_GAP = tokens.spaceXl;
export const BAND_PILL_PADDING = tokens.spaceXl;
export const BAND_PILL_EDGE = 1;

/** Where the offline band's Try again goes: beside while its widest word fits whole in the room Try again leaves, otherwise under, where a pill wider than the band's inner width takes that width and wraps. */
export function bandPlace({
  widestWord,
  tryAgain,
  band,
  sidePadding,
}: {
  widestWord: number;
  tryAgain: number;
  band: number;
  sidePadding: number;
}): { beside: boolean; pillWraps: boolean } {
  const inner = band - sidePadding * 2;
  const pill = tryAgain + (BAND_PILL_PADDING + BAND_PILL_EDGE) * 2;
  const room = inner - BAND_MARK - BAND_MARK_GAP - BAND_GAP - pill;

  return { beside: widestWord <= room, pillWraps: pill > inner };
}

/** The height of two upcoming rows, held while loading, failed or Finished so the panels below do not move; worked from the lines the rows are set in, not measured on one screen. */
export function rowsFloor(fontScale: number, pixelRatio: number | null): number {
  const line = (height: number) => drawnLine(height, fontScale, pixelRatio);
  const lines = line(SMALL_LINE) * 2 + line(TITLE_LINE);
  const row = lines + tokens.spaceMd * 2 + tokens.spaceXxs * 2 + tokens.spaceXxs * 2;

  return row * 2 + 1;
}

// Apple's Paste sets its word in Body, 17 at the default size; 10 above and below leaves room over a medium button's 7.
const PASTE_WORD = 17;
const PASTE_WORD_LINE = 1.25;
const PASTE_INSET = 10;

/** Apple's Paste draws nothing and takes no press once its word no longer fits: the field's height below the accessibility sizes, the word's from them on. */
export function pasteHeight(field: number, fontScale: number): number {
  if (!atAccessibilitySizes(fontScale)) return field;

  return Math.max(field, Math.ceil(PASTE_WORD * PASTE_WORD_LINE * fontScale + PASTE_INSET * 2));
}

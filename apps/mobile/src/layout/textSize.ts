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

/** Whether a text laid out as these lines was broken inside a word. */
export function breaksAWord(lines: readonly string[]): boolean {
  return lines.some(
    (line, index) =>
      index < lines.length - 1 && /[^\s\-‐]$/u.test(line) && /^[^\s]/u.test(lines[index + 1] ?? ''),
  );
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

export interface WordsFit {
  readonly key: string;
  readonly drawn: number;
}

/** A text drawn at `start`, until the text or its start changes. */
export function fitWords(fit: WordsFit | null, start: number, text: string): WordsFit {
  const key = `${start}|${text}`;

  return fit?.key === key ? fit : { key, drawn: start };
}

/** After a layout: a point smaller while a word is broken, never below the default size. */
export function settleWords(fit: WordsFit, size: number, lines: readonly string[]): WordsFit {
  if (fit.drawn <= size || !breaksAWord(lines)) return fit;

  return { key: fit.key, drawn: Math.max(size, fit.drawn - 1) };
}

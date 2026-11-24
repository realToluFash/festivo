import { type SideFit, type Widths, lettersIn } from './sidebarSize.ts';
import { piecesIn, wordsIn, wrapOf } from './textSize.ts';

/** A word's widths in the sidebar at a size and weight, shared by every sidebar the app draws, so one drawn anew after a turn fits its words as one launched on its side does (sc-90463). */
export interface SideWidths {
  width: (start: number, weight: string, piece: string) => number | undefined;
  /** Keeps a reading; a text laid out at no width says nothing of its word. */
  keep: (start: number, weight: string, piece: string, width: number) => void;
  /** Tells every sidebar of a reading that changed, whichever sidebar read it, so two sidebars measuring the same word both fit it. */
  subscribe: (listener: () => void) => () => void;
  version: () => number;
}

export function sideWidths(): SideWidths {
  const widths = new Map<string, number>();
  const listeners = new Set<() => void>();
  let version = 0;
  const at = (start: number, weight: string, piece: string) => `${start}|${weight}|${piece}`;

  return {
    width: (start, weight, piece) => widths.get(at(start, weight, piece)),
    keep: (start, weight, piece, width) => {
      const key = at(start, weight, piece);
      if (!(width > 0) || widths.get(key) === width) return;
      widths.set(key, width);
      version += 1;
      for (const listener of listeners) listener();
    },
    subscribe: (listener) => {
      listeners.add(listener);

      return () => listeners.delete(listener);
    },
    version: () => version,
  };
}

export const SIDE_WIDTHS = sideWidths();

/** The words of `text` a sidebar must measure, and their widths as `widths` holds them, or null until every one is known. */
export function sideReadings(
  widths: SideWidths,
  text: string,
  start: number,
  weight: string,
  fit: SideFit,
): { pieces: string[]; read: Widths | null } {
  const words = wordsIn([text]);
  const pieces = [...words, ...(fit === 'lines' ? piecesIn([text]) : [])];
  const whole = widths.width(start, weight, `\n${text}`);
  const known: Record<string, number> = {};
  for (const piece of pieces) {
    const read = widths.width(start, weight, piece);
    if (read != null) known[piece] = read;
  }
  if (whole == null || !pieces.every((piece) => known[piece] != null))
    return { pieces, read: null };

  return {
    pieces,
    read: {
      words: words.map((word) => ({ width: known[word] ?? 0, letters: lettersIn(word) })),
      whole: { width: whole, letters: lettersIn(text) },
      ...(fit === 'lines' ? { wrap: wrapOf(text, known, whole) } : {}),
    },
  };
}

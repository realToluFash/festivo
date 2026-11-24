/** A word's widths in the sidebar at a size and weight, shared by every sidebar the app draws, so one drawn anew after a turn fits its words as one launched on its side does (sc-90463). */
export interface SideWidths {
  width: (start: number, weight: string, piece: string) => number | undefined;
  /** Keeps a reading, saying whether it changed anything; a text laid out at no width says nothing of its word. */
  keep: (start: number, weight: string, piece: string, width: number) => boolean;
}

export function sideWidths(): SideWidths {
  const widths = new Map<string, number>();
  const at = (start: number, weight: string, piece: string) => `${start}|${weight}|${piece}`;

  return {
    width: (start, weight, piece) => widths.get(at(start, weight, piece)),
    keep: (start, weight, piece, width) => {
      const key = at(start, weight, piece);
      if (!(width > 0) || widths.get(key) === width) return false;
      widths.set(key, width);

      return true;
    },
  };
}

export const SIDE_WIDTHS = sideWidths();

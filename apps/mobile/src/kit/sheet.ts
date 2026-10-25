import type { EdgeInsets } from 'react-native-safe-area-context';
import { tokens } from '../theme/tokens.ts';

export interface SheetPadding {
  scrimTop: number;
  scrimLeft: number;
  scrimRight: number;
  frameBottom: number;
}

/** A phone's sheet is flush with the bottom and the side insets, a tablet's card clear of every edge (sc-8606). */
export function sheetPadding({
  phone,
  keysCover,
  insets,
}: {
  phone: boolean;
  /** How far the keys reach up into the sheet's window, or null while they are down. */
  keysCover: number | null;
  insets: EdgeInsets;
}): SheetPadding {
  if (phone) {
    return {
      scrimTop: insets.top,
      scrimLeft: insets.left,
      scrimRight: insets.right,
      // The card runs on under the keys, so a rounding of where they start shows card, never the screen behind (sc-9472).
      frameBottom: keysCover == null ? insets.bottom : Math.max(0, keysCover),
    };
  }

  return {
    scrimTop: Math.max(tokens.spaceXxl, insets.top),
    scrimLeft: Math.max(tokens.spaceXxl, insets.left),
    scrimRight: Math.max(tokens.spaceXxl, insets.right),
    frameBottom: 0,
  };
}

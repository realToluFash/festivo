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
  typing,
  insets,
}: {
  phone: boolean;
  typing: boolean;
  insets: EdgeInsets;
}): SheetPadding {
  if (phone) {
    return {
      scrimTop: insets.top,
      scrimLeft: insets.left,
      scrimRight: insets.right,
      // The keys cover the home indicator, so the footer meets them.
      frameBottom: typing ? 0 : insets.bottom,
    };
  }

  return {
    scrimTop: Math.max(tokens.spaceXxl, insets.top),
    scrimLeft: Math.max(tokens.spaceXxl, insets.left),
    scrimRight: Math.max(tokens.spaceXxl, insets.right),
    frameBottom: 0,
  };
}

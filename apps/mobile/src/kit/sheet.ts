import type { EdgeInsets } from 'react-native-safe-area-context';
import { tokens } from '../theme/tokens.ts';
import { keysOver } from './keyboard.ts';

/** On an Android phone the card itself runs on under the keys; everywhere else the avoiding view lifts it. */
export function sheetUnderKeys(os: string, phone: boolean): boolean {
  return phone && os === 'android';
}

/** How far the keys reach up into the sheet's window: null while they are down, 0 where the avoiding view lifts it. */
export function sheetKeysCover({
  underKeys,
  keysUp,
  windowHeight,
  keysTop,
}: {
  underKeys: boolean;
  keysUp: boolean;
  windowHeight: number | null;
  keysTop: number | null;
}): number | null {
  if (!keysUp) return null;
  if (!underKeys || windowHeight == null) return 0;

  return keysOver({ y: 0, height: windowHeight }, keysTop);
}

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
      frameBottom: keysCover ?? insets.bottom,
    };
  }

  return {
    scrimTop: Math.max(tokens.spaceXxl, insets.top),
    scrimLeft: Math.max(tokens.spaceXxl, insets.left),
    scrimRight: Math.max(tokens.spaceXxl, insets.right),
    frameBottom: 0,
  };
}

/** Which sheets have their own window up, so a sheet opened as another leaves waits for that window to go (sc-23267). */
export interface SheetWindows {
  raise: (id: string) => void;
  lower: (id: string) => void;
  /** True while another sheet's window is up and this one's is not. */
  waits: (id: string) => boolean;
  subscribe: (heard: () => void) => () => void;
}

export function sheetWindows(): SheetWindows {
  const up = new Set<string>();
  const listeners = new Set<() => void>();
  const told = () => listeners.forEach((heard) => heard());

  return {
    raise: (id) => {
      if (up.has(id)) return;
      up.add(id);
      told();
    },
    lower: (id) => {
      if (up.delete(id)) told();
    },
    waits: (id) => !up.has(id) && up.size > 0,
    subscribe: (heard) => {
      listeners.add(heard);
      return () => listeners.delete(heard);
    },
  };
}

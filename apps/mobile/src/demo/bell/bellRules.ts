import { sidePadding } from '../../components/bodyEdges.ts';
import { tokens } from '../../theme/tokens.ts';

export type BellAt = 'top' | 'scrolled';

export interface BellStart {
  ask: boolean;
  at: BellAt;
}

export function bellStartOf(ask: string | undefined, at: string | undefined): BellStart {
  return { ask: ask === 'shown', at: at === 'scrolled' ? 'scrolled' : 'top' };
}

/** The B frame's row with Back and Mark all read, as BellParts' `bellTop` draws it. */
export const TOP_ROW = 48;

const SIDE = tokens.spaceXxl;

type Sides = { left: number; right: number };

/** The B frame's 20 at each side, moved in past Android's bar or the Dynamic Island on its side (sc-54891); upright the insets are 0. */
export function frameSides(insets: Sides): { paddingLeft: number; paddingRight: number } {
  return sidePadding(SIDE, insets);
}

/** Only the status bar and the row with Back and Mark all read stay above the list; the title scrolls with it. */
export function fixedAbove(insets: { top: number }): number {
  return insets.top + TOP_ROW;
}

export interface ListRoom {
  /** From the foot of what stays above the list to the foot of the screen's safe area, as the AC measures it; the B frame has no tab bar. */
  list: number;
  /** Half the screen's height, the least the list may have on its side. */
  least: number;
}

export function listRoom(height: number, above: number, below: number): ListRoom {
  return { list: height - above - below, least: Math.ceil(height / 2) };
}

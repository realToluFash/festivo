import { atAccessibilitySizes } from '../../layout/textSize.ts';
import { tokens } from '../../theme/tokens.ts';

export type TopScreen = 'settings' | 'events' | 'calendar';

export const TOP_SCREENS: readonly { key: TopScreen; label: string }[] = [
  { key: 'settings', label: 'Settings' },
  { key: 'events', label: 'Events' },
  { key: 'calendar', label: 'Calendar' },
];

/** Main's white pill: the name at 15, the invitation line at 12.5. */
export const TOP_PILL_NAME = 15;
export const TOP_PILL_WAITING = 12.5;

const CARET = 14;
const RING = 11;
// Search and the bell, 44 each with 8 between (`SearchAndBell`).
const ENDS = tokens.sizeHit + tokens.spaceSm + tokens.sizeHit;
// The pill, the row's spacer and the ends, 8 apart (`PillRow`).
const ROW_GAPS = 2 * tokens.spaceSm;

/** What the pill draws around its name: its start, a gap, the caret and its end; the tile too below AX1, as main's pill is bare from AX1. */
export function topPillChrome(scale: number): number {
  const tile = atAccessibilitySizes(scale) ? 0 : 28 + tokens.spaceSm;

  return tokens.spaceSm + tile + tokens.spaceSm + CARET + tokens.spacePillEnd;
}

/** The name's line in the white pill, from the phone's row between its sides: 206 from AX1 on an iPhone 17 Pro (362). */
export function topPillNameRoom(row: number, scale: number): number {
  return Math.max(row - ENDS - ROW_GAPS - topPillChrome(scale), 0);
}

/** The invitation line's room: the name's, less its ring and the gap after it. */
export function topPillWaitingRoom(row: number, scale: number): number {
  return Math.max(topPillNameRoom(row, scale) - RING - tokens.spaceXs, 0);
}

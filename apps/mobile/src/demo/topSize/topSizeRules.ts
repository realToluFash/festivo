import { PILL_CHROME, phoneNameRoom, phoneWaitingRoom } from '../../layout/pillFit.ts';
import { atAccessibilitySizes } from '../../layout/textSize.ts';
import { tokens } from '../../theme/tokens.ts';

export type TopScreen = 'settings' | 'events' | 'calendar';

export const TOP_SCREENS: readonly { key: TopScreen; label: string }[] = [
  { key: 'settings', label: 'Settings' },
  { key: 'events', label: 'Events' },
  { key: 'calendar', label: 'Calendar' },
];

/** The tile and the gap after it, which main's white pill drops from AX1. */
const TILE = 28 + tokens.spaceSm;

/** What the pill draws around its name (`PILL_CHROME`), less the tile from AX1, where main's white pill is bare. */
export function topPillChrome(scale: number): number {
  return PILL_CHROME - (atAccessibilitySizes(scale) ? TILE : 0);
}

/** The name's line, by Today's phone rule (`phoneNameRoom`) from the row and its measured ends, the tile's room given back where the pill is bare: 206 from AX1 on an iPhone 17 Pro (362) with Search and the bell, 258 with the bell alone. */
export function topPillNameRoom(row: number, ends: number, scale: number): number {
  return phoneNameRoom(row + PILL_CHROME - topPillChrome(scale), ends);
}

/** The invitation line's room, by Today's phone rule (`phoneWaitingRoom`). */
export function topPillWaitingRoom(row: number, ends: number, scale: number): number {
  return phoneWaitingRoom(topPillNameRoom(row, ends, scale));
}

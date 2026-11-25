import { tokens } from '../../theme/tokens.ts';
import { wordsSize, wordsStart } from '../todaySize/todaySizeRules.ts';

export type BellLanguage = 'en' | 'es' | 'fr' | 'pt';
export type BellRead = 'some' | 'all';

export const BELL_LANGUAGES: readonly { key: BellLanguage; label: string }[] = [
  { key: 'en', label: 'English' },
  { key: 'es', label: 'Spanish' },
  { key: 'fr', label: 'French' },
  { key: 'pt', label: 'Portuguese' },
];

export const BELL_READS: readonly { key: BellRead; label: string }[] = [
  { key: 'some', label: 'Some unread' },
  { key: 'all', label: 'All read' },
];

/** The panel's heading and Mark all read at the default size, as `BellFrame` draws them. */
export const HEADING = 18;
export const MARK_ALL = 15;

/** Between the heading and Mark all read on one row, as `BellFrame`'s top row. */
export const BESIDE_GAP = tokens.spaceSm;

/** Mark all read's 44 tap area under the heading's line, with this between. */
export const UNDER_GAP = tokens.spaceXxs;

// Mark all read grows with the text size as main does, under no title's cap; the heading's size is `FitWords`'s, given the same no cap.
const NO_CAP = Number.POSITIVE_INFINITY;

export function markAllStart(scale: number): number {
  return wordsStart(MARK_ALL, scale, NO_CAP);
}

/** Mark all read's size: main's at every size, from AX1 the largest at which its widest word fits the panel's top, never under 15. */
export function markAllSize(scale: number, widest: number, room: number): number {
  return wordsSize(MARK_ALL, scale, NO_CAP, widest, room);
}

/** Widths measured at the sizes drawn; zero until measured. */
export interface BellTop {
  room: number;
  heading: number;
  markAll: number;
}

/** Mark all read moves under the heading wherever the heading and Mark all read, each whole on one line, cannot share the row; the heading never steps down to make room (sc-92580, the web's rule from sc-21358). */
export function markAllUnder({ room, heading, markAll }: BellTop): boolean {
  if (room <= 0 || heading <= 0 || markAll <= 0) return false;

  return heading + BESIDE_GAP + markAll > room;
}

import { BELL_MARK_ALL } from '../../components/bellTop.ts';
import { atAccessibilitySizes } from '../../layout/textSize.ts';
import { tokens } from '../../theme/tokens.ts';
import { wordsSize, wordsStart } from '../todaySize/todaySizeRules.ts';

export type BellLanguage = 'en' | 'es' | 'fr' | 'pt';
export type BellRead = 'some' | 'all' | 'none';

export const BELL_LANGUAGES: readonly { key: BellLanguage; label: string }[] = [
  { key: 'en', label: 'English' },
  { key: 'es', label: 'Spanish' },
  { key: 'fr', label: 'French' },
  { key: 'pt', label: 'Portuguese' },
];

export const BELL_READS: readonly { key: BellRead; label: string }[] = [
  { key: 'some', label: 'Some unread' },
  { key: 'all', label: 'All read' },
  { key: 'none', label: 'Nothing yet' },
];

export {
  BELL_BESIDE_GAP as BESIDE_GAP,
  BELL_HEADING as HEADING,
  BELL_MARK_ALL as MARK_ALL,
  BELL_UNDER_GAP as UNDER_GAP,
  markAllSize,
  markAllUnder,
} from '../../components/bellTop.ts';

export function markAllStart(scale: number): number {
  return wordsStart(BELL_MARK_ALL, scale, Number.POSITIVE_INFINITY);
}

/** The phone's bell screen title on main (BellParts): 30 bold, lines at 1.12, tracked -0.6, which is -0.02 of its size. */
export const PHONE_TITLE = 30;
export const PHONE_TITLE_LINE = 1.12;
export const PHONE_TITLE_TRACKING = -0.02;

/** sc-92959: main's size below AX1; from AX1 the largest at which the word, measured at its start, fits `room`, never under 30 and with no cap. */
export function phoneTitleSize(scale: number, width: number, room: number): number {
  return wordsSize(PHONE_TITLE, scale, Number.POSITIVE_INFINITY, width, room);
}

/** The empty sentence on main (BellBody): 15, beside a 40 bell tile with 12 between. */
export const EMPTY_SENTENCE = 15;
export const EMPTY_TILE = 40;
export const EMPTY_GAP = tokens.spaceLg;

/** sc-94028: from AX1 the tile moves onto its own line above the sentence where the sentence's widest word, at its grown size, cannot fit beside it; below AX1 never. */
export function emptyTileAbove(scale: number, widest: number, room: number): boolean {
  return atAccessibilitySizes(scale) && widest > room - EMPTY_TILE - EMPTY_GAP;
}

/** sc-94028: main's size below AX1; from AX1 the largest at which the widest word fits the sentence's line, never under 15 and with no cap. */
export function emptySentenceSize(scale: number, widest: number, room: number): number {
  const line = emptyTileAbove(scale, widest, room) ? room : room - EMPTY_TILE - EMPTY_GAP;

  return wordsSize(EMPTY_SENTENCE, scale, Number.POSITIVE_INFINITY, widest, Math.max(line, 1));
}

export function emptyStart(scale: number): number {
  return wordsStart(EMPTY_SENTENCE, scale, Number.POSITIVE_INFINITY);
}

/** Notification settings at the panel's foot on main (BellBody's TextAction): 15 semibold. */
export const SETTINGS_LINK = 15;

/** sc-94028: the sentence's rule for Notification settings: main's size below AX1; from AX1 the largest at which its widest word fits the body's line, never under 15 and with no cap. */
export function settingsSize(scale: number, widest: number, room: number): number {
  return wordsSize(SETTINGS_LINK, scale, Number.POSITIVE_INFINITY, widest, Math.max(room, 1));
}

export function settingsStart(scale: number): number {
  return wordsStart(SETTINGS_LINK, scale, Number.POSITIVE_INFINITY);
}

import {
  BELL_MARK_ALL,
  EMPTY_SENTENCE,
  PHONE_TITLE,
  SETTINGS_LINK,
} from '../../components/bellTop.ts';
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
  PHONE_TITLE,
  PHONE_TITLE_LINE,
  PHONE_TITLE_TRACKING,
} from '../../components/bellTop.ts';

export function markAllStart(scale: number): number {
  return wordsStart(BELL_MARK_ALL, scale, Number.POSITIVE_INFINITY);
}

/** sc-92959: main's size below AX1; from AX1 the largest at which the word, measured at its start, fits `room`, never under 30 and with no cap. */
export function phoneTitleSize(scale: number, width: number, room: number): number {
  return wordsSize(PHONE_TITLE, scale, Number.POSITIVE_INFINITY, width, room);
}

export {
  EMPTY_GAP,
  EMPTY_SENTENCE,
  EMPTY_TILE,
  emptySentenceSize,
  emptyTileAbove,
  SETTINGS_LINK,
  settingsSize,
} from '../../components/bellTop.ts';

export function emptyStart(scale: number): number {
  return wordsStart(EMPTY_SENTENCE, scale, Number.POSITIVE_INFINITY);
}

export function settingsStart(scale: number): number {
  return wordsStart(SETTINGS_LINK, scale, Number.POSITIVE_INFINITY);
}

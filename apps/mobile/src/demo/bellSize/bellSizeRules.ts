import { BELL_MARK_ALL } from '../../components/bellTop.ts';
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

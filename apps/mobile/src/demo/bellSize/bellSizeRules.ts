import { BELL_MARK_ALL } from '../../components/bellTop.ts';
import { wordsStart } from '../todaySize/todaySizeRules.ts';

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

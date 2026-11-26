export {
  BAND_CLEAR,
  BAND_LINE,
  BAND_TALLEST,
  BAND_TITLE,
  type BandRow,
  type BandTitle,
  bandLine,
  bandRoom,
  bandStart,
  bandTitle,
} from '../../layout/bandTitle.ts';

export type BandMoment = 'quiet' | 'day';

export const BAND_MOMENTS: readonly { key: BandMoment; label: string }[] = [
  { key: 'quiet', label: 'No event today' },
  { key: 'day', label: 'During an event’s day' },
];

export function bandMomentOf(given: string | undefined): BandMoment {
  return given === 'day' ? 'day' : 'quiet';
}

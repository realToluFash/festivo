import { tokens } from '../theme/tokens.ts';

export const TAG_MARK = 12;
export const TAG_END = 9;
export const TAG_GAP = 5;

/** What a row's tag draws around its words across its line: its two ends, its ring, and each mark with the gap after it (sc-90472). */
export function tagChrome(words: { marks: number; turning: boolean; ringed: boolean }): number {
  const gap = words.turning ? tokens.spaceXs : TAG_GAP;
  const start = words.marks === 0 ? TAG_END : 7;

  return start + TAG_END + (words.ringed ? 2 : 0) + words.marks * (TAG_MARK + gap);
}

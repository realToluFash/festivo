import { brand } from '../theme/brand.ts';
import { tokens } from '../theme/tokens.ts';

/** iOS's own Apple button scaled so its words are `text` points, the logo and its gap kept in proportion. */
export function appleIosSize(text: number): { text: number; logoHeight: number; gap: number } {
  const shrink = text / (tokens.sizeHitPhonePrimary * brand.appleTitleToHeight);

  return { text, logoHeight: brand.appleLogoHeight * shrink, gap: brand.appleLogoGap * shrink };
}

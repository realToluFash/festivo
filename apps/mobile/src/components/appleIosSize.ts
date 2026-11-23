import { brand } from '../theme/brand.ts';
import { tokens } from '../theme/tokens.ts';

/** iOS's own Apple button scaled so its words are `text` points, the logo and its gap kept in proportion. */
export function appleIosSize(text: number): { text: number; logoHeight: number; gap: number } {
  const shrink = text / (tokens.sizeHitPhonePrimary * brand.appleTitleToHeight);

  return { text, logoHeight: brand.appleLogoHeight * shrink, gap: brand.appleLogoGap * shrink };
}

export const APPLE_IOS_LOGO_WIDTH = 15.46;
export const APPLE_IOS_LOGO_HEIGHT = 19;
export const APPLE_IOS_CHROME = 2 * (tokens.spaceXxl + 1);
export const APPLE_IOS_PAD = tokens.spaceSm + 1;

/** The logo's width and its gap per point of the words, the room beside them that decides whether the longest word stays whole (sc-84920). */
export function appleIosGlyph(): number {
  const perPoint = appleIosSize(1);

  return (perPoint.logoHeight * APPLE_IOS_LOGO_WIDTH) / APPLE_IOS_LOGO_HEIGHT + perPoint.gap;
}

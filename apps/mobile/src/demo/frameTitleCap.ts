import { frameTitleSize, titleSize } from '../layout/textSize.ts';

/** The size the frame's title draws at, as AppFrame chooses it, which caps a page's words under it. */
export function frameTitleCap(tablet: boolean, shortSide: number, scale: number): number {
  return titleSize(frameTitleSize(tablet, shortSide), scale);
}

import { tokens } from '../../theme/tokens.ts';

/** The room each side of the door's title keeps: the back pill, its inset and a gap, mirrored on the right. */
export function navSide(back: number): number {
  return tokens.spaceSm + back + tokens.spaceXl;
}

/** Until all three are measured the title stays beside the pill; after that it stays only while it fits between the pill and its mirror. */
export function titleBeside({
  width,
  back,
  title,
}: {
  width: number;
  back: number;
  title: number;
}): boolean {
  if (width === 0 || back === 0 || title === 0) return true;

  return title <= width - 2 * navSide(back);
}

import { atAccessibilitySizes } from '../layout/textSize.ts';
import { tokens } from '../theme/tokens.ts';

export const TILE = 232;
const TILE_PEEK = 40;

/** From AX1 a tile is the phone's width less its gutters and 40 of the next tile, so its words have room and the row still reads as one to swipe (sc-92090). */
export function tileWidth(fontScale: number, window: number): number {
  return atAccessibilitySizes(fontScale)
    ? Math.max(TILE, window - 2 * tokens.spaceXxl - TILE_PEEK)
    : TILE;
}

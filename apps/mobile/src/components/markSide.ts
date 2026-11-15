import { useWindowDimensions } from 'react-native';

/** The box of a mark that holds a glyph, grown with the system text size as the glyph in it is. */
export function useMarkSide(side: number, maxScale = Infinity): { width: number; height: number } {
  const scale = Math.min(useWindowDimensions().fontScale, maxScale);

  return { width: side * scale, height: side * scale };
}

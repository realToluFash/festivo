import { useWindowDimensions } from 'react-native';

/** The box of a mark that holds a glyph, grown with the system text size as the glyph in it is. */
export function useMarkSide(side: number): { width: number; height: number } {
  const { fontScale } = useWindowDimensions();

  return { width: side * fontScale, height: side * fontScale };
}

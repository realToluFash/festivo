/** Android's end ellipsis. */
export const ELLIPSIS = '…';

export function endCuts(text: string): string[] {
  const characters = Array.from(text);
  return characters.map((_, kept) => `${characters.slice(0, kept).join('')}${ELLIPSIS}`);
}

export function endCutWidth(
  text: string,
  box: number,
  widthOf: (text: string) => number | undefined,
): number | null {
  const whole = widthOf(text);
  if (whole == null) return null;
  if (whole <= box) return whole;
  let widest = 0;
  for (const cut of endCuts(text)) {
    const width = widthOf(cut);
    if (width == null) return null;
    if (width <= box) widest = Math.max(widest, width);
  }
  return widest;
}

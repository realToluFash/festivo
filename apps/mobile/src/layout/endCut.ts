const ELLIPSIS = '…';

export function endCuts(text: string): string[] {
  const characters = Array.from(text);
  return characters.map((_, kept) => `${characters.slice(0, kept).join('')}${ELLIPSIS}`);
}

export function endCut(
  text: string,
  box: number,
  widthOf: (text: string) => number | undefined,
): string | null {
  const whole = widthOf(text);
  if (whole == null) return null;
  if (whole <= box) return text;
  let longest = ELLIPSIS;
  for (const cut of endCuts(text)) {
    const width = widthOf(cut);
    if (width == null) return null;
    if (width <= box) longest = cut;
  }
  return longest;
}

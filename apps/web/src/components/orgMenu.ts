/** The switcher shows a search once more than this many organisations are listed. */
export const SEARCH_FROM = 15;

export function fold(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase();
}

export function holds(name: string, query: string): boolean {
  return fold(name).includes(fold(query.trim()));
}

/** As many columns as keep a cell 112 wide with 4 between: CSS's `repeat(auto-fill, minmax(112px, 1fr))`. */
export function columnsOf(width: number): number {
  return width <= 0 ? 4 : Math.max(1, Math.floor((width + 4) / 116));
}

/** Where Up, Down, Left, Right, Home and End move in a grid of `count` places, `across` to a row. */
export function stepTo(key: string, at: number, count: number, across: number): number | null {
  const last = count - 1;

  if (key === 'ArrowLeft') return Math.max(0, at - 1);
  if (key === 'ArrowRight') return Math.min(last, at + 1);
  if (key === 'Home') return 0;
  if (key === 'End') return last;
  if (key === 'ArrowUp') return at - across >= 0 ? at - across : at;
  if (key === 'ArrowDown') {
    if (at + across <= last) return at + across;

    return Math.floor(at / across) < Math.floor(last / across) ? last : at;
  }

  return null;
}

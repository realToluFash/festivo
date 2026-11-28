/** An email address as its two sides, each cut before its dots, with the @ and the character before it held apart so they end a line together; null for anything else, a mobile number or a name (sc-91529). */
export function addressSides(
  text: string,
): { local: readonly string[]; at: string; domain: readonly string[] } | null {
  const at = text.lastIndexOf('@');
  if (at <= 0 || at === text.length - 1 || /\s/u.test(text)) return null;

  return {
    local: beforeDots(text.slice(0, at - 1)),
    at: text.slice(at - 1, at + 1),
    domain: beforeDots(text.slice(at + 1)),
  };
}

function beforeDots(side: string): string[] {
  return side === '' ? [] : side.split(/(?=\.)/u);
}

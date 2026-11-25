/** An email address as its two sides, `local@` and the domain, each cut before its dots; null for anything else, a mobile number or a name (sc-91529). */
export function addressSides(
  text: string,
): { local: readonly string[]; domain: readonly string[] } | null {
  const at = text.lastIndexOf('@');
  if (at <= 0 || at === text.length - 1 || /\s/u.test(text)) return null;

  return { local: beforeDots(text.slice(0, at + 1)), domain: beforeDots(text.slice(at + 1)) };
}

function beforeDots(side: string): string[] {
  return side.split(/(?=\.)/u);
}

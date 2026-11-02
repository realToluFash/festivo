const QUOTES: Readonly<Record<string, string>> = { '‘': "'", '’': "'", '“': '"', '”': '"' };

/** The API's TypedName rule, so the screen refuses exactly what the API would. */
export function typedNameMatches(typed: string, name: string): boolean {
  return canonical(typed) === canonical(name);
}

function canonical(value: string): string {
  return value
    .trim()
    .normalize('NFC')
    .replace(/[‘’“”]/g, (quote) => QUOTES[quote] ?? quote);
}

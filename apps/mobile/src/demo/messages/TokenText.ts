/** An inserted token's two edges: a word joiner, which no key types, so braces the host types stay text (sc-3960, pm 7 Nov). */
export const EDGE = '⁠';

const NAMES = 'Greeting|Event|Date|Hosts';
export const TOKEN_RUN = new RegExp(`${EDGE}(${NAMES})${EDGE}`, 'gu');
export const TOKEN_SPLIT = new RegExp(`(${EDGE}(?:${NAMES})${EDGE})`, 'u');

export function tokenText(token: string): string {
  return `${EDGE}${token}${EDGE}`;
}

/** Where each inserted token sits in the text, its edges included. */
export function tokenSpans(text: string): { from: number; to: number }[] {
  return [...text.matchAll(TOKEN_RUN)].map((match) => ({
    from: match.index,
    to: match.index + match[0].length,
  }));
}

/** The caret moved out of a token, to its nearer edge. */
export function outsideToken(text: string, at: number): number {
  const span = tokenSpans(text).find(({ from, to }) => at > from && at < to);
  if (span == null) return at;

  return at - span.from <= span.to - at ? span.from : span.to;
}

/** An edit that touches a token takes all of it; a key typed inside one lands after it. */
export function keepWhole(was: string, next: string): { text: string; caret: number } {
  let from = 0;
  const most = Math.min(was.length, next.length);
  while (from < most && was[from] === next[from]) from += 1;
  let back = 0;
  while (back < most - from && was[was.length - 1 - back] === next[next.length - 1 - back])
    back += 1;

  let start = from;
  let end = was.length - back;
  const typed = next.slice(from, next.length - back).replaceAll(EDGE, '');
  for (const span of tokenSpans(was)) {
    if (end > start ? span.from < end && span.to > start : start > span.from && start < span.to) {
      if (end > start) {
        start = Math.min(start, span.from);
        end = Math.max(end, span.to);
      } else {
        start = span.to;
        end = span.to;
      }
    }
  }
  const text = `${was.slice(0, start)}${typed}${was.slice(end)}`;

  return { text, caret: start + typed.length };
}

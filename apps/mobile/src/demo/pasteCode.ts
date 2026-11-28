/** sc-99215: what Paste code finds in what was copied, and the line it says when it finds nothing. */

export const NOTHING_TO_PASTE =
  'Nothing to paste. Copy the code from WhatsApp or your texts, then try again.';

export const PASTE_CODE = 'Paste code';

const GROUP = /(\d{3})[ -]?(\d{3})/y;

function isDigit(char: string | undefined): boolean {
  return char !== undefined && char >= '0' && char <= '9';
}

function joinedBefore(text: string, start: number): boolean {
  if (isDigit(text[start - 1])) return true;
  const gap = text[start - 1];
  return (gap === ' ' || gap === '-') && isDigit(text[start - 2]);
}

function joinedAfter(text: string, end: number): boolean {
  if (isDigit(text[end])) return true;
  const gap = text[end];
  return (gap === ' ' || gap === '-') && isDigit(text[end + 1]);
}

/** The six digits when the copied text holds exactly one code, written once or repeated; null otherwise. */
export function codeInPaste(text: string): string | null {
  const found = new Set<string>();

  for (let at = 0; at < text.length; at += 1) {
    GROUP.lastIndex = at;
    const match = GROUP.exec(text);
    if (match === null) continue;
    const end = at + match[0].length;
    if (joinedBefore(text, at) || joinedAfter(text, end)) continue;
    found.add(`${match[1]}${match[2]}`);
  }

  return found.size === 1 ? ([...found][0] ?? null) : null;
}

/** What a client may check before sending: a field is there, and an email has the shape of one. Never taken, breached or wrong. */
export function emailProblem(typed: string): 'blank' | 'shape' | null {
  const address = typed.trim();

  if (address === '') return 'blank';

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(address) ? null : 'shape';
}

/** A pasted code often carries spaces; they are not part of it. */
export function cleanCode(typed: string): string {
  return typed.replace(/\s/gu, '');
}

/** Only the digits of what was typed or pasted, at most a code's six. */
export function codeDigits(typed: string): string {
  return typed.replace(/\D/gu, '').slice(0, 6);
}

/** A verification code is six digits, checked after the spaces are taken out. */
export function codeProblem(typed: string): 'blank' | 'short' | null {
  const code = cleanCode(typed);

  if (code === '') return 'blank';

  return /^\d{6}$/u.test(code) ? null : 'short';
}

/** An authenticator key as it is shown, in groups of four, so it can be typed without losing place. */
export function keyInGroups(secret: string): string {
  return secret.replace(/(.{4})(?=.)/gu, '$1 ');
}

const CODE_GROUP = /(\d{3})[ -]?(\d{3})/y;

function isDigit(char: string | undefined): boolean {
  return char !== undefined && char >= '0' && char <= '9';
}

function joinsDigit(char: string | undefined, beyond: string | undefined): boolean {
  return isDigit(char) || ((char === ' ' || char === '-') && isDigit(beyond));
}

/** The six digits when copied text holds exactly one code, written once or repeated; null otherwise. A group that is part of a longer number is not a code. */
export function codeInPaste(text: string): string | null {
  const found = new Set<string>();

  for (let at = 0; at < text.length; at += 1) {
    CODE_GROUP.lastIndex = at;
    const match = CODE_GROUP.exec(text);
    if (match === null) continue;
    const end = at + match[0].length;
    if (joinsDigit(text[at - 1], text[at - 2]) || joinsDigit(text[end], text[end + 1])) continue;
    found.add(`${match[1]}${match[2]}`);
  }

  return found.size === 1 ? ([...found][0] ?? null) : null;
}

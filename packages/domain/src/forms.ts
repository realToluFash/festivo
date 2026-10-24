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

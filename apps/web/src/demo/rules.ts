import {
  PASSWORD_MINIMUM_LENGTH,
  callingCode,
  countryChoices,
  emailProblem,
  formatDay,
  formatTimeOfDay,
  meetsPasswordLength,
  phoneLengthProblem,
} from '@soirely/domain';

/** What the demo is filled with and answers to. Nothing here reaches the API. */
export const SAMPLE = {
  email: 'folake@ire.events',
  password: 'correct horse battery',
  organisation: 'Ire Events',
  name: 'Folake Adeyemi',
  /** The right code from the email and from the phone. */
  code: '482913',
  country: 'GB',
  number: '7400 123456',
  /** The authenticator's code, and the recovery codes: one unused, one used already. */
  authenticator: '714302',
  recovery: 'vtxp-rh7y',
  usedRecovery: 'k3m9-q2wd',
  /** Refused as a known breach, as the API refuses one. */
  breachedPassword: 'passwordpassword',
} as const;

export const CODE_LENGTH = 6;
export const RESEND_SECONDS = 60;

export const TRIES = 5;
export const LOCK_MS = 60_000;

export type FieldLines = { email?: string; password?: string };

export function emailLine(email: string): string | null {
  const problem = emailProblem(email);

  if (problem == null) return null;

  return problem === 'blank'
    ? 'Enter your email address.'
    : 'That does not look like an email address. Check it has an @ and a domain.';
}

export function fieldLines(email: string, password: string): FieldLines {
  const lines: FieldLines = {};
  const line = emailLine(email);

  if (line != null) lines.email = line;
  if (password === '') lines.password = 'Enter your password.';

  return lines;
}

export function samplePair(email: string, password: string): boolean {
  return email.trim().toLowerCase() === SAMPLE.email && password === SAMPLE.password;
}

/** The refusal count after one more, and when sign-in opens again if that one locked it. */
export function refuse(
  refusals: number,
  now: number,
): { refusals: number; liftsAt: number | null } {
  const next = refusals + 1;

  return next >= TRIES
    ? { refusals: 0, liftsAt: now + LOCK_MS }
    : { refusals: next, liftsAt: null };
}

export function timeOfDay(at: number): string {
  return formatTimeOfDay(new Date(at), 'en-GB');
}

export function dayOfTime(at: number): string {
  return formatDay(new Date(at), 'en-GB');
}

export type AccountLines = { name?: string; email?: string; password?: string };

/** Create your account's checks before anything is sent. */
export function accountLines(name: string, email: string, password: string): AccountLines {
  const lines: AccountLines = {};
  const emailRefusal = emailLine(email);

  if (name.trim() === '') lines.name = 'Enter your full name.';
  if (emailRefusal != null) lines.email = emailRefusal;
  if (password === '') lines.password = 'Enter a password.';
  else if (!meetsPasswordLength(password))
    lines.password = `Use at least ${PASSWORD_MINIMUM_LENGTH} characters.`;

  return lines;
}

/** Only the digits of what was typed or pasted, at most a code's length. */
export function codeDigits(typed: string): string {
  return typed.replace(/\D/g, '').slice(0, CODE_LENGTH);
}

/** Lower case, letters and digits, the dash put in after the fourth: "VTXPRH7Y" is "vtxp-rh7y". */
export function shapeRecovery(typed: string): string {
  const plain = typed
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 8);

  return plain.length > 4 ? `${plain.slice(0, 4)}-${plain.slice(4)}` : plain;
}

export function codeLine(code: string, from: string): string | null {
  if (code === '') return `Enter the ${CODE_LENGTH}-digit code from ${from}.`;
  if (code.length < CODE_LENGTH) return `The code is ${CODE_LENGTH} digits.`;

  return null;
}

export const COUNTRIES = countryChoices('en');

export function countryName(code: string): string {
  return COUNTRIES.find((each) => each.code === code)?.name ?? code;
}

/** "+44 United Kingdom", the compact code beside the number. */
export function codeChoice(code: string): string {
  return `${callingCode(code) ?? ''} ${countryName(code)}`.trim();
}

/** The number's refusal, or null; a blank number is refused only where it is not optional. */
export function numberLine(typed: string, country: string, optional: boolean): string | null {
  const problem = phoneLengthProblem(typed, country);

  if (problem == null || (problem === 'blank' && optional)) return null;
  if (problem === 'blank') return 'Enter your mobile number.';
  if (problem === 'noCountry') return 'Choose a country.';

  const length = problem === 'tooShort' ? 'short' : 'long';

  return `That number looks too ${length} for ${countryName(country)}. Check it and try again.`;
}

export function fullNumber(typed: string, country: string): string {
  return `${callingCode(country) ?? ''} ${typed.trim()}`.trim();
}

/** A page of the create-account board, and one of its states. */
export const at = (page: string, state?: string) =>
  `/demo/create-account?page=${page}${state == null ? '' : `&state=${state}`}`;

/** The board's pages as the demo's home lists them, each with its states. */
export const NEW_ACCOUNT_PAGES: { name: string; states: { name: string; to: string }[] }[] = [
  {
    name: 'Create your account',
    states: [
      { name: 'First visit', to: at('register') },
      { name: 'Left blank', to: at('register', 'blank') },
      { name: 'Too short', to: at('register', 'short') },
      { name: 'A breached password', to: at('register', 'breached') },
      { name: 'Too many sign-ups', to: at('register', 'limited') },
    ],
  },
  {
    name: 'The email code',
    states: [
      { name: 'Check your email', to: at('email') },
      { name: 'A wrong code', to: at('email', 'wrong') },
      { name: 'The code has expired', to: at('email', 'expired') },
      { name: 'Too many wrong tries', to: at('email', 'exhausted') },
      { name: 'Email verified', to: at('email', 'verified') },
    ],
  },
  {
    name: 'A few details',
    states: [
      { name: 'A few details', to: at('details') },
      { name: 'Refused', to: at('details', 'refused') },
    ],
  },
  {
    name: 'The phone code',
    states: [
      { name: 'WhatsApp', to: at('phone') },
      { name: 'Texted instead', to: at('phone', 'texted') },
      { name: 'Number verified', to: at('phone', 'verified') },
    ],
  },
  {
    name: 'Change your mobile number',
    states: [{ name: 'Change your mobile number', to: at('change') }],
  },
  {
    name: 'Every page',
    states: [
      { name: 'Loading', to: at('register', 'loading') },
      { name: 'Cannot reach Soirely, signed out', to: at('register', 'offline') },
      { name: 'Cannot reach Soirely, signed in', to: at('email', 'offline') },
    ],
  },
];

/** A page of the two-factor board, and one of its states. */
export const twoFactorAt = (page: string, state?: string) =>
  `/demo/two-factor?page=${page}${state == null ? '' : `&state=${state}`}`;

export const TWO_FACTOR_PAGES: { name: string; states: { name: string; to: string }[] }[] = [
  {
    name: 'Enter your code',
    states: [
      { name: 'Enter your code', to: twoFactorAt('code') },
      { name: 'A wrong code', to: twoFactorAt('code', 'wrong') },
      { name: 'Too many wrong codes', to: twoFactorAt('code', 'paused') },
    ],
  },
  {
    name: 'A recovery code',
    states: [
      { name: 'Enter a recovery code', to: twoFactorAt('recovery') },
      { name: 'A used code', to: twoFactorAt('recovery', 'used') },
    ],
  },
  {
    name: 'Lost authenticator',
    states: [
      { name: 'Start', to: twoFactorAt('start') },
      { name: 'Too many requests', to: twoFactorAt('start', 'limited') },
      { name: 'Both codes', to: twoFactorAt('codes') },
      { name: 'Only the email’s code', to: twoFactorAt('codes', 'email-only') },
    ],
  },
  {
    name: 'Once asked',
    states: [
      { name: 'Waiting for your organisation', to: twoFactorAt('waiting') },
      { name: 'Two-factor is off', to: twoFactorAt('off') },
      { name: 'Turned down', to: twoFactorAt('turned-down') },
      { name: 'Ended', to: twoFactorAt('ended') },
      { name: 'Cancelled', to: twoFactorAt('cancelled') },
      { name: 'Replaced', to: twoFactorAt('replaced') },
    ],
  },
  {
    name: 'After getting back in',
    states: [
      { name: 'Set up two-factor again', to: twoFactorAt('setup') },
      { name: 'This wasn’t you?', to: twoFactorAt('not-me') },
      { name: 'Cancelled and signed out', to: twoFactorAt('not-me', 'done') },
    ],
  },
];

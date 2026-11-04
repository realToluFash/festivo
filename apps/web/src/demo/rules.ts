import { emailProblem, formatTimeOfDay } from '@soirely/domain';

/** What the demo is filled with and answers to. Nothing here reaches the API. */
export const SAMPLE = {
  email: 'folake@ire.events',
  password: 'correct horse battery',
  organisation: 'Ire Events',
} as const;

export const TRIES = 5;
export const LOCK_MS = 60_000;

export type FieldLines = { email?: string; password?: string };

export function fieldLines(email: string, password: string): FieldLines {
  const lines: FieldLines = {};
  const problem = emailProblem(email);

  if (problem != null) {
    lines.email =
      problem === 'blank'
        ? 'Enter your email address.'
        : 'That does not look like an email address. Check it has an @ and a domain.';
  }
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

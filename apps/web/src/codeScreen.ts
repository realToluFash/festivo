import { ApiError, type CodeState } from '@soirely/api-client';

/** Where "Check your email" and "Check your messages" stand, the same rules for an address and a phone. */
export type CodeStatus =
  | { kind: 'entering' }
  | { kind: 'verifying' }
  | { kind: 'wrong' }
  | { kind: 'expired' }
  | { kind: 'exhausted' }
  | { kind: 'failed' }
  | { kind: 'verified' };

/** Where the screen opens: on the field while the code is live, else on its banner, before anyone types. */
export function openingStatus(now: CodeStatus, state: CodeState): CodeStatus {
  return state === 'live' || now.kind !== 'entering' ? now : { kind: state };
}

/** A wrong code stays where it was typed, selected, so typing replaces it. */
export function selectCode(): void {
  const field = document.getElementById('code');

  if (field instanceof HTMLInputElement && document.activeElement === field) field.select();
}

/** What a refused code means to the person, the same for an email and a phone. */
export function codeRefusal(error: unknown): CodeStatus {
  if (!(error instanceof ApiError)) return { kind: 'failed' };

  if (error.is('verification_code_expired')) return { kind: 'expired' };
  if (error.is('verification_code_exhausted')) return { kind: 'exhausted' };
  if (error.is('verification_code_invalid')) return { kind: 'wrong' };

  return { kind: 'failed' };
}

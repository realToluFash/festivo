import { ApiError } from '@soirely/api-client';

export type CodeStatus =
  | { kind: 'entering' }
  | { kind: 'verifying' }
  | { kind: 'wrong' }
  | { kind: 'expired' }
  | { kind: 'exhausted' }
  | { kind: 'failed' };

/** What a refused code means to the person, the same for an email and a phone. */
export function codeRefusal(error: unknown): CodeStatus {
  if (!(error instanceof ApiError)) return { kind: 'failed' };

  if (error.is('verification_code_expired')) return { kind: 'expired' };
  if (error.is('verification_code_exhausted')) return { kind: 'exhausted' };
  if (error.is('verification_code_invalid')) return { kind: 'wrong' };

  return { kind: 'failed' };
}

/** A code can be typed while waiting to type, after a wrong one, or after a failure; not once it is spent. */
export function asksForCode(status: CodeStatus): boolean {
  return ['entering', 'verifying', 'wrong', 'failed'].includes(status.kind);
}

/** A refused resend that says how long to wait, in seconds; null when it says nothing usable. */
export function retryAfter(error: unknown): number | null {
  if (!(error instanceof ApiError)) return null;

  const seconds = Number(error.response?.headers.get('Retry-After'));

  return Number.isFinite(seconds) && seconds > 0 ? seconds : null;
}

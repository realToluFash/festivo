import { ApiError } from '@soirely/api-client';
import { codeProblem, lockLiftsAt } from '@soirely/domain';

export type CodeMode = 'app' | 'recovery';

/** The message key a typed code gets before anything is sent, or null when it may go. */
export function typedCodeProblem(mode: CodeMode, typed: string): string | null {
  if (mode === 'recovery') return typed.trim() === '' ? 'twoFactor.recoveryBlank' : null;

  const found = codeProblem(typed);

  return found === 'blank'
    ? 'twoFactor.codeBlank'
    : found === 'short'
      ? 'twoFactor.codeLength'
      : null;
}

export type CodeRefusal =
  | { kind: 'wrong'; message: string }
  | { kind: 'paused'; liftsAt: Date }
  | { kind: 'expired' }
  | { kind: 'failed' };

/** What the API's refusal of a code means for the screen. */
export function codeRefusal(error: unknown, mode: CodeMode): CodeRefusal {
  if (!(error instanceof ApiError)) return { kind: 'failed' };

  if (error.is('two_factor_challenge_invalid')) return { kind: 'expired' };

  if (error.is('too_many_attempts')) {
    const liftsAt = lockLiftsAt(Number(error.response?.headers.get('Retry-After')));

    return liftsAt == null ? { kind: 'failed' } : { kind: 'paused', liftsAt };
  }

  if (error.is('recovery_code_used')) return { kind: 'wrong', message: 'twoFactor.recoveryUsed' };

  if (error.is('two_factor_code_invalid')) {
    return {
      kind: 'wrong',
      message: mode === 'app' ? 'twoFactor.codeWrong' : 'twoFactor.recoveryWrong',
    };
  }

  return { kind: 'failed' };
}

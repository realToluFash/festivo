import { lockLiftsAt } from '@soirely/domain';

import { ApiError } from './problem.ts';

/** What `/api/auth/proof` refused, for each card on either client to word in its own copy. */
export type ProofRefusal =
  | { kind: 'field'; field: 'password' | 'code' }
  | { kind: 'limited'; until: Date | null }
  | { kind: 'trip' }
  | { kind: 'failed' };

/** A wrong password is only the password field's when one was typed; otherwise Google or Apple's trip was refused. */
export function proofRefusal(error: unknown, passwordTyped = true): ProofRefusal {
  if (!(error instanceof ApiError)) return { kind: 'failed' };

  if (error.is('too_many_attempts'))
    return {
      kind: 'limited',
      until: lockLiftsAt(Number(error.response?.headers.get('Retry-After'))),
    };
  if (error.is('invalid_credentials') && passwordTyped) return { kind: 'field', field: 'password' };
  if ((error.is('invalid_credentials') || error.is('proof_required')) && !passwordTyped)
    return { kind: 'trip' };
  if (error.is('two_factor_code_invalid') || error.is('recovery_code_used'))
    return { kind: 'field', field: 'code' };

  return { kind: 'failed' };
}

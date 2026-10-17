import { ApiError, type RecentProof } from '@soirely/api-client';
import { lockLiftsAt, proofStands } from '@soirely/domain';

const PROOF = 'soirely.proof';

/** What `/api/auth/proof` refused, for each card to word in its own copy. */
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

/** Kept in the tab, since linking leaves for the provider and comes back: five minutes, then worth nothing. */
export function holdProof(proof: RecentProof): void {
  try {
    sessionStorage.setItem(PROOF, JSON.stringify(proof));
  } catch {
    // Without storage the proof is asked for again, which is only slower.
  }
}

/** The proof this tab holds, while it still stands. */
export function heldProof(): string | null {
  try {
    const raw = sessionStorage.getItem(PROOF);
    const held = raw == null ? null : (JSON.parse(raw) as RecentProof);

    return held != null && proofStands(held.expiresAt) ? held.proof : null;
  } catch {
    return null;
  }
}

export function dropProof(): void {
  try {
    sessionStorage.removeItem(PROOF);
  } catch {
    // Nothing held, then.
  }
}

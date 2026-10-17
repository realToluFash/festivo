import { type RecentProof } from '@soirely/api-client';
import { proofStands } from '@soirely/domain';

const PROOF = 'soirely.proof';

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

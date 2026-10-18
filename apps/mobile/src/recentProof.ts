import { type RecentProof } from '@soirely/api-client';
import { proofStands } from '@soirely/domain';

/** In memory only: five minutes, and gone with the app. Shared by every change to how the account signs in. */
let held: RecentProof | null = null;

export function holdProof(proof: RecentProof): void {
  held = proof;
}

export function heldProof(): string | null {
  return held != null && proofStands(held.expiresAt) ? held.proof : null;
}

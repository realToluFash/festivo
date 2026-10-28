import { type Account, type Provider, type RecentProof } from '@soirely/api-client';
import { confirmWith, proofStands } from '@soirely/domain';

import { api } from './api.ts';

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

/** What Confirm it's you asks this account for: its password, else the provider it signs in with, then the code. */
export interface Proving {
  via: 'password' | Provider | null;
  twoFactorOn: boolean;
}

export function proveVia(account: Account): Proving['via'] {
  return confirmWith(account.hasPassword, account.providers);
}

export async function howToProve(): Promise<Proving> {
  const [account, status] = await Promise.all([api.me(), api.twoFactorStatus()]);

  return { via: proveVia(account), twoFactorOn: status.on };
}

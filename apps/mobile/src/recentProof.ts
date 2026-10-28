import { type Account, type Provider, type RecentProof } from '@soirely/api-client';
import { proofStands } from '@soirely/domain';

import { api } from './api.ts';

/** In memory only: five minutes, and gone with the app. Shared by every change to how the account signs in. */
let held: RecentProof | null = null;

export function holdProof(proof: RecentProof): void {
  held = proof;
}

export function heldProof(): string | null {
  return held != null && proofStands(held.expiresAt) ? held.proof : null;
}

export function dropProof(): void {
  held = null;
}

/** What Confirm it's you asks this account for: its password, else the provider it signs in with, then the code. */
export interface Proving {
  via: 'password' | Provider | null;
  twoFactorOn: boolean;
}

export function proveVia(account: Account): Proving['via'] {
  return account.hasPassword ? 'password' : (account.providers[0]?.provider ?? null);
}

export async function howToProve(): Promise<Proving> {
  const [account, status] = await Promise.all([api.me(), api.twoFactorStatus()]);

  return { via: proveVia(account), twoFactorOn: status.on };
}

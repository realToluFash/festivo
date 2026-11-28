import { type ReturnPurpose, heldProviderReturn } from '../../../providerSignIn.ts';
import type { Proving } from '../../../recentProof.ts';

export type OwnerReturn = NonNullable<ReturnType<typeof backToMakeOwner>>;

/** What Google or Apple brought back to a Confirm it's you this screen started, if it was one. */
export function backToMakeOwner() {
  const returned = heldProviderReturn(['makeOwner']);

  return returned != null && returned.purpose.kind === 'makeOwner'
    ? { ...returned, purpose: returned.purpose as Extract<ReturnPurpose, { kind: 'makeOwner' }> }
    : null;
}

/** Back from the provider, Confirm it's you opens at once and sends what came back; the API asks for a code if it needs one. */
export function provingOnReturn(returned: OwnerReturn | null): Proving | null {
  return returned != null && 'signIn' in returned
    ? { via: returned.provider, twoFactorOn: false }
    : null;
}

export function signInOnReturn(returned: OwnerReturn | null) {
  return returned != null && 'signIn' in returned ? returned.signIn : null;
}

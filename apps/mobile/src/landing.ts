import { type Account, type Awaiting, awaiting, phoneAwaitingCode } from '@soirely/api-client';

export type Landing = '/verify-email' | '/verify-phone?from=onboarding' | '/complete-profile' | '/';

/** Where a signed-in account belongs: the gate it is behind, or the app. */
export function landingFor(gate: Awaiting | null): Landing {
  if (gate === 'email') return '/verify-email';
  if (gate === 'phone') return '/verify-phone?from=onboarding';

  return gate === 'details' || gate === 'approval' ? '/complete-profile' : '/';
}

/** No address at all, as only a door code's account is until sc-4235 asks it for a number (the API's OnboardingGate::heldByDevice). */
export function heldByDevice(
  account: Pick<Account, 'verified' | 'emailAddresses' | 'phoneNumbers'>,
): boolean {
  return (
    !account.verified && account.emailAddresses.length === 0 && account.phoneNumbers.length === 0
  );
}

/** The gate an account is behind; a door code's account has none to pass and lands inside its event. */
export function gateOf(
  account: Pick<Account, 'verified' | 'complete' | 'emailAddresses' | 'phoneNumbers'> &
    Partial<Pick<Account, 'waitingFor'>>,
): Awaiting | null {
  return heldByDevice(account) ? null : awaiting(account);
}

/** Skip saves no number, so one saved on the way and not yet proved is dropped first. */
export function skipDropsPhone(account: Pick<Account, 'phoneNumbers'>): boolean {
  return phoneAwaitingCode(account)?.verified === false;
}

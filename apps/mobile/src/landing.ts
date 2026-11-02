import type { Awaiting } from '@soirely/api-client';

export type Landing = '/verify-email' | '/verify-phone?from=onboarding' | '/complete-profile' | '/';

/** Where a signed-in account belongs: the gate it is behind, or the app. */
export function landingFor(gate: Awaiting | null): Landing {
  if (gate === 'email') return '/verify-email';
  if (gate === 'phone') return '/verify-phone?from=onboarding';

  return gate === 'details' || gate === 'approval' ? '/complete-profile' : '/';
}

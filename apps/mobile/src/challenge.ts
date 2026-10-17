import { type SignInOutcome, type TwoFactorChallenge, awaiting } from '@soirely/api-client';

import { type Landing, landingFor } from './landing.ts';

let held: TwoFactorChallenge | null = null;

/** In memory only: a route parameter would put a credential where logs and history keep it. */
export function holdChallenge(challenge: TwoFactorChallenge): void {
  held = challenge;
}

export function heldChallenge(): TwoFactorChallenge | null {
  return held;
}

export function dropChallenge(): void {
  held = null;
}

/** Where any sign-in goes next: the code screen when two-factor asks for one, else where the account belongs. */
export function nextAfterSignIn(
  outcome: SignInOutcome,
): Landing | '/sign-in-code' | '/two-factor-again' {
  if ('challenge' in outcome) {
    holdChallenge(outcome);
    return '/sign-in-code';
  }

  dropChallenge();

  // Two-factor was turned off to let them back in (sc-509): asked to set it up again first.
  return outcome.account.twoFactorSetupPrompt
    ? '/two-factor-again'
    : landingFor(awaiting(outcome.account));
}

import { type SignInOutcome, type TwoFactorChallenge, awaiting } from '@soirely/api-client';

import { followAccount } from './accountLanguage.ts';
import { takeHeldLink } from './heldLink.ts';
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
export async function nextAfterSignIn(
  outcome: SignInOutcome,
): Promise<Landing | '/sign-in-code' | '/two-factor-again' | `/join/${string}`> {
  if ('challenge' in outcome) {
    holdChallenge(outcome);
    return '/sign-in-code';
  }

  dropChallenge();
  // Before the next screen draws, so it opens in this account's language, not the last person's (sc-8006).
  await followAccount(outcome.account);

  // Two-factor was turned off to let them back in (sc-509): asked to set it up again first.
  if (outcome.account.twoFactorSetupPrompt) return '/two-factor-again';

  const landing = landingFor(awaiting(outcome.account));
  // A request link opened signed out (sc-562) comes next, once the address is proved.
  const link = landing === '/verify-email' ? null : await takeHeldLink();

  return link == null ? landing : `/join/${link}`;
}

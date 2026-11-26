import {
  type Account,
  type SignInOutcome,
  type TwoFactorChallenge,
  awaiting,
} from '@soirely/api-client';

import { followAccount } from './accountLanguage.ts';
import { takeHeldLink } from './heldLink.ts';
import { type Landing, landingFor } from './landing.ts';

let held: TwoFactorChallenge | null = null;
let heldAlone = false;
let heldTyped: string | null = null;

/** In memory only: a route parameter would put a credential where logs and history keep it. */
export function holdChallenge(
  challenge: TwoFactorChallenge,
  { alone = false, typed = null }: { alone?: boolean; typed?: string | null } = {},
): void {
  held = challenge;
  heldAlone = alone;
  heldTyped = typed;
}

export function heldChallenge(): TwoFactorChallenge | null {
  return held;
}

/** Whether the held sign-in began on a Sign in with nothing under it, as a cold `soirely://sign-in` opens one (sc-67606). */
export function challengeBeganAlone(): boolean {
  return heldAlone;
}

/** The address typed on the Sign in the held sign-in began on, or null when it began with Google or Apple (sc-67828). */
export function challengeTypedEmail(): string | null {
  return heldTyped;
}

export function dropChallenge(): void {
  held = null;
  heldAlone = false;
  heldTyped = null;
}

/** Where any sign-in goes next: the code screen when two-factor asks for one, else where the account belongs. */
export async function nextAfterSignIn(
  outcome: SignInOutcome,
  { alone = false, typed = null }: { alone?: boolean; typed?: string | null } = {},
): Promise<Landing | '/sign-in-code' | '/two-factor-again' | `/join/${string}`> {
  if ('challenge' in outcome) {
    holdChallenge(outcome, { alone, typed });
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

/** A provider sign-in from a screen that carries on as the account (sc-94849): there when nothing comes first, else over it, so the screen stays under whatever is asked first. */
export function carryOnAfter<To extends string>(
  outcome: SignInOutcome,
  next: To,
): { kind: 'here'; account: Account } | { kind: 'over'; to: To } {
  return 'challenge' in outcome || next !== '/'
    ? { kind: 'over', to: next }
    : { kind: 'here', account: outcome.account };
}

/** Where a registration goes once its code is accepted: back to a request link it started from (sc-562), else where the account belongs. */
export async function nextAfterRegistration(
  account: Account,
): Promise<Landing | `/join/${string}`> {
  const link = await takeHeldLink();

  return link == null ? landingFor(awaiting(account)) : `/join/${link}`;
}

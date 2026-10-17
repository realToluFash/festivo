import { type SignInOutcome, type TwoFactorChallenge, awaiting } from '@soirely/api-client';
import { type NavigateFunction } from 'react-router';

import { adoptAccount, landingFor } from './session.ts';

/** Where any sign-in lands: the code screen when two-factor asks for one, else where the account belongs. */
export async function landAfterSignIn(
  outcome: SignInOutcome,
  navigate: NavigateFunction,
): Promise<void> {
  if ('challenge' in outcome) {
    navigate('/sign-in/code', { replace: true, state: outcome satisfies TwoFactorChallenge });
    return;
  }

  await adoptAccount(outcome.account);
  // Two-factor was turned off to let them back in (sc-509): asked to set it up again before anything else.
  navigate(
    outcome.account.twoFactorSetupPrompt
      ? '/two-factor/again'
      : landingFor(awaiting(outcome.account)),
    {
      replace: true,
    },
  );
}

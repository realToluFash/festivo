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
  navigate(landingFor(awaiting(outcome.account)), { replace: true });
}

import { router } from 'expo-router';

import { challengeBeganAlone, heldChallenge } from '../challenge.ts';
import { timedOutSignIn } from '../kit/signInRules.ts';
import { pushSignIn } from './signInBelow.ts';

/** None of the ran-out sign-in's steps stays: its Sign in goes over welcome, or alone where it began alone (sc-67606). */
export function leaveTimedOutSignIn(): void {
  const signIn = timedOutSignIn(heldChallenge()?.email ?? '');
  const alone = challengeBeganAlone();

  if (router.canDismiss()) router.dismissAll();

  if (alone) {
    router.replace(signIn);
    return;
  }

  router.replace('/welcome');
  pushSignIn(signIn);
}

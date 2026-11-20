import { router } from 'expo-router';

import { challengeBeganAlone, challengeTypedEmail } from '../challenge.ts';
import { signInOver } from './signInOver.ts';

/** Back from the code step to Sign in: the one typed on, holding its address, or after Google or Apple the one under it, else a fresh one over welcome, or alone where the sign-in began alone (sc-67709, sc-67828). */
export function backToSignIn(): void {
  const email = challengeTypedEmail();

  // That Sign in gave its place to the code step, so the step gives it back, over whatever was under it.
  if (email != null) {
    signInOver(router.canGoBack());
    router.replace({ pathname: '/sign-in', params: { email } });
    return;
  }

  if (router.canGoBack()) {
    router.back();
    return;
  }

  if (challengeBeganAlone()) {
    signInOver(false);
    router.replace('/sign-in');
    return;
  }

  router.replace('/welcome');
  signInOver(true);
  router.push('/sign-in');
}

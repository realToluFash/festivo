import { router } from 'expo-router';

import { challengeBeganAlone } from '../challenge.ts';

/** Back from the code step: to the Sign in under it, else a fresh one over welcome, or alone where the sign-in began alone (sc-67709). */
export function backToSignIn(): void {
  if (router.canGoBack()) {
    router.back();
    return;
  }

  if (challengeBeganAlone()) {
    router.replace('/sign-in');
    return;
  }

  router.replace('/welcome');
  router.push('/sign-in');
}

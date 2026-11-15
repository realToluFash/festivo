import { router } from 'expo-router';

import { holdsSession } from './tokens.ts';

/** Close, from the reset link: the password unchanged, back to sign-in, or to the app on a device still signed in (sc-29071). */
export function closeReset(): void {
  void holdsSession()
    .catch(() => false)
    .then((signedIn) => router.replace(signedIn ? '/' : '/sign-in'));
}

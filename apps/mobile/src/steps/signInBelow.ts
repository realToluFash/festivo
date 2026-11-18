import { type Href, router } from 'expo-router';
import { createContext, useContext } from 'react';

let pushed = false;
const below = new Map<string, boolean>();

/** Opens Sign in over welcome. expo-router hands a screen being drawn the stack before the push, which reads nothing under Sign in, so the push says so (sc-67709). */
export function pushSignIn(href: Href): void {
  pushed = true;
  router.push(href);
}

/** Whether the Sign in on this route has a screen under it, settled the first time the stack presents it and kept for that route. */
export function settleSignInBelow(routeKey: string, canGoBack: () => boolean): boolean {
  const known = below.get(routeKey);
  if (known != null) return known;

  const settled = pushed || canGoBack();
  pushed = false;
  below.set(routeKey, settled);

  return settled;
}

export function signInBelowOn(routeKey: string): boolean {
  return below.get(routeKey) ?? false;
}

export const SignInBelow = createContext(false);

export function useSignInBelow(): boolean {
  return useContext(SignInBelow);
}

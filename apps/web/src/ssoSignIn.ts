import { type SignInOutcome, type SingleSignOnStart, base64Url } from '@soirely/api-client';

import { api } from './api.ts';
import { browser } from './providerSignIn.ts';

const VERIFIER = 'soirely.sso.verifier';

async function attempt(email: string): Promise<[SingleSignOnStart | null, string]> {
  const verifier = base64Url(crypto.getRandomValues(new Uint8Array(32)));
  const hashed = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));

  return [await api.startSingleSignOn(email, base64Url(new Uint8Array(hashed))), verifier];
}

export async function singleSignOnAt(email: string): Promise<SingleSignOnStart | null> {
  return (await attempt(email))[0];
}

/** A fresh attempt on each press, as one lasts ten minutes; this tab alone keeps what finishes it. */
export async function leaveForSingleSignOn(email: string): Promise<boolean> {
  const [start, verifier] = await attempt(email);
  if (start == null) return false;

  sessionStorage.setItem(VERIFIER, verifier);
  browser.leaveFor(start.authorizationUrl);

  return true;
}

export async function finishSingleSignOn(handle: string): Promise<SignInOutcome> {
  const verifier = sessionStorage.getItem(VERIFIER);
  sessionStorage.removeItem(VERIFIER);
  if (verifier == null) throw new Error('no single sign-on attempt in this tab');

  return api.signInWithSingleSignOn(handle, verifier);
}

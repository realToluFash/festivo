import {
  type ProviderAttempt,
  type SignedIn,
  ProviderFailed,
  authorizationUrl,
  base64Url,
  codeFromCallback,
  exchangeCode,
  hex,
} from '@soirely/api-client';

import { api } from './api.ts';
import { config } from './config.ts';

const ATTEMPT = 'soirely.google.attempt';
const LINKED = 'soirely.google.linked';
const CALLBACK_PATH = '/oauth/google';

/** Leaving the page, behind a seam a test can watch: jsdom will not let location.assign be replaced. */
export const browser = {
  leaveFor(url: string): void {
    window.location.assign(url);
  },
};

function random(): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(32)));
}

async function sha256(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
}

function redirectUri(): string {
  return `${window.location.origin}${CALLBACK_PATH}`;
}

/** Leaves for Google, keeping in this tab what only this tab may finish with. */
export async function startGoogleSignIn(): Promise<void> {
  const google = config().google;
  if (google == null) throw new ProviderFailed('not configured');

  const attempt: ProviderAttempt = { state: random(), nonce: random(), codeVerifier: random() };
  sessionStorage.setItem(ATTEMPT, JSON.stringify(attempt));

  browser.leaveFor(
    authorizationUrl(google, {
      redirectUri: redirectUri(),
      state: attempt.state,
      nonceHash: hex(await sha256(attempt.nonce)),
      codeChallenge: base64Url(await sha256(attempt.codeVerifier)),
    }),
  );
}

/** Back from Google: the code exchanged for its ID token, and the API asked who that is. */
export async function finishGoogleSignIn(callbackUrl: string): Promise<SignedIn> {
  const google = config().google;
  const saved = sessionStorage.getItem(ATTEMPT);
  sessionStorage.removeItem(ATTEMPT);

  if (google == null || saved == null) throw new ProviderFailed('no attempt in this tab');

  const attempt = JSON.parse(saved) as ProviderAttempt;
  const code = codeFromCallback(callbackUrl, attempt.state);
  const idToken = await exchangeCode(google, {
    code,
    codeVerifier: attempt.codeVerifier,
    redirectUri: redirectUri(),
  });

  const signedIn = await api.signInWithProvider('google', idToken, attempt.nonce);
  if (signedIn.linked) sessionStorage.setItem(LINKED, '1');

  return signedIn;
}

/** "Google is now linked": said once, on the screen the person lands on. */
export function takeLinkedNotice(): boolean {
  const linked = sessionStorage.getItem(LINKED) != null;
  sessionStorage.removeItem(LINKED);

  return linked;
}

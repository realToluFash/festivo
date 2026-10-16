import {
  type SignedIn,
  ProviderCancelled,
  authorizationUrl,
  base64Url,
  codeFromCallback,
  exchangeCode,
  hex,
} from '@soirely/api-client';
import { CryptoDigestAlgorithm, digest, getRandomBytes } from 'expo-crypto';
import { openAuthSessionAsync } from 'expo-web-browser';

import { api } from './api.ts';
import { config } from './config.ts';

/** The app's own scheme: the browser hands the callback straight back to Soirely. */
const REDIRECT_URI = 'soirely://oauth/google';

let linkedJustNow = false;

function random(): string {
  return base64Url(getRandomBytes(32));
}

async function sha256(value: string): Promise<Uint8Array> {
  return new Uint8Array(
    await digest(CryptoDigestAlgorithm.SHA256, new TextEncoder().encode(value)),
  );
}

/** Google in the system browser, the code exchanged for its ID token, and the API asked who that is. */
export async function signInWithGoogle(): Promise<SignedIn> {
  const state = random();
  const nonce = random();
  const codeVerifier = random();

  const result = await openAuthSessionAsync(
    authorizationUrl(config.google, {
      redirectUri: REDIRECT_URI,
      state,
      nonceHash: hex(await sha256(nonce)),
      codeChallenge: base64Url(await sha256(codeVerifier)),
    }),
    REDIRECT_URI,
  );

  if (result.type !== 'success') throw new ProviderCancelled();

  const idToken = await exchangeCode(config.google, {
    code: codeFromCallback(result.url, state),
    codeVerifier,
    redirectUri: REDIRECT_URI,
  });

  const signedIn = await api.signInWithProvider('google', idToken, nonce);
  linkedJustNow = signedIn.linked;

  return signedIn;
}

/** "Google is now linked": said once, on the screen the person lands on. */
export function takeLinkedNotice(): boolean {
  const linked = linkedJustNow;
  linkedJustNow = false;

  return linked;
}

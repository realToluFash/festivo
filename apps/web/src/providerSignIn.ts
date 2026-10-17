import {
  type Provider,
  type ProviderAttempt,
  type SignedIn,
  ProviderFailed,
  appleName,
  authorizationUrl,
  base64Url,
  callbackParam,
  codeFromCallback,
  hex,
} from '@soirely/api-client';

import { api } from './api.ts';
import { config } from './config.ts';

const LINKED = 'soirely.provider.linked';

/** How each provider is named on screen. */
export const PROVIDER_NAMES: Record<Provider, string> = { google: 'Google', apple: 'Apple' };

/** Leaving the page, behind a seam a test can watch: jsdom will not let location.assign be replaced. */
export const browser = {
  leaveFor(url: string): void {
    window.location.assign(url);
  },
};

function attemptKey(provider: Provider): string {
  return `soirely.${provider}.attempt`;
}

function random(): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(32)));
}

async function sha256(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
}

/** Apple answers by form_post, which only the API can receive; it sends the browser on to /oauth/apple. */
function redirectUri(provider: Provider): string {
  return provider === 'apple'
    ? `${config().apiBaseUrl}/api/auth/oauth/apple/return`
    : `${window.location.origin}/oauth/google`;
}

/** Leaves for the provider, keeping in this tab what only this tab may finish with. */
export async function startProviderSignIn(provider: Provider): Promise<void> {
  const endpoints = config()[provider];
  if (endpoints == null) throw new ProviderFailed('not configured');

  const attempt: ProviderAttempt = { state: random(), nonce: random(), codeVerifier: random() };
  sessionStorage.setItem(attemptKey(provider), JSON.stringify(attempt));

  browser.leaveFor(
    authorizationUrl(endpoints, {
      redirectUri: redirectUri(provider),
      state: attempt.state,
      nonceHash: hex(await sha256(attempt.nonce)),
      codeChallenge: base64Url(await sha256(attempt.codeVerifier)),
      ...(provider === 'apple'
        ? { scope: 'openid name email', extra: { response_mode: 'form_post' } }
        : {}),
    }),
  );
}

/** Back from the provider: the code goes to the API, which redeems it with the secret a browser cannot keep. */
export async function finishProviderSignIn(
  provider: Provider,
  callbackUrl: string,
): Promise<SignedIn> {
  const saved = sessionStorage.getItem(attemptKey(provider));
  sessionStorage.removeItem(attemptKey(provider));

  if (config()[provider] == null || saved == null)
    throw new ProviderFailed('no attempt in this tab');

  const attempt = JSON.parse(saved) as ProviderAttempt;
  const name = provider === 'apple' ? appleName(callbackParam(callbackUrl, 'user')) : undefined;

  const signedIn = await api.signInWithProviderCode(provider, {
    code: codeFromCallback(callbackUrl, attempt.state),
    codeVerifier: attempt.codeVerifier,
    redirectUri: redirectUri(provider),
    nonce: attempt.nonce,
    ...(name == null ? {} : { name }),
  });

  if (signedIn.linked) sessionStorage.setItem(LINKED, PROVIDER_NAMES[provider]);

  return signedIn;
}

/** "Google is now linked": the provider to name, once, on the screen the person lands on. */
export function takeLinkedNotice(): string | null {
  const linked = sessionStorage.getItem(LINKED);
  sessionStorage.removeItem(LINKED);

  return linked;
}

import {
  type Provider,
  type ProviderAttempt,
  type ProviderSignInAttempt,
  ProviderCancelled,
  type SignedIn,
  type SignInOutcome,
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
const LINKING = 'soirely.provider.linking';
const RETURNED = 'soirely.provider.returned';

/** Why Security sent the person to a provider: to confirm it is them, or to choose the account to link. */
export type ReturnPurpose =
  | { kind: 'prove'; then: { action: 'link' | 'unlink'; provider: Provider } }
  | { kind: 'link' }
  | { kind: 'signOutOthers' }
  /** Account's "Make primary" (sc-113): the address that becomes the one signing in. */
  | { kind: 'makePrimary'; address: string };

/** What Security finds on its return: the provider's code to send on, or that it did not finish. */
export type ProviderReturn = { provider: Provider; purpose: ReturnPurpose } & (
  { signIn: ProviderSignInAttempt } | { failed: 'cancelled' | 'failed' }
);

type SavedAttempt = ProviderAttempt & { purpose?: ReturnPurpose };

/** Confirming it is you means signing in again at Google, not one click on a remembered account (OIDC Core §3.1.2.1). */
export const REAUTHENTICATE = { prompt: 'login', max_age: '0' };

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
export async function startProviderSignIn(
  provider: Provider,
  purpose?: ReturnPurpose,
): Promise<void> {
  const endpoints = config()[provider];
  if (endpoints == null) throw new ProviderFailed('not configured');

  const attempt: SavedAttempt = {
    state: random(),
    nonce: random(),
    codeVerifier: random(),
    ...(purpose == null ? {} : { purpose }),
  };
  sessionStorage.setItem(attemptKey(provider), JSON.stringify(attempt));

  browser.leaveFor(
    authorizationUrl(endpoints, {
      redirectUri: redirectUri(provider),
      state: attempt.state,
      nonceHash: hex(await sha256(attempt.nonce)),
      codeChallenge: base64Url(await sha256(attempt.codeVerifier)),
      ...(provider === 'apple'
        ? { scope: 'openid name email', extra: { response_mode: 'form_post' } }
        : purpose?.kind === 'prove' ||
            purpose?.kind === 'signOutOthers' ||
            purpose?.kind === 'makePrimary'
          ? { extra: REAUTHENTICATE }
          : {}),
    }),
  );
}

/** Back from the provider: the code goes to the API, which redeems it with the secret a browser cannot keep. */
export async function finishProviderSignIn(
  provider: Provider,
  callbackUrl: string,
): Promise<SignInOutcome> {
  const saved = sessionStorage.getItem(attemptKey(provider));
  sessionStorage.removeItem(attemptKey(provider));

  if (config()[provider] == null || saved == null)
    throw new ProviderFailed('no attempt in this tab');

  const attempt = JSON.parse(saved) as ProviderAttempt;
  const name = provider === 'apple' ? appleName(callbackParam(callbackUrl, 'user')) : undefined;

  const outcome = await api.signInWithProviderCode(provider, {
    code: codeFromCallback(callbackUrl, attempt.state),
    codeVerifier: attempt.codeVerifier,
    redirectUri: redirectUri(provider),
    nonce: attempt.nonce,
    ...(name == null ? {} : { name }),
  });

  if ('challenge' in outcome) sessionStorage.setItem(LINKING, PROVIDER_NAMES[provider]);
  else if (outcome.linked) sessionStorage.setItem(LINKED, PROVIDER_NAMES[provider]);

  return outcome;
}

/** The trip Security started, if this callback is one: it is not a sign-in, and nothing is sent from here. */
export function returnPurpose(provider: Provider): ReturnPurpose | null {
  const saved = sessionStorage.getItem(attemptKey(provider));

  return saved == null ? null : ((JSON.parse(saved) as SavedAttempt).purpose ?? null);
}

/** Back from Security's trip: keeps the provider's code for Security, which sends it with the proof. */
export function keepProviderReturn(provider: Provider, callbackUrl: string): void {
  const saved = sessionStorage.getItem(attemptKey(provider));
  sessionStorage.removeItem(attemptKey(provider));
  if (saved == null) return;

  const attempt = JSON.parse(saved) as SavedAttempt;
  if (attempt.purpose == null) return;

  let kept: ProviderReturn;
  try {
    kept = {
      provider,
      purpose: attempt.purpose,
      signIn: {
        code: codeFromCallback(callbackUrl, attempt.state),
        codeVerifier: attempt.codeVerifier,
        redirectUri: redirectUri(provider),
        nonce: attempt.nonce,
      },
    };
  } catch (error) {
    kept = {
      provider,
      purpose: attempt.purpose,
      failed: error instanceof ProviderCancelled ? 'cancelled' : 'failed',
    };
  }

  sessionStorage.setItem(RETURNED, JSON.stringify(kept));
}

/** What the provider trip brought back, for the Security card whose trip it was to finish. */
export function heldProviderReturn(
  kinds: readonly ReturnPurpose['kind'][] = ['prove', 'link'],
): ProviderReturn | null {
  const kept = sessionStorage.getItem(RETURNED);
  if (kept == null) return null;

  const returned = JSON.parse(kept) as ProviderReturn;

  return kinds.includes(returned.purpose.kind) ? returned : null;
}

/** The card the trip was for has it: no reload or later visit finishes it again. */
export function dropProviderReturn(): void {
  sessionStorage.removeItem(RETURNED);
}

/** The code passed: a provider sign-in it finished may have linked its provider only now. */
export function codePassed(signedIn: SignedIn): SignedIn {
  const provider = sessionStorage.getItem(LINKING);
  sessionStorage.removeItem(LINKING);
  if (signedIn.linked && provider != null) sessionStorage.setItem(LINKED, provider);

  return signedIn;
}

/** "Google is now linked": the provider to name, once, on the screen the person lands on. */
export function linkedNotice(): string | null {
  return sessionStorage.getItem(LINKED);
}

/** The notice was shown: no later screen or reload shows it again. */
export function dropLinkedNotice(): void {
  sessionStorage.removeItem(LINKED);
}

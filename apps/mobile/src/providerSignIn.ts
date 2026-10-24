import {
  type Provider,
  type ProviderSignInAttempt,
  type SignInOutcome,
  type SignedIn,
  ProviderCancelled,
  ProviderFailed,
  appleAppLinkOutcome,
  authorizationUrl,
  base64Url,
  codeFromCallback,
  exchangeCode,
  hex,
} from '@soirely/api-client';
import {
  AppleAuthenticationScope,
  isAvailableAsync,
  signInAsync as appleSignInAsync,
} from 'expo-apple-authentication';
import { CryptoDigestAlgorithm, digest, getRandomBytes } from 'expo-crypto';
import { openAuthSessionAsync } from 'expo-web-browser';
import { Platform } from 'react-native';

import { api } from './api.ts';
import { config } from './config.ts';

export const PROVIDER_NAMES: Record<Provider, string> = { google: 'Google', apple: 'Apple' };

let linkedJustNow: string | null = null;
let linkingOnCode: string | null = null;

function random(): string {
  return base64Url(getRandomBytes(32));
}

async function sha256(value: string): Promise<Uint8Array> {
  return new Uint8Array(
    await digest(CryptoDigestAlgorithm.SHA256, new TextEncoder().encode(value)),
  );
}

function remember(provider: Provider, outcome: SignInOutcome): SignInOutcome {
  const challenged = 'challenge' in outcome;
  linkingOnCode = challenged ? PROVIDER_NAMES[provider] : null;
  linkedJustNow = !challenged && outcome.linked ? PROVIDER_NAMES[provider] : null;

  return outcome;
}

/** What a provider vouched for, before anything is done with it; `name` is Apple's first-time one. */
interface Ran {
  attempt: ProviderSignInAttempt;
  name?: string;
}

/** The system browser with the code flow and PKCE, the code redeemed here as a native client may. */
async function inBrowser(provider: Provider, reauthenticate = false): Promise<Ran> {
  const redirectUri = `soirely://oauth/${provider}`;
  const state = random();
  const nonce = random();
  const codeVerifier = random();

  const result = await openAuthSessionAsync(
    authorizationUrl(config[provider], {
      redirectUri,
      state,
      nonceHash: hex(await sha256(nonce)),
      codeChallenge: base64Url(await sha256(codeVerifier)),
      ...(provider === 'apple'
        ? { scope: 'openid name email', extra: {} }
        : reauthenticate
          ? { extra: { prompt: 'login', max_age: '0' } }
          : {}),
    }),
    redirectUri,
  );

  if (result.type !== 'success') throw new ProviderCancelled();

  const idToken = await exchangeCode(config[provider], {
    code: codeFromCallback(result.url, state),
    codeVerifier,
    redirectUri,
  });

  return { attempt: { idToken, nonce } };
}

/** Apple's own sheet: the nonce goes in as its hash, and the name comes back on the first time only. */
async function appleSheet(): Promise<Ran> {
  const nonce = random();

  let credential;
  try {
    credential = await appleSignInAsync({
      requestedScopes: [AppleAuthenticationScope.FULL_NAME, AppleAuthenticationScope.EMAIL],
      nonce: hex(await sha256(nonce)),
    });
  } catch (error) {
    if ((error as { code?: unknown }).code === 'ERR_REQUEST_CANCELED')
      throw new ProviderCancelled();
    throw new ProviderFailed('the Apple sheet failed');
  }

  if (credential.identityToken == null) throw new ProviderFailed('no identity token');

  const name = [credential.fullName?.givenName, credential.fullName?.familyName]
    .filter((part): part is string => part != null && part.trim() !== '')
    .join(' ');

  return { attempt: { idToken: credential.identityToken, nonce }, name };
}

/** Android: Apple answers the API by form_post, and a one-time handle returns by App Link, in Custom Tabs. */
async function appleOnAndroid(appLink: string): Promise<Ran> {
  const redirectUri = `${config.apiBaseUrl}/api/auth/oauth/apple/return`;
  const state = random();
  const nonce = random();
  const codeVerifier = random();
  const codeChallenge = base64Url(await sha256(codeVerifier));

  await api.startAppleAttempt(state, codeChallenge);

  const result = await openAuthSessionAsync(
    authorizationUrl(
      { ...config.apple, clientId: config.apple.servicesId },
      {
        redirectUri,
        state,
        nonceHash: hex(await sha256(nonce)),
        codeChallenge,
        scope: 'openid name email',
        extra: { response_mode: 'form_post' },
      },
    ),
    appLink,
  );

  if (result.type !== 'success') throw new ProviderCancelled();

  const outcome = appleAppLinkOutcome(result.url);
  if (outcome == null) throw new ProviderFailed('the App Link carried no handle');
  if ('cancelled' in outcome) throw new ProviderCancelled();

  return { attempt: { handle: outcome.handle, codeVerifier, nonce } };
}

/** On iOS Apple is the system sheet, as App Store review expects; elsewhere both run in the browser. */
async function run(provider: Provider, reauthenticate = false): Promise<Ran> {
  if (provider === 'apple' && Platform.OS === 'ios' && (await isAvailableAsync())) {
    return appleSheet();
  }

  if (provider === 'apple' && Platform.OS === 'android' && config.apple.appLink != null) {
    return appleOnAndroid(config.apple.appLink);
  }

  return inBrowser(provider, reauthenticate);
}

export async function signInWithProvider(provider: Provider): Promise<SignInOutcome> {
  const { attempt, name } = await run(provider);

  const outcome =
    'handle' in attempt
      ? await api.exchangeAppleHandle(attempt)
      : 'idToken' in attempt
        ? await api.signInWithProvider(provider, attempt.idToken, attempt.nonce, name)
        : null;
  if (outcome == null) throw new ProviderFailed('a code the app cannot redeem');

  return remember(provider, outcome);
}

/** Security's own run, never a sign-in: `reauthenticate` when confirming it is you, so Google asks again. */
export async function confirmWithProvider(
  provider: Provider,
  reauthenticate = false,
): Promise<ProviderSignInAttempt> {
  return (await run(provider, reauthenticate)).attempt;
}

/** The code passed: a provider sign-in it finished may have linked its provider only now. */
export function codePassed(signedIn: SignedIn): SignedIn {
  if (signedIn.linked && linkingOnCode != null) linkedJustNow = linkingOnCode;
  linkingOnCode = null;

  return signedIn;
}

/** "Google is now linked": the provider to name, once, on the screen the person lands on. */
export function takeLinkedNotice(): string | null {
  const linked = linkedJustNow;
  linkedJustNow = null;

  return linked;
}

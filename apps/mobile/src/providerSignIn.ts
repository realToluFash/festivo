import {
  type Provider,
  type SignInOutcome,
  ProviderCancelled,
  ProviderFailed,
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

function random(): string {
  return base64Url(getRandomBytes(32));
}

async function sha256(value: string): Promise<Uint8Array> {
  return new Uint8Array(
    await digest(CryptoDigestAlgorithm.SHA256, new TextEncoder().encode(value)),
  );
}

function remember(provider: Provider, outcome: SignInOutcome): SignInOutcome {
  linkedJustNow = outcome.linked ? PROVIDER_NAMES[provider] : null;

  return outcome;
}

/** The system browser with the code flow and PKCE, the code redeemed here as a native client may. */
async function signInInBrowser(provider: Provider): Promise<SignInOutcome> {
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
      ...(provider === 'apple' ? { scope: 'openid name email', extra: {} } : {}),
    }),
    redirectUri,
  );

  if (result.type !== 'success') throw new ProviderCancelled();

  const idToken = await exchangeCode(config[provider], {
    code: codeFromCallback(result.url, state),
    codeVerifier,
    redirectUri,
  });

  return remember(provider, await api.signInWithProvider(provider, idToken, nonce));
}

/** Apple's own sheet: the nonce goes in as its hash, and the name comes back on the first time only. */
async function signInWithAppleSheet(): Promise<SignInOutcome> {
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

  return remember(
    'apple',
    await api.signInWithProvider('apple', credential.identityToken, nonce, name),
  );
}

/** On iOS Apple is the system sheet, as App Store review expects; elsewhere both run in the browser. */
export async function signInWithProvider(provider: Provider): Promise<SignInOutcome> {
  if (provider === 'apple' && Platform.OS === 'ios' && (await isAvailableAsync())) {
    return signInWithAppleSheet();
  }

  return signInInBrowser(provider);
}

/** "Google is now linked": the provider to name, once, on the screen the person lands on. */
export function takeLinkedNotice(): string | null {
  const linked = linkedJustNow;
  linkedJustNow = null;

  return linked;
}

/**
 * The API client. One instance, the same package the web client uses.
 *
 * Shared rather than reimplemented: base URL, the auth header, token refresh,
 * the correlation id and the error shape are decided once. Written per client,
 * each grows its own error path and most of those are never exercised.
 */
import { type Account, ApiClient, awaiting } from '@soirely/api-client';
import { getCalendars } from 'expo-localization';
import { router } from 'expo-router';

import { config } from './config.ts';
import { currentLocale } from './i18n/index.ts';
import { landingFor } from './landing.ts';
import { tokens } from './tokens.ts';

let heldBack: { ended: boolean } | null = null;

export const api = new ApiClient({
  baseUrl: () => config.apiBaseUrl,
  locale: () => currentLocale(),
  timeZone: () => getCalendars()[0]?.timeZone ?? null,
  tokens,
  // Stated rather than defaulted: the web client states the opposite deliberately.
  refreshTokenIn: 'body',
  onSignedOut: () => {
    if (heldBack != null) heldBack.ended = true;
    else router.replace('/sign-in?signedOut=1');
  },
  // A refusal names the gate but not whether the email or a phone is unproved, so ask the account.
  onGate: () => {
    void api
      .me()
      .then((account) => router.replace(landingFor(awaiting(account))))
      .catch(() => router.replace('/'));
  },
});

/** Launch's own `me()`: an ended session is reported back rather than redirected, so a held sign-up can win (sc-927). */
export async function meAtLaunch(): Promise<
  { account: Account } | { error: unknown; ended: boolean }
> {
  const hold = { ended: false };
  heldBack = hold;

  try {
    return { account: await api.me() };
  } catch (error) {
    return { error, ended: hold.ended };
  } finally {
    if (heldBack === hold) heldBack = null;
  }
}

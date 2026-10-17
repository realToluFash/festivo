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

import { appAgent } from './appAgent.ts';
import { config } from './config.ts';
import { currentLocale } from './i18n/index.ts';
import { installId } from './installId.ts';
import { landingFor } from './landing.ts';
import { signedOutHold } from './signedOutHold.ts';
import { tokens } from './tokens.ts';

const hold = signedOutHold(() => router.replace('/sign-in?signedOut=1'));

export const api = new ApiClient({
  baseUrl: () => config.apiBaseUrl,
  locale: () => currentLocale(),
  timeZone: () => getCalendars()[0]?.timeZone ?? null,
  userAgent: appAgent,
  device: () => installId(),
  tokens,
  // Stated rather than defaulted: the web client states the opposite deliberately.
  refreshTokenIn: 'body',
  onSignedOut: () => hold.onSignedOut(),
  // A refusal names the gate but not whether the email or a phone is unproved, so ask the account.
  onGate: () => {
    void api
      .me()
      .then((account) => router.replace(landingFor(awaiting(account))))
      .catch(() => router.replace('/'));
  },
});

/** Launch's own `me()`: an ended session is reported back rather than redirected (sc-927). */
export async function meAtLaunch(): Promise<
  { account: Account } | { error: unknown; ended: boolean }
> {
  const answer = await hold.during(() => api.me());

  return 'value' in answer ? { account: answer.value } : answer;
}

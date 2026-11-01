/**
 * The API client. One instance, the same package the web client uses.
 *
 * Shared rather than reimplemented: base URL, the auth header, token refresh,
 * the correlation id and the error shape are decided once. Written per client,
 * each grows its own error path and most of those are never exercised.
 */
import { type Account, ApiClient, type Problem, awaiting } from '@soirely/api-client';
import { connection } from '@soirely/domain';
import { addNetworkStateListener } from 'expo-network';
import { getCalendars } from 'expo-localization';
import { router } from 'expo-router';

import { appAgent } from './appAgent.ts';
import { config } from './config.ts';
import { currentLocale } from './i18n/index.ts';
import { installId } from './installId.ts';
import { landingFor } from './landing.ts';
import { ruleRefusal, signInRoute } from './kit/signInRules.ts';
import { dropRegistration } from './pendingRegistration.ts';
import { signedOutHold } from './signedOutHold.ts';
import { tokens } from './tokens.ts';

const hold = signedOutHold((why) => router.replace(signInRoute(ruleRefusal(why), true)));

export const api = new ApiClient({
  baseUrl: () => config.apiBaseUrl,
  locale: () => currentLocale(),
  timeZone: () => getCalendars()[0]?.timeZone ?? null,
  userAgent: appAgent,
  device: () => installId(),
  tokens,
  // Stated rather than defaulted: the web client states the opposite deliberately.
  refreshTokenIn: 'body',
  onSignedOut: (why) => hold.onSignedOut(why),
  // Held for getting back to a code with no session (sc-512); a session on this device means they went another way.
  onSignedIn: dropRegistration,
  // A refusal names the gate but not whether the email or a phone is unproved, so ask the account.
  onGate: () => {
    void api
      .me()
      .then((account) => router.replace(landingFor(awaiting(account))))
      .catch(() => router.replace('/'));
  },
  // Every request tells the offline band whether Soirely answered (sc-22586).
  fetch: (input, init) => {
    const answer = fetch(input, init);
    connection.observe(answer, init);

    return answer;
  },
});

addNetworkStateListener(({ isConnected }) => {
  if (isConnected === false) connection.deviceOffline();
  else if (isConnected === true) connection.deviceOnline();
});

/** Launch's own `me()`: an ended session is reported back rather than redirected (sc-927). */
export async function meAtLaunch(): Promise<
  { account: Account } | { error: unknown; ended: boolean; why?: Problem }
> {
  const answer = await hold.during(() => api.me());

  return 'value' in answer ? { account: answer.value } : answer;
}

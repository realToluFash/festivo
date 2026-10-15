/**
 * The API client. One instance, the same package the web client uses.
 *
 * Shared rather than reimplemented: base URL, the auth header, token refresh,
 * the correlation id and the error shape are decided once. Written per client,
 * each grows its own error path and most of those are never exercised.
 */
import { ApiClient } from '@soirely/api-client';
import { router } from 'expo-router';

import { config } from './config.ts';
import { currentLocale } from './i18n/index.ts';
import { tokens } from './tokens.ts';

export const api = new ApiClient({
  baseUrl: () => config.apiBaseUrl,
  locale: () => currentLocale(),
  tokens,
  // Stated rather than left to the default, because the web client states the
  // opposite and the difference is deliberate: a cookie is the best a browser
  // can do, and the Keychain is better than a cookie. See
  // docs/architecture/sessions.md.
  refreshTokenIn: 'body',
  // The session is over and nothing below this screen can be read, so the
  // whole stack goes rather than the current screen. `replace`, so Back does
  // not return to a screen that has no session behind it.
  onSignedOut: () => {
    router.replace('/sign-in?signedOut=1');
  },
});

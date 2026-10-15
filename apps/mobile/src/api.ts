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
  // Stated rather than defaulted: the web client states the opposite deliberately.
  refreshTokenIn: 'body',
  onSignedOut: () => {
    router.replace('/sign-in?signedOut=1');
  },
});

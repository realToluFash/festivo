/**
 * The API client. One instance, the same package the web client uses.
 *
 * Shared rather than reimplemented: base URL, the auth header, token refresh,
 * the correlation id and the error shape are decided once. Written per client,
 * each grows its own error path and most of those are never exercised.
 */
import { ApiClient } from '@soirely/api-client';

import { config } from './config.ts';
import { currentLocale } from './i18n/index.ts';

export const api = new ApiClient({
  baseUrl: () => config.apiBaseUrl,
  locale: () => currentLocale(),
});

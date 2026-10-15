/**
 * The API client, wired to runtime configuration.
 *
 * One instance for the whole application. `baseUrl` is a function rather than a
 * string because the client is constructed at import time and the configuration
 * is not read until boot — passing the value here would capture whatever it was
 * before load() ran, which is nothing.
 */
import { ApiClient } from '@soirely/api-client';

import { config } from './config.ts';
import { currentLocale } from './i18n/index.ts';
import { tokens } from './tokens.ts';

/**
 * Raised when the client gives up on renewing a session.
 *
 * An event rather than a callback into the session store, because the store
 * reads this module and a straight call back would be a cycle. The store
 * listens; nothing else needs to.
 */
export const SIGNED_OUT = 'soirely:signed-out';

export const api = new ApiClient({
  baseUrl: () => config().apiBaseUrl,
  locale: () => currentLocale(),
  tokens,
  // The API returns the refresh token as a cookie this page cannot read. See
  // docs/architecture/sessions.md for why that, and not localStorage.
  refreshTokenIn: 'cookie',
  onSignedOut: () => {
    window.dispatchEvent(new Event(SIGNED_OUT));
  },
});

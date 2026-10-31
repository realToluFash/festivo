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
import { dropRegistration } from './pendingRegistration.ts';
import { tokens } from './tokens.ts';

/** An event rather than a call, because the session store reads this module. */
export const SIGNED_OUT = 'soirely:signed-out';

export const GATED = 'soirely:gated';

export const api = new ApiClient({
  baseUrl: () => config().apiBaseUrl,
  locale: () => currentLocale(),
  timeZone: () => Intl.DateTimeFormat().resolvedOptions().timeZone,
  tokens,
  refreshTokenIn: 'cookie',
  onSignedOut: (why) => {
    window.dispatchEvent(new CustomEvent(SIGNED_OUT, { detail: why }));
  },
  // Held for getting back to a code with no session (sc-512); a session in this tab means they went another way.
  onSignedIn: dropRegistration,
  onGate: () => {
    window.dispatchEvent(new Event(GATED));
  },
});

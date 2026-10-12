import Constants from 'expo-constants';

/**
 * Where the API is, from configuration rather than from a literal.
 *
 * Bundled at build time via app.config.ts, which is right for mobile and wrong
 * for the web client — see the note in app.config.ts for why the two differ.
 *
 * The development fallback is localhost, and it is deliberately NOT a remote
 * host. A simulator reaches the host machine on localhost; a real device does
 * not, and the README says what to set instead. Falling back to a staging URL
 * would mean a device that appears to work while quietly writing to the wrong
 * environment.
 */
interface Extra {
  apiUrl?: string;
  environment?: string;
}

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

const DEVELOPMENT_FALLBACK = 'http://localhost:8080';

export const config = {
  apiBaseUrl: (extra.apiUrl ?? DEVELOPMENT_FALLBACK).replace(/\/$/, ''),
  environment: extra.environment ?? 'development',
  /** True when nothing configured the URL, so a screen can say so out loud. */
  usingFallbackApiUrl: extra.apiUrl == null || extra.apiUrl === '',
} as const;

/**
 * The access token, in memory and nowhere else.
 *
 * Not localStorage, not sessionStorage, not a cookie the page can read. A token
 * any of those hold is a token a cross-site script can read and send somewhere
 * else, and it stays valid for its full fifteen minutes wherever it ends up.
 * Held here it lives in a closure, which an injected script can only reach
 * while it is running inside this page.
 *
 * The refresh token is not here at all: the API returns it as an httpOnly
 * cookie. So a reload loses the access token and keeps the session, and the
 * first request after a reload goes out unauthenticated, comes back 401, and
 * ApiClient renews from the cookie and retries it. That is one wasted request
 * per page load and no sign-in screen, which is the right way round.
 *
 * See docs/architecture/sessions.md.
 */
import type { TokenStore } from '@soirely/api-client';

let accessToken: string | null = null;
let sessionId: string | null = null;

export const tokens: TokenStore = {
  access: () => accessToken,

  // Nothing to answer with, and nothing missing: the browser attaches the
  // cookie to the refresh request without this file's help.
  refresh: () => null,

  save: (issued) => {
    accessToken = issued.accessToken;
    sessionId = issued.sessionId;
  },

  clear: () => {
    accessToken = null;
    sessionId = null;
  },
};

/**
 * Which of the listed sessions this page is.
 *
 * Not a secret — the list returns every id for the account — and it is the
 * only way to mark a row as this device, because the list carries no flag
 * saying so and an access token says nothing about which row issued it.
 */
export function currentSessionId(): string | null {
  return sessionId;
}

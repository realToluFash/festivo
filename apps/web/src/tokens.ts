import type { TokenStore } from '@soirely/api-client';

let accessToken: string | null = null;
let sessionId: string | null = null;

export const tokens: TokenStore = {
  access: () => accessToken,

  // The browser attaches the httpOnly cookie to the refresh request itself.
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

export function currentSessionId(): string | null {
  return sessionId;
}

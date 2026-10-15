/**
 * The access token in memory, the refresh token in the Keychain.
 *
 * The refresh token is the one worth protecting: thirty days of sessions, and
 * it has to survive the app being closed or there is no staying signed in. The
 * platform keystore — Keychain on iOS, Keystore-backed storage on Android — is
 * the best place a native app has for it, and it is better than the cookie the
 * browser gets: no cross-site request forgery to answer for, and nothing else
 * on the device can read it.
 *
 * The access token is not persisted at all. It lives fifteen minutes; writing
 * it anywhere would be storing a secret to save one refresh.
 *
 * See docs/architecture/sessions.md.
 */
import type { IssuedTokens, TokenStore } from '@soirely/api-client';
import * as SecureStore from 'expo-secure-store';

const REFRESH_KEY = 'soirely.refreshToken';

let accessToken: string | null = null;
let refreshToken: string | null = null;
/** Whether the keystore has been read yet this launch. */
let read = false;

export const tokens: TokenStore = {
  access: () => accessToken,

  /**
   * Read through on the first call of a launch, so a cold start restores the
   * session: the first request goes out unauthenticated, comes back 401, and
   * the client renews from this.
   */
  refresh: async () => {
    if (!read) {
      refreshToken = await load();
      read = true;
    }

    return refreshToken;
  },

  save: async (issued: IssuedTokens) => {
    accessToken = issued.accessToken;

    // Absent in cookie mode, which this client never asks for — but a missing
    // token must not wipe the stored one, or a malformed answer signs somebody
    // out of a session that is still good.
    if (issued.refreshToken == null) return;

    refreshToken = issued.refreshToken;
    read = true;

    await store(issued.refreshToken);
  },

  clear: async () => {
    accessToken = null;
    refreshToken = null;
    read = true;

    await forget();
  },
};

/**
 * The keystore is not everywhere.
 *
 * `expo-secure-store` has no implementation on web, where this app also runs
 * through React Native Web, and a device can refuse the keystore. Both are
 * handled the same way: hold the token in memory for this launch rather than
 * failing to sign in. The session then lasts until the app is closed, which is
 * the honest outcome — the alternative is writing a thirty-day credential
 * somewhere readable.
 */
async function usable(): Promise<boolean> {
  try {
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
}

async function load(): Promise<string | null> {
  if (!(await usable())) return refreshToken;

  try {
    return await SecureStore.getItemAsync(REFRESH_KEY);
  } catch {
    return null;
  }
}

async function store(token: string): Promise<void> {
  if (!(await usable())) return;

  try {
    await SecureStore.setItemAsync(REFRESH_KEY, token, {
      // Available after one unlock since boot, and never backed up or synced
      // to another device: a session belongs to the device that signed in.
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
    });
  } catch {
    // Kept in memory above, so the session still works for this launch.
  }
}

async function forget(): Promise<void> {
  if (!(await usable())) return;

  try {
    await SecureStore.deleteItemAsync(REFRESH_KEY);
  } catch {
    // Nothing to do: the value in memory is already gone.
  }
}

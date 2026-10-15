import type { IssuedTokens, TokenStore } from '@soirely/api-client';
import * as SecureStore from 'expo-secure-store';

const REFRESH_KEY = 'soirely.refreshToken';

let accessToken: string | null = null;
let refreshToken: string | null = null;
let read = false;

export const tokens: TokenStore = {
  access: () => accessToken,

  refresh: async () => {
    if (!read) {
      refreshToken = await load();
      read = true;
    }

    return refreshToken;
  },

  save: async (issued: IssuedTokens) => {
    accessToken = issued.accessToken;

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

/** No keystore on web, and a device can refuse one: memory for the launch rather than a failure. */
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
      // THIS_DEVICE_ONLY: a backup must not restore a session onto another device.
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
    // The value in memory is already gone.
  }
}

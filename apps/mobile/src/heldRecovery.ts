import * as SecureStore from 'expo-secure-store';

const KEY = 'soirely.twoFactorRecovery';

let held: string | null = null;

/** Kept like the refresh token: the answer can take days, and the OS may close the app meanwhile (sc-509). */
export async function holdRecovery(recovery: string): Promise<void> {
  held = recovery;

  try {
    if (await SecureStore.isAvailableAsync()) {
      await SecureStore.setItemAsync(KEY, recovery, {
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
      });
    }
  } catch {
    // Held in memory above, so this launch still has it.
  }
}

export async function heldRecovery(): Promise<string | null> {
  if (held != null) return held;

  try {
    held = (await SecureStore.isAvailableAsync()) ? await SecureStore.getItemAsync(KEY) : null;
  } catch {
    held = null;
  }

  return held;
}

export async function dropRecovery(): Promise<void> {
  held = null;

  try {
    if (await SecureStore.isAvailableAsync()) await SecureStore.deleteItemAsync(KEY);
  } catch {
    // Gone from memory already.
  }
}

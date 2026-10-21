import * as SecureStore from 'expo-secure-store';

const KEY = 'soirely.requestLink';

let held: string | null = null;

/** Kept like the registration (sc-562): reading the email can mean leaving the app, and the OS may close it. */
export async function holdLink(token: string): Promise<void> {
  held = token;

  try {
    if (await SecureStore.isAvailableAsync()) {
      await SecureStore.setItemAsync(KEY, token, {
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
      });
    }
  } catch {
    // Held in memory above, so this launch still has it.
  }
}

/** Once, so a later sign-in lands where the account belongs. */
export async function takeHeldLink(): Promise<string | null> {
  let token = held;
  held = null;

  try {
    if (await SecureStore.isAvailableAsync()) {
      token ??= await SecureStore.getItemAsync(KEY);
      await SecureStore.deleteItemAsync(KEY);
    }
  } catch {
    // Taken from memory already, if this launch held it.
  }

  return token;
}

import * as SecureStore from 'expo-secure-store';

const KEY = 'soirely.requestLink';

/** The pending registration's lifetime (PendingRegistration::LIFETIME_HOURS): past it the journey the link rides on has ended (sc-19752). */
const LIFETIME_MS = 24 * 60 * 60 * 1000;

type Held = { token: string; heldAt: number };

let held: Held | null = null;

/** Kept like the registration (sc-562): reading the email can mean leaving the app, and the OS may close it. */
export async function holdLink(token: string): Promise<void> {
  held = { token, heldAt: Date.now() };

  try {
    if (await SecureStore.isAvailableAsync()) {
      await SecureStore.setItemAsync(KEY, JSON.stringify(held), {
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
      });
    }
  } catch {
    // Held in memory above, so this launch still has it.
  }
}

/** Once, so a later sign-in lands where the account belongs. */
export async function takeHeldLink(): Promise<string | null> {
  let taken = held;
  held = null;

  try {
    if (await SecureStore.isAvailableAsync()) {
      taken ??= kept(await SecureStore.getItemAsync(KEY));
      await SecureStore.deleteItemAsync(KEY);
    }
  } catch {
    // Taken from memory already, if this launch held it.
  }

  return taken != null && Date.now() - taken.heldAt < LIFETIME_MS ? taken.token : null;
}

/** A bare token, as an earlier build kept it, has no time to measure from, so it has lapsed. */
function kept(stored: string | null): Held | null {
  try {
    const parsed = JSON.parse(stored ?? 'null') as Partial<Held> | null;

    return typeof parsed?.token === 'string' && typeof parsed.heldAt === 'number'
      ? { token: parsed.token, heldAt: parsed.heldAt }
      : null;
  } catch {
    return null;
  }
}

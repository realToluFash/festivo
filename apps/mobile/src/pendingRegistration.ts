import { type PendingRegistration } from '@soirely/api-client';
import * as SecureStore from 'expo-secure-store';

const KEY = 'soirely.registration';

let held: PendingRegistration | null = null;

/** Kept like the refresh token: reading the email can mean leaving the app, and the OS may close it. */
export async function holdRegistration(pending: PendingRegistration): Promise<void> {
  held = pending;

  try {
    if (await SecureStore.isAvailableAsync()) {
      await SecureStore.setItemAsync(KEY, JSON.stringify(pending), {
        keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
      });
    }
  } catch {
    // Held in memory above, so this launch still has it.
  }
}

export async function heldRegistration(): Promise<PendingRegistration | null> {
  if (held != null) return held;

  try {
    if (!(await SecureStore.isAvailableAsync())) return null;

    const parsed = JSON.parse(
      (await SecureStore.getItemAsync(KEY)) ?? 'null',
    ) as Partial<PendingRegistration> | null;

    held =
      typeof parsed?.registration === 'string' && typeof parsed.email === 'string'
        ? { registration: parsed.registration, email: parsed.email }
        : null;
  } catch {
    held = null;
  }

  return held;
}

export async function dropRegistration(): Promise<void> {
  held = null;

  try {
    if (await SecureStore.isAvailableAsync()) await SecureStore.deleteItemAsync(KEY);
  } catch {
    // Gone from memory already.
  }
}

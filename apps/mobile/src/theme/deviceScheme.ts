import * as SecureStore from 'expo-secure-store';

import type { Scheme } from './tokens.ts';

const SCHEME_KEY = 'soirely.colourScheme';
const LANDING_KEY = 'soirely.landingAfterRestart';
// Read before the first unlock too: a push can launch the app while the phone is still locked.
const KEPT = { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY };

function read(key: string): string | null {
  try {
    const value = SecureStore.getItem(key, KEPT);

    return value == null || value === '' ? null : value;
  } catch {
    return null;
  }
}

function write(key: string, value: string): boolean {
  try {
    SecureStore.setItem(key, value, KEPT);

    return read(key) === value;
  } catch {
    return false;
  }
}

/** The scheme this device last showed the person; synchronous, as the tokens are laid before the first render. */
export function deviceScheme(): string | null {
  return read(SCHEME_KEY);
}

/** True only when the device reads it back, so a restart never runs on a scheme it cannot keep. */
export function keepDeviceScheme(scheme: Scheme): boolean {
  return write(SCHEME_KEY, scheme);
}

export function holdLanding(path: string): boolean {
  return write(LANDING_KEY, path);
}

/** Where a restart asked to come back to, once. */
export function takeLanding(): string | null {
  const path = read(LANDING_KEY);
  if (path != null) write(LANDING_KEY, '');

  return path;
}

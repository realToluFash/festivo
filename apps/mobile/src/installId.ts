import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';

const KEY = 'soirely.installId';

let id: string | null = null;

/** AsyncStorage, not the Keychain, which outlives an uninstall: a reinstall must count as a new device (sc-511). True on an install's first launch. */
export async function loadInstallId(): Promise<boolean> {
  let stored: string | null;
  try {
    stored = await AsyncStorage.getItem(KEY);
  } catch {
    id = randomUUID();

    return false;
  }

  if (stored != null && stored !== '') {
    id = stored;

    return false;
  }

  id = randomUUID();
  await AsyncStorage.setItem(KEY, id).catch(() => {});

  return true;
}

export function installId(): string | null {
  return id;
}

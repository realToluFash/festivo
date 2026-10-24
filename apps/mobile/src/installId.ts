import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';

const KEY = 'soirely.installId';

let id: string | null = null;

/** AsyncStorage, not the Keychain, which outlives an uninstall: a reinstall must count as a new device (sc-511). */
export async function loadInstallId(): Promise<void> {
  const stored = await AsyncStorage.getItem(KEY).catch(() => null);

  if (stored != null && stored !== '') {
    id = stored;

    return;
  }

  id = randomUUID();
  await AsyncStorage.setItem(KEY, id).catch(() => {});
}

export function installId(): string | null {
  return id;
}

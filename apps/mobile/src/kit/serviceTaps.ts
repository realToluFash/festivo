import AsyncStorage from '@react-native-async-storage/async-storage';
import { type KeptServiceTap, type ServiceTapStore, asKeptServiceTaps } from '@soirely/api-client';

const KEPT = 'soirely.serviceTaps.';
const stores = new Map<string, ServiceTapStore>();

/** An event's service taps waiting to send, kept on the device so closing the app loses none (sc-4028). One store per event, shared by every view. */
export function storedServiceTaps(eventId: string): ServiceTapStore {
  let store = stores.get(eventId);

  if (store == null) {
    store = keptOnDevice(KEPT + eventId);
    stores.set(eventId, store);
  }

  return store;
}

function keptOnDevice(key: string): ServiceTapStore {
  let held: KeptServiceTap[] | null = null;

  return {
    load: async () => {
      if (held == null) {
        const raw = await AsyncStorage.getItem(key).catch(() => null);
        let parsed: unknown = null;

        try {
          parsed = raw == null ? null : JSON.parse(raw);
        } catch {
          parsed = null;
        }
        held ??= asKeptServiceTaps(parsed);
      }

      return [...held];
    },
    save: async (taps) => {
      held = [...taps];
      await (
        taps.length === 0
          ? AsyncStorage.removeItem(key)
          : AsyncStorage.setItem(key, JSON.stringify(taps))
      ).catch(() => undefined);
    },
  };
}

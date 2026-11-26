import AsyncStorage from '@react-native-async-storage/async-storage';
import { type KeptServiceTap, type ServiceTapStore, asKeptServiceTaps } from '@soirely/api-client';

const KEPT = 'soirely.serviceTaps.';

/** An event's service taps waiting to send, kept on the device so closing the app loses none (sc-4028). */
export function storedServiceTaps(eventId: string): ServiceTapStore {
  const key = KEPT + eventId;
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

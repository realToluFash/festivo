import { type KeptServiceTap, type ServiceTapStore, asKeptServiceTaps } from '@soirely/api-client';

const KEPT = 'soirely.serviceTaps.';
const stores = new Map<string, ServiceTapStore>();

/** An event's service taps waiting to send, kept in the browser so closing the tab loses none (sc-4028); in memory where storage is blocked. One store per event, shared by every view. */
export function storedServiceTaps(eventId: string): ServiceTapStore {
  let store = stores.get(eventId);

  if (store == null) {
    store = keptInBrowser(`${KEPT}${eventId}`);
    stores.set(eventId, store);
  }

  return store;
}

function keptInBrowser(key: string): ServiceTapStore {
  let memory: KeptServiceTap[] = [];
  let blocked = false;

  return {
    load: async () => {
      if (blocked) return [...memory];
      try {
        const raw = window.localStorage.getItem(key);

        return raw == null ? [] : asKeptServiceTaps(JSON.parse(raw));
      } catch {
        return [...memory];
      }
    },
    save: async (taps) => {
      memory = [...taps];
      try {
        if (taps.length === 0) window.localStorage.removeItem(key);
        else window.localStorage.setItem(key, JSON.stringify(taps));
      } catch {
        blocked = true;
      }
    },
  };
}

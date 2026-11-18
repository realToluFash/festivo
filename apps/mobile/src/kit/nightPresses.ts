import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  type PressStore,
  type QueueSent,
  type QueuedPress,
  type SendPress,
  asQueuedPresses,
  enqueuePress,
  sendQueue,
} from '@soirely/api-client';

const KEPT = 'soirely.nightPresses.';

/** An event's presses waiting to send, kept on the device so closing the app loses none (sc-3895). */
export function storedPresses(eventId: string): PressStore {
  const key = KEPT + eventId;
  let held: QueuedPress[] | null = null;

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
        held ??= asQueuedPresses(parsed);
      }

      return [...held];
    },
    save: async (queue) => {
      held = [...queue];
      await (
        queue.length === 0
          ? AsyncStorage.removeItem(key)
          : AsyncStorage.setItem(key, JSON.stringify(queue))
      ).catch(() => undefined);
    },
  };
}

export interface NightPressQueue {
  keep: (press: QueuedPress) => Promise<QueuedPress[]>;
  load: () => Promise<QueuedPress[]>;
  send: (send: SendPress) => Promise<QueueSent>;
}

/** One change to the store at a time, so a press kept while the queue is sending is never written over by the send. */
export function nightPressQueue(store: PressStore): NightPressQueue {
  let chain: Promise<unknown> = Promise.resolve();
  const locked = <T>(work: () => Promise<T>): Promise<T> => {
    const run = chain.then(work);

    chain = run.catch(() => undefined);

    return run;
  };

  return {
    keep: (press) => locked(() => enqueuePress(store, press)),
    load: () => locked(() => store.load()),
    send: (send) => {
      let taken: QueuedPress[] = [];
      const sending: PressStore = {
        load: () =>
          locked(async () => {
            taken = await store.load();

            return taken;
          }),
        save: (left) =>
          locked(async () => {
            const still = new Set(left.map((press) => press.key));
            const gone = new Set(
              taken.filter((press) => !still.has(press.key)).map((press) => press.key),
            );

            await store.save((await store.load()).filter((press) => !gone.has(press.key)));
          }),
      };

      return sendQueue(sending, send);
    },
  };
}

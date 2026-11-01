/** The 20 s after which sc-4028's service strip reads Reconnecting: one state, one number (sc-22586). */
export const NO_ANSWER_MS = 20_000;

/** `deviceBack` is a reason to ask again, never proof of an answer: captive Wi-Fi says it too. */
export type ConnectionChange = 'lost' | 'answered' | 'deviceBack';

export interface Connection {
  observe(answer: Promise<unknown>, signal?: AbortSignal | null): void;
  deviceOffline(): void;
  deviceOnline(): void;
  subscribe(listener: (change: ConnectionChange) => void): () => void;
}

export function createConnection(
  timers: {
    set: (run: () => void, ms: number) => unknown;
    clear: (timer: unknown) => void;
  } = { set: (run, ms) => setTimeout(run, ms), clear: (timer) => clearTimeout(timer as never) },
): Connection {
  const listeners = new Set<(change: ConnectionChange) => void>();
  const tell = (change: ConnectionChange) => {
    for (const listener of [...listeners]) listener(change);
  };

  return {
    observe(answer, signal) {
      const silent = timers.set(() => tell('lost'), NO_ANSWER_MS);

      answer.then(
        () => {
          timers.clear(silent);
          tell('answered');
        },
        () => {
          timers.clear(silent);
          if (signal?.aborted !== true) tell('lost');
        },
      );
    },
    deviceOffline: () => tell('lost'),
    deviceOnline: () => tell('deviceBack'),
    subscribe(listener) {
      listeners.add(listener);

      return () => listeners.delete(listener);
    },
  };
}

/** The one each client feeds from its fetch and the device's network state. */
export const connection = createConnection();

/** The 20 s after which sc-4028's service strip reads Reconnecting: one state, one number (sc-22586). */
export const NO_ANSWER_MS = 20_000;

/** `deviceBack` is a reason to ask again, never proof of an answer: captive Wi-Fi says it too. */
export type ConnectionChange = 'lost' | 'answered' | 'deviceBack';

/** The parts of a request's init the watcher reads. */
export interface Asked {
  signal?: AbortSignal | null;
  body?: unknown;
}

export interface Connection {
  observe(answer: Promise<unknown>, asked?: Asked): void;
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
    observe(answer, asked) {
      // An upload can take longer than 20 s while Soirely is receiving it: only a request with no body falls silent.
      const silent = asked?.body == null ? timers.set(() => tell('lost'), NO_ANSWER_MS) : null;

      answer.then(
        () => {
          if (silent != null) timers.clear(silent);
          tell('answered');
        },
        () => {
          if (silent != null) timers.clear(silent);
          if (asked?.signal?.aborted !== true) tell('lost');
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

/** Rejects with `unanswered()` once `ms` pass with no answer, while the load itself carries on unwatched. */
export function answeredWithin<T>(
  load: Promise<T>,
  unanswered: () => unknown,
  ms: number = NO_ANSWER_MS,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(unanswered()), ms);

    load.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

import { type Connection, NO_ANSWER_MS, answeredWithin } from './connection.ts';

/** A load that never reached Soirely: the connection fell silent while it was out, or it had no answer for 20 s. */
export class NotReached extends Error {
  constructor(readonly reason: unknown = null) {
    super('Soirely was not reached');
    this.name = 'NotReached';
  }
}

/** Whether a failed load keeps what the screen already shows: only when Soirely never answered it. */
export function keepsWhatLoaded(error: unknown): boolean {
  return error instanceof NotReached;
}

export interface OfflineState {
  /** When Soirely last answered a load of this screen: the band's "since". */
  at: Date | null;
  stale: boolean;
  out: number;
  /** Counts the presses of Try again that came back unanswered, each one announced again. */
  unanswered: number;
}

/** The least time between two loads the watch starts by itself, so a flaky network cannot spin it. */
export const ASK_AGAIN_FLOOR_MS = 2_000;

export interface OfflineWatch {
  /** Every load of the screen goes through here, or the band never learns that Soirely answered again. */
  watch<T>(load: Promise<T>): Promise<T>;
  retry(): void;
  askAgain(): void;
  /** The screen as it stands this render: whether it shows a load, how it loads again, and where focus goes after a press. */
  setScreen(screen: Screen): void;
  state(): OfflineState;
  subscribe(listener: () => void): () => void;
  start(): () => void;
}

export interface Screen {
  loaded: boolean;
  reload: () => void;
  pressAnswered: () => void;
}

export function createOfflineWatch({
  connection,
  now = () => new Date(),
}: {
  connection: Connection;
  now?: () => Date;
}): OfflineWatch {
  let state: OfflineState = { at: null, stale: false, out: 0, unanswered: 0 };
  let screen: Screen = { loaded: false, reload: () => {}, pressAnswered: () => {} };
  let pressed = false;
  let askedWhileOut = false;
  let lastStart = Number.NEGATIVE_INFINITY;
  let askLater: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  const outLoads = new Set<{ lost: boolean }>();
  const listeners = new Set<() => void>();

  const set = (change: Partial<OfflineState>) => {
    state = { ...state, ...change };
    for (const listener of [...listeners]) listener();
  };

  const askAgainSoon = () => {
    if (askLater != null || stopped) return;
    askLater = setTimeout(
      () => {
        askLater = null;
        screen.reload();
      },
      Math.max(0, lastStart + ASK_AGAIN_FLOOR_MS - now().getTime()),
    );
  };

  const askAgain = () => {
    if (!state.stale) return;

    if (state.out === 0) screen.reload();
    else askedWhileOut = true;
  };

  return {
    watch<T>(load: Promise<T>): Promise<T> {
      const heard = { lost: false };
      outLoads.add(heard);
      lastStart = now().getTime();
      set({ out: state.out + 1 });
      const asked = screen.loaded
        ? answeredWithin(load, () => new NotReached(), NO_ANSWER_MS)
        : load;

      return asked.then(
        (value) => {
          outLoads.delete(heard);
          askedWhileOut = false;
          set({ out: state.out - 1, at: now(), stale: false });

          if (pressed) {
            pressed = false;
            screen.pressAnswered();
          }

          return value;
        },
        (error: unknown) => {
          outLoads.delete(heard);
          const reached = !(heard.lost || error instanceof NotReached);
          const pressAnsweredNot = pressed && !reached;
          pressed = false;
          set({
            out: state.out - 1,
            ...(reached ? { stale: false } : {}),
            ...(pressAnsweredNot ? { unanswered: state.unanswered + 1 } : {}),
          });

          if (askedWhileOut && !reached) askAgainSoon();
          askedWhileOut = false;

          throw reached || error instanceof NotReached ? error : new NotReached(error);
        },
      );
    },
    retry() {
      pressed = true;
      // A press while a load is out joins it: no second load, and its 20 s keep counting from the first.
      if (state.out === 0) screen.reload();
    },
    askAgain,
    setScreen(now) {
      screen = now;
    },
    state: () => state,
    subscribe(listener) {
      listeners.add(listener);

      return () => listeners.delete(listener);
    },
    start() {
      stopped = false;
      const stop = connection.subscribe((change) => {
        if (change !== 'lost') {
          askAgain();
          return;
        }

        for (const load of outLoads) load.lost = true;
        if (screen.loaded) set({ stale: true });
      });

      return () => {
        stop();
        stopped = true;
        if (askLater != null) clearTimeout(askLater);
        askLater = null;
      };
    },
  };
}

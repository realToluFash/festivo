import { NO_ANSWER_MS } from './connection.ts';

/** How fresh what a service device holds is (sc-4028). Every service view reads this one rule, and none has its own. */

export const SERVICE_HEARTBEAT_MS = 10_000;

export const SERVICE_SILENCE_MS = NO_ANSWER_MS;

/** While service is off, the read is fetched this often instead: the backoff's longest wait, so there is one. */
export const SERVICE_OFF_READ_MS = 30_000;

export const SERVICE_BACKOFF_MS = [1_000, 2_000, 4_000, 8_000, 16_000, 30_000] as const;

export const SERVICE_PHASES = ['notStarted', 'on', 'ended'] as const;

export type ServicePhase = (typeof SERVICE_PHASES)[number];

export function refetchDelay(attempt: number): number {
  return SERVICE_BACKOFF_MS[Math.min(attempt, SERVICE_BACKOFF_MS.length - 1)]!;
}

export type Freshness =
  | { state: 'connected'; asOf: Date }
  | { state: 'noConnection'; asOf: Date | null; waiting: number }
  | { state: 'notStarted' };

export const FRESHNESS_KEYS = {
  connected: 'service.fresh.connected',
  noConnection: 'service.fresh.noConnection',
  noConnectionWaiting: 'service.fresh.noConnectionWaiting',
  notStarted: 'service.fresh.notStarted',
} as const;

/** The catalogue key a strip shows, and its slots: {{time}} in the locale's hour and minute, and {{count}} for the plural family. */
export function freshnessKey(freshness: Freshness): string {
  if (freshness.state === 'connected') return FRESHNESS_KEYS.connected;
  if (freshness.state === 'notStarted') return FRESHNESS_KEYS.notStarted;

  return freshness.waiting > 0 ? FRESHNESS_KEYS.noConnectionWaiting : FRESHNESS_KEYS.noConnection;
}

export interface FreshnessTimers {
  set: (run: () => void, ms: number) => unknown;
  clear: (timer: unknown) => void;
}

export interface ServiceFreshnessDeps {
  /** sc-4005's read for the view, answering the service's phase; a rejection is a read that failed. */
  read: () => Promise<ServicePhase>;
  now?: () => Date;
  timers?: FreshnessTimers;
}

export interface ServiceFreshness {
  /** Starts with the phase the view's first read answered, or none, which reads at once. */
  start(phase?: ServicePhase | null): void;
  /** Any message on the service topic; a `phase` message carries the phase it changed to, and turns the switch on or off at once. */
  message(kind: 'heartbeat' | 'data' | 'phase', phase?: ServicePhase): void;
  read(phase: ServicePhase): void;
  deviceOffline(): void;
  deviceOnline(): void;
  waiting(count: number): void;
  state(): Freshness;
  subscribe(listener: (freshness: Freshness) => void): () => void;
  stop(): void;
}

export function createServiceFreshness(deps: ServiceFreshnessDeps): ServiceFreshness {
  const now = deps.now ?? (() => new Date());
  const timers: FreshnessTimers = deps.timers ?? {
    set: (run, ms) => setTimeout(run, ms),
    clear: (timer) => clearTimeout(timer as never),
  };
  const listeners = new Set<(freshness: Freshness) => void>();

  let phase: ServicePhase | null = null;
  let known: Date | null = null;
  let heard = false;
  let offline = false;
  let lastReadFailed = false;
  let kept = 0;
  let silence: unknown = null;
  let refetch: unknown = null;
  let attempt = 0;
  let running = false;
  let reading = false;

  const current = (): Freshness => {
    const noConnection = { state: 'noConnection' as const, asOf: known, waiting: kept };

    if (offline) return noConnection;
    if (phase === 'on') return heard ? { state: 'connected', asOf: known ?? now() } : noConnection;
    if (lastReadFailed || phase === null) return noConnection;
    if (phase === 'notStarted') return { state: 'notStarted' };

    return { state: 'connected', asOf: known ?? now() };
  };

  let shown = JSON.stringify(current());
  const tell = () => {
    const next = current();
    const said = JSON.stringify(next);

    if (said === shown) return;
    shown = said;
    for (const listener of [...listeners]) listener(next);
  };

  const learnt = () => {
    known = now();
  };

  const clearSilence = () => {
    if (silence != null) timers.clear(silence);
    silence = null;
  };

  const clearRefetch = () => {
    if (refetch != null) timers.clear(refetch);
    refetch = null;
  };

  const listen = () => {
    clearSilence();
    if (!running || phase !== 'on') return;
    silence = timers.set(() => {
      silence = null;
      heard = false;
      attempt = 0;
      tell();
      schedule(refetchDelay(attempt));
    }, SERVICE_SILENCE_MS);
  };

  const schedule = (ms: number) => {
    clearRefetch();
    if (!running) return;
    refetch = timers.set(() => {
      refetch = null;
      void readNow();
    }, ms);
  };

  const enter = (next: ServicePhase) => {
    const was = phase;
    phase = next;

    if (next === 'on') {
      if (was !== 'on') {
        clearRefetch();
        listen();
      }

      return;
    }

    clearSilence();
    heard = false;
    if (refetch == null) schedule(SERVICE_OFF_READ_MS);
  };

  const readNow = async () => {
    if (reading) return;
    reading = true;

    try {
      const answered = await deps.read();

      if (!running) return;
      lastReadFailed = false;
      learnt();
      attempt = 0;
      clearRefetch();
      if (phase === null && answered === 'on') heard = true;
      enter(answered);
      if (answered === 'on') listen();
      else schedule(SERVICE_OFF_READ_MS);
    } catch {
      if (!running) return;
      lastReadFailed = true;
      if (phase === 'on') {
        attempt += 1;
        schedule(refetchDelay(attempt));
      } else {
        schedule(SERVICE_OFF_READ_MS);
      }
    } finally {
      reading = false;
      tell();
    }
  };

  return {
    start(first = null) {
      running = true;

      if (first == null) {
        void readNow();

        return;
      }

      learnt();
      heard = first === 'on';
      enter(first);
      tell();
    },
    message(kind, next) {
      if (!running) return;
      learnt();
      heard = true;
      lastReadFailed = false;
      attempt = 0;
      clearRefetch();
      if (kind === 'phase' && next != null) enter(next);
      else if (kind === 'heartbeat' && phase !== 'on') enter('on');
      if (phase === 'on') listen();
      else schedule(SERVICE_OFF_READ_MS);
      tell();
    },
    read(answered) {
      if (!running) return;
      lastReadFailed = false;
      learnt();
      enter(answered);
      tell();
    },
    deviceOffline() {
      offline = true;
      heard = false;
      tell();
    },
    deviceOnline() {
      if (!offline) return;
      offline = false;
      attempt = 0;
      tell();
      void readNow();
    },
    waiting(count) {
      kept = count;
      tell();
    },
    state: current,
    subscribe(listener) {
      listeners.add(listener);

      return () => listeners.delete(listener);
    },
    stop() {
      running = false;
      clearSilence();
      clearRefetch();
    },
  };
}

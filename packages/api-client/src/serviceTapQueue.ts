import {
  type FloorReversed,
  type HeldChoice,
  type ItemMark,
  type ItemState,
  KEPT_TAPS,
  type KeptTap,
  type ReadyIn,
  type SentBackReason,
  type TapExpected,
  type TapRefusal,
  tapOutcome,
  tapRefusals,
} from '@soirely/domain';

import { ApiError } from './problem.ts';

/** A service tap kept until the API has it (sc-4028): saved before the screen updates, sent in order with its own key however often it is retried. */
export interface KeptServiceTap {
  key: string;
  eventId: string;
  kind: KeptTap;
  method: 'POST' | 'PUT' | 'DELETE';
  /** Under the event's service path, as `/trays/{id}/check`. */
  path: string;
  body: Record<string, unknown>;
  expected: TapExpected;
  tappedAt: string;
  /** What a Floor Undo takes back, so it shows before it is sent; never sent. */
  reverses?: FloorReversed;
}

export type ServiceTapStep =
  | { kind: 'mark'; trayId: string; plateId: string; item: string; mark: ItemMark | null }
  | { kind: 'check' | 'takeToTable' | 'allServed'; trayId: string }
  | { kind: 'takeOff' | 'tick'; trayId: string; plateId: string }
  | { kind: 'sendBack'; plateId: string; reason: SentBackReason }
  | { kind: 'choice'; plateId: string; choice: HeldChoice }
  | {
      kind: 'itemState';
      courseId: string;
      item: string;
      state: ItemState;
      readyIn?: ReadyIn | null;
    }
  | { kind: 'undo'; subject: string; reverses?: FloorReversed };

/** Floor's steps: its Undo has to say what it takes back. */
export type FloorTapStep =
  | Exclude<ServiceTapStep, { kind: 'undo' }>
  | { kind: 'undo'; subject: string; reverses: FloorReversed };

const id = encodeURIComponent;

function request(step: ServiceTapStep): Pick<KeptServiceTap, 'method' | 'path' | 'body'> {
  switch (step.kind) {
    case 'mark':
      return {
        method: 'PUT',
        path: `/trays/${id(step.trayId)}/marks`,
        body: { plateId: step.plateId, item: step.item, mark: step.mark },
      };
    case 'check':
      return { method: 'POST', path: `/trays/${id(step.trayId)}/check`, body: {} };
    case 'takeToTable':
      return { method: 'POST', path: `/trays/${id(step.trayId)}/take-to-table`, body: {} };
    case 'allServed':
      return { method: 'POST', path: `/trays/${id(step.trayId)}/all-served`, body: {} };
    case 'takeOff':
      return {
        method: 'DELETE',
        path: `/trays/${id(step.trayId)}/plates/${id(step.plateId)}`,
        body: {},
      };
    case 'tick':
      return {
        method: 'POST',
        path: `/trays/${id(step.trayId)}/plates/${id(step.plateId)}/served`,
        body: {},
      };
    case 'sendBack':
      return {
        method: 'POST',
        path: `/plates/${id(step.plateId)}/sent-back`,
        body: { reason: step.reason },
      };
    case 'choice':
      return {
        method: 'PUT',
        path: `/plates/${id(step.plateId)}/choice`,
        body: { choice: step.choice },
      };
    case 'itemState':
      return {
        method: 'PUT',
        path: `/course/${id(step.courseId)}/items`,
        body: {
          item: step.item,
          state: step.state,
          ...(step.readyIn === undefined ? {} : { readyIn: step.readyIn }),
        },
      };
    case 'undo':
      return { method: 'POST', path: '/undo', body: { subject: step.subject } };
  }
}

/** The tap as it is kept, with a fresh key from the platform (expo-crypto in the app) and what the device saw when it was tapped. */
export function keptServiceTap(
  eventId: string,
  step: ServiceTapStep,
  expected: TapExpected,
  key: string,
  tappedAt: Date = new Date(),
): KeptServiceTap {
  return {
    key,
    eventId,
    kind: step.kind,
    expected,
    tappedAt: tappedAt.toISOString(),
    ...request(step),
    ...(step.kind === 'undo' && step.reverses != null ? { reverses: step.reverses } : {}),
  };
}

export interface ServiceTapStore {
  load(): Promise<KeptServiceTap[]>;
  save(taps: KeptServiceTap[]): Promise<void>;
}

export function memoryServiceTapStore(initial: KeptServiceTap[] = []): ServiceTapStore {
  let taps = [...initial];

  return {
    load: async () => [...taps],
    save: async (next) => {
      taps = [...next];
    },
  };
}

export async function keepServiceTap(
  store: ServiceTapStore,
  tap: KeptServiceTap,
): Promise<KeptServiceTap[]> {
  const taps = [...(await store.load()), tap];

  await store.save(taps);

  return taps;
}

export function asKeptServiceTaps(raw: unknown): KeptServiceTap[] {
  if (!Array.isArray(raw)) return [];

  return raw.filter((one): one is KeptServiceTap => {
    if (typeof one !== 'object' || one == null) return false;
    const tap = one as Partial<KeptServiceTap>;

    return (
      typeof tap.key === 'string' &&
      typeof tap.eventId === 'string' &&
      (KEPT_TAPS as readonly unknown[]).includes(tap.kind) &&
      ['POST', 'PUT', 'DELETE'].includes(tap.method as string) &&
      typeof tap.path === 'string' &&
      typeof tap.body === 'object' &&
      tap.body != null &&
      typeof tap.expected === 'object' &&
      tap.expected != null &&
      typeof tap.tappedAt === 'string'
    );
  });
}

/** One kept tap sent: rejects with the ApiError it was refused with, or whatever a failed fetch throws. */
export type SendServiceTap = (tap: KeptServiceTap) => Promise<unknown>;

export interface ServiceTapRefused {
  tap: KeptServiceTap;
  lines: TapRefusal[];
}

export interface ServiceTapsSent {
  refused: ServiceTapRefused[];
  /** Still kept: the send stopped with no answer. */
  left: KeptServiceTap[];
  /** Every kept tap was answered, so the view reads once now to replace what it shows. */
  refetch: boolean;
}

export interface SendServiceTapsOptions {
  wait?: (seconds: number) => Promise<void>;
}

const wait = (seconds: number) =>
  new Promise<void>((done) => setTimeout(done, Math.max(1, seconds) * 1_000));

const sending = new WeakMap<ServiceTapStore, Promise<ServiceTapsSent>>();

/** Oldest first, a tap kept mid-send going too; a second call while one runs waits and sends nothing, so no tap or refusal line comes twice. */
export async function sendServiceTaps(
  store: ServiceTapStore,
  send: SendServiceTap,
  options: SendServiceTapsOptions = {},
): Promise<ServiceTapsSent> {
  const running = sending.get(store);

  if (running != null) {
    await running.catch(() => undefined);

    return { refused: [], left: await store.load(), refetch: false };
  }

  const run = sendInOrder(store, send, options);
  sending.set(store, run);

  try {
    return await run;
  } finally {
    sending.delete(store);
  }
}

async function sendInOrder(
  store: ServiceTapStore,
  send: SendServiceTap,
  options: SendServiceTapsOptions,
): Promise<ServiceTapsSent> {
  const pause = options.wait ?? wait;
  const refused: ServiceTapRefused[] = [];
  let sent = false;

  for (;;) {
    const [tap] = await store.load();

    if (tap == null) break;

    let error: unknown = null;

    try {
      await send(tap);
    } catch (thrown) {
      error = thrown;
    }

    const outcome = tapOutcome(
      error == null ? 200 : error instanceof ApiError ? error.status : null,
    );

    if (outcome === 'keep') break;
    if (outcome === 'wait') {
      const after = Number((error as ApiError).response?.headers.get('Retry-After'));

      await pause(Number.isFinite(after) && after > 0 ? after : 1);
      continue;
    }

    if (outcome === 'refused') {
      const problem = (error as ApiError).problem as ApiError['problem'] & {
        changed?: unknown;
        waiter?: unknown;
      };

      refused.push({ tap, lines: tapRefusals(problem) });
    }

    sent = true;
    await store.save((await store.load()).filter((one) => one.key !== tap.key));
  }

  const left = await store.load();

  return { refused, left, refetch: sent && left.length === 0 };
}

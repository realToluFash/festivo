import { zonedAt } from '@soirely/domain';

import { ApiError } from './problem.ts';
import type { PressSent, Schedule, ScheduleItem, ScheduleItemPress } from './schedule.ts';

/** A press kept until the API has it (sc-3895): saved before the screen updates, so closing the app loses nothing. */
export interface QueuedPress extends PressSent {
  eventId: string;
  itemId: string;
  kind: ScheduleItemPress;
  title: string;
}

/** Where the queue lives between launches: AsyncStorage in the app, localStorage on the web. */
export interface PressStore {
  load(): Promise<QueuedPress[]>;
  save(queue: QueuedPress[]): Promise<void>;
}

/** A press the API answered without applying it, with the earlier press it lost to when there is one, and the 409's own title for when there is none. */
export interface PressLost {
  press: QueuedPress;
  code: string;
  by: { name: string; at: string } | null;
  said: string;
}

export interface QueueSent {
  /** The schedule the last answered press came back with. */
  schedule: Schedule | null;
  lost: PressLost[];
  /** Still waiting: the send stopped at a network error. */
  left: QueuedPress[];
}

export type SendPress = (press: QueuedPress) => Promise<Schedule>;

/** Adds a press to the end of the queue and saves it, before anything is sent. */
export async function enqueuePress(store: PressStore, press: QueuedPress): Promise<QueuedPress[]> {
  const queue = [...(await store.load()), press];

  await store.save(queue);

  return queue;
}

/** One press at a time, oldest first, read from the store each time so a press saved mid-send is kept; a network error stops the send. */
export async function sendQueue(store: PressStore, send: SendPress): Promise<QueueSent> {
  let schedule: Schedule | null = null;
  const lost: PressLost[] = [];

  for (;;) {
    const [press] = await store.load();

    if (press == null) break;

    try {
      schedule = await send(press);
    } catch (error) {
      if (!(error instanceof ApiError) || error.status >= 500 || error.status === 429) break;

      lost.push({
        press,
        code: error.code,
        by: error.problem.superseded_by ?? null,
        said: error.problem.title,
      });
    }

    await store.save((await store.load()).filter((one) => one.key !== press.key));
  }

  return { schedule, lost, left: await store.load() };
}

/** A store in memory, for tests and for a browser whose storage is blocked. */
export function memoryPressStore(initial: QueuedPress[] = []): PressStore {
  let queue = [...initial];

  return {
    load: async () => [...queue],
    save: async (next) => {
      queue = [...next];
    },
  };
}

export function asQueuedPresses(raw: unknown): QueuedPress[] {
  if (!Array.isArray(raw)) return [];

  return raw.filter(
    (one): one is QueuedPress =>
      typeof one === 'object' &&
      one != null &&
      typeof (one as QueuedPress).key === 'string' &&
      typeof (one as QueuedPress).eventId === 'string' &&
      typeof (one as QueuedPress).itemId === 'string' &&
      ['start', 'done', 'skip'].includes((one as QueuedPress).kind) &&
      typeof (one as QueuedPress).pressedAt === 'string' &&
      typeof (one as QueuedPress).title === 'string',
  );
}

function pressed(item: ScheduleItem, press: QueuedPress, at: string): ScheduleItem {
  if (press.kind === 'start') return { ...item, startedAt: at, endedAt: null, skipped: false };
  if (press.kind === 'skip') return { ...item, startedAt: null, endedAt: null, skipped: true };

  const startedAt = item.startedAt ?? at;

  return { ...item, startedAt, endedAt: Date.parse(startedAt) > Date.parse(at) ? startedAt : at };
}

export function withPresses(schedule: Schedule, queue: readonly QueuedPress[]): Schedule {
  const items = queue.reduce(
    (all, press) =>
      all.map((item) =>
        item.id === press.itemId
          ? pressed(item, press, zonedAt(new Date(press.pressedAt), schedule.timeZone))
          : item,
      ),
    schedule.items,
  );

  return { ...schedule, items };
}

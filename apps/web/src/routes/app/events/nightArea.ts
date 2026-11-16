import {
  type PressStore,
  type QueuedPress,
  type Schedule,
  type ScheduleItem,
  asQueuedPresses,
} from '@soirely/api-client';
import { zonedAt } from '@soirely/domain';
import type { TFunction } from 'i18next';

import { eventAreaPath } from './EventNav.tsx';

export interface KeptPresses {
  read(): QueuedPress[];
  write(queue: QueuedPress[]): void;
}

const KEPT = 'soirely.nightPresses.';

export function keptPresses(eventId: string): KeptPresses {
  const key = `${KEPT}${eventId}`;
  let memory: QueuedPress[] = [];
  let blocked = false;

  return {
    read() {
      if (blocked) return [...memory];
      try {
        const raw = window.localStorage.getItem(key);

        return raw == null ? [] : asQueuedPresses(JSON.parse(raw));
      } catch {
        return [...memory];
      }
    },
    write(queue) {
      memory = [...queue];
      try {
        if (queue.length === 0) window.localStorage.removeItem(key);
        else window.localStorage.setItem(key, JSON.stringify(queue));
      } catch {
        blocked = true;
      }
    },
  };
}

export function pressStoreOf(kept: KeptPresses): PressStore {
  return {
    load: async () => kept.read(),
    save: async (queue) => kept.write(queue),
  };
}

function pressed(item: ScheduleItem, press: QueuedPress, timeZone: string): ScheduleItem {
  const at = zonedAt(new Date(press.pressedAt), timeZone);

  switch (press.kind) {
    case 'start':
      return { ...item, startedAt: at, endedAt: null, skipped: false };
    case 'done':
      return { ...item, startedAt: item.startedAt ?? at, endedAt: at };
    case 'skip':
      return { ...item, skipped: true };
  }
}

export function withPresses(
  schedule: Schedule,
  eventId: string,
  queue: readonly QueuedPress[],
): Schedule {
  return queue
    .filter((press) => press.eventId === eventId)
    .reduce(
      (shown, press) => ({
        ...shown,
        items: shown.items.map((item) =>
          item.id === press.itemId ? pressed(item, press, shown.timeZone) : item,
        ),
      }),
      schedule,
    );
}

export function durationWords(t: TFunction, minutes: number): string {
  if (minutes < 60) return t('night.minutes', { count: minutes });
  if (minutes % 60 === 0) return t('night.hours', { count: minutes / 60 });

  return t('night.hoursMinutes', { hours: Math.floor(minutes / 60), minutes: minutes % 60 });
}

export function weekdayOf(day: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }).format(
    new Date(`${day}T12:00:00Z`),
  );
}

export function scheduleViewPath(eventId: string): string {
  return `${eventAreaPath(eventId, 'schedule')}?view=schedule`;
}

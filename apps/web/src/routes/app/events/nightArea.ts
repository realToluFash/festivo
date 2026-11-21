import { type PressStore, type QueuedPress, asQueuedPresses } from '@soirely/api-client';
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

export function durationWords(t: TFunction, minutes: number): string {
  if (minutes < 60) return t('night.minutes', { count: minutes });
  if (minutes % 60 === 0) return t('night.hours', { count: minutes / 60 });

  return t('night.hoursMinutes', { hours: Math.floor(minutes / 60), minutes: minutes % 60 });
}

export function scheduleViewPath(eventId: string): string {
  return `${eventAreaPath(eventId, 'schedule')}?view=schedule`;
}

/** The Schedule's address on a track, as Today's Open run of show names it: Run of show while the event is on, with that track's place chosen. */
export function nightTrackPath(eventId: string, track: string | null): string {
  const path = eventAreaPath(eventId, 'schedule');

  return track == null ? path : `${path}?${new URLSearchParams({ track }).toString()}`;
}

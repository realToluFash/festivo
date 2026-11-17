import { useEffect, useState, useSyncExternalStore } from 'react';

import type { Night } from './night.ts';

/** What this tab has loaded (sc-65646), held in the module's memory: it lasts while the tab is open, a reload forgets it, and nothing is written to the browser's storage. */
interface Tab {
  offline: boolean;
  events: ReadonlyMap<string, string>;
  areas: ReadonlySet<string>;
  night: Night | null;
}

const FRESH: Tab = { offline: false, events: new Map(), areas: new Set(), night: null };

let tab: Tab = FRESH;
const listeners = new Set<() => void>();

function set(next: Tab, heard = true): void {
  tab = next;
  if (heard) for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  return () => listeners.delete(listener);
}

export function tabNow(): Tab {
  return tab;
}

export function forgetTab(heard = true): void {
  set(FRESH, heard);
}

/** A page notes its own load silently as it first renders: telling listeners then would update another component mid-render. */
export function loadedIn(eventId: string, area: string, at: string, heard = true): void {
  if (tab.offline) return;

  set(
    {
      ...tab,
      events: new Map(tab.events).set(eventId, at),
      areas: new Set(tab.areas).add(`${eventId}|${area}`),
    },
    heard,
  );
}

export function loseConnection(): void {
  if (!tab.offline) set({ ...tab, offline: true });
}

export function reconnect(): void {
  if (tab.offline) set({ ...tab, offline: false });
}

export function keepNight(night: Night, heard = true): void {
  set({ ...tab, night }, heard);
}

export function nightOpened(loaded: Night, start: TabStart): Night {
  const night = start == null ? tab.night : null;

  if (night == null) return loaded;
  if (!tab.offline)
    return night.online ? night : { ...night, online: true, queued: 0, age: 0, said: '' };

  return night.online ? { ...night, online: false, age: 1 } : night;
}

export interface Kept {
  offline: boolean;
  asOf: string | null;
  areaKept: boolean;
  retry: () => void;
}

export type TabStart = 'fresh' | 'offline' | null;

/** `?tab=offline` opens a page as a link opened offline; `?tab=fresh`, or any `?state=`, starts the tab afresh. */
export function tabStartOf(state: string | null, tab: string | null): TabStart {
  if (tab === 'offline') return 'offline';

  return tab === 'fresh' || state != null ? 'fresh' : null;
}

export function useKept(eventId: string, area: string, at: string, start: TabStart = null): Kept {
  useState(() => {
    if (start != null) forgetTab(false);
    if (start === 'offline') set({ ...tab, offline: true }, false);
    loadedIn(eventId, area, at, false);

    return null;
  });
  const now = useSyncExternalStore(subscribe, tabNow);
  const opened = `${eventId}|${area}`;

  useEffect(() => {
    if (!now.offline && !now.areas.has(opened)) loadedIn(eventId, area, at);
  }, [now, opened, eventId, area, at]);

  return {
    offline: now.offline,
    asOf: now.events.get(eventId) ?? null,
    areaKept: now.areas.has(opened),
    retry: () => {
      reconnect();
      loadedIn(eventId, area, at);
    },
  };
}

export function clockWords(when: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone,
  }).format(when);
}

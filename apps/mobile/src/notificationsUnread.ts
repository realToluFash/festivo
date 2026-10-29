import { useEffect, useSyncExternalStore } from 'react';

import { api } from './api.ts';

let unread = 0;
const listeners = new Set<() => void>();

/** The bell's count, shared by the frame's bell and the feed, so reading an item there counts it down here. */
export function setUnread(count: number): void {
  unread = count;
  listeners.forEach((listener) => listener());
}

export function useUnread(): number {
  useEffect(() => {
    void api.notifications().then(
      (feed) => setUnread(feed.unreadCount),
      () => undefined,
    );
  }, []);

  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => unread,
  );
}

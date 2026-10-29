import type { NotificationItem } from '@soirely/api-client';
import { useEffect, useRef, useSyncExternalStore } from 'react';

import { api } from './api.ts';
import { followNotifications } from './liveNotifications.ts';
import { useSignedIn } from './signedIn.ts';

export type Arrival = { item: NotificationItem } | 'reread';

let unread = 0;
const listeners = new Set<() => void>();
const arrivals = new Set<(arrival: Arrival) => void>();
/** The hub publishes an item again after a refused attempt, so each is counted once. */
const counted = new Set<string>();
let following: { userId: string; bells: number; stop: () => void } | null = null;

/** The bell's count, shared by the frame's bell and the feed, so reading an item there counts it down here. */
export function setUnread(count: number): void {
  unread = count;
  listeners.forEach((listener) => listener());
}

function reread(): void {
  void api.notifications().then(
    (feed) => setUnread(feed.unreadCount),
    () => undefined,
  );
}

function arrived(item: NotificationItem): void {
  if (counted.has(item.id)) return;
  counted.add(item.id);
  if (!item.read) setUnread(unread + 1);
  arrivals.forEach((listener) => listener({ item }));
}

/** Every frame has a bell, so the bells share one line to the hub, open while any of them is on screen. */
function follow(userId: string): () => void {
  if (following?.userId !== userId) {
    following?.stop();
    following = {
      userId,
      bells: 0,
      stop: followNotifications(userId, {
        onItem: arrived,
        onGap: () => {
          reread();
          arrivals.forEach((listener) => listener('reread'));
        },
      }),
    };
  }
  const mine = following;
  mine.bells += 1;

  return () => {
    mine.bells -= 1;
    if (mine.bells > 0 || following !== mine) return;
    mine.stop();
    following = null;
  };
}

export function useUnread(): number {
  const userId = useSignedIn().account?.id;

  useEffect(reread, []);

  useEffect(() => (userId == null ? undefined : follow(userId)), [userId]);

  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => unread,
  );
}

/** The feed on screen takes each item as it is published, and reads itself again after a gap. */
export function useArrivals(onArrival: (arrival: Arrival) => void): void {
  const latest = useRef(onArrival);

  useEffect(() => {
    latest.current = onArrival;
  });

  useEffect(() => {
    const listener = (arrival: Arrival): void => latest.current(arrival);
    arrivals.add(listener);

    return () => void arrivals.delete(listener);
  }, []);
}

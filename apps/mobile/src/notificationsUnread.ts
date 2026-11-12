import type { NotificationArrival, NotificationRead } from '@soirely/api-client';
import { useEffect, useRef, useSyncExternalStore } from 'react';

import { api } from './api.ts';
import { followNotifications } from './liveNotifications.ts';
import { useSignedIn } from './signedIn.ts';

export type Arrival = NotificationArrival | { read: NotificationRead } | 'reread';

let unread = 0;
const listeners = new Set<() => void>();
const arrivals = new Set<(arrival: Arrival) => void>();
let following: { userId: string; bells: number; stop: () => void } | null = null;
let arrivalsSoFar = 0;
let lastUserId: string | null = null;

/** The bell's count, shared by the frame's bell and the feed, so reading an item there counts it down here. */
export function setUnread(count: number): void {
  unread = count;
  listeners.forEach((listener) => listener());
}

/** A count the server worked out before the latest arrival is one short, so it is dropped and the local count stands. */
export function countedSince(seen: number, count: number): boolean {
  if (seen !== arrivalsSoFar) return false;
  setUnread(count);

  return true;
}

export function arrivalsSeen(): number {
  return arrivalsSoFar;
}

function reread(): void {
  const seen = arrivalsSoFar;
  void api.notifications().then(
    (feed) => {
      if (!countedSince(seen, feed.unreadCount)) reread();
    },
    () => undefined,
  );
}

/** A raise keeps the item's id (sc-13214), so each publish reaches the screen, and the count is the server's (sc-21785). */
function arrived(arrival: NotificationArrival): void {
  arrivalsSoFar += 1;
  setUnread(arrival.unreadCount);
  arrivals.forEach((listener) => listener(arrival));
}

/** A read in another of the member's sessions moves the count as an arrival does. */
function readElsewhere(read: NotificationRead): void {
  arrivalsSoFar += 1;
  setUnread(read.unreadCount);
  arrivals.forEach((listener) => listener({ read }));
}

/** Another account on this phone starts from nothing, and a count asked for the last one is dropped. */
function forgetOtherAccount(userId: string): void {
  if (lastUserId != null && lastUserId !== userId) {
    arrivalsSoFar += 1;
    setUnread(0);
  }
  lastUserId = userId;
}

/** Every frame has a bell, so the bells share one line to the hub, open while any of them is on screen. */
function follow(userId: string): () => void {
  forgetOtherAccount(userId);
  if (following?.userId !== userId) {
    following?.stop();
    following = {
      userId,
      bells: 0,
      stop: followNotifications(userId, {
        onItem: arrived,
        onRead: readElsewhere,
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

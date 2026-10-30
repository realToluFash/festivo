import {
  asNotificationArrival,
  asNotificationRead,
  type NotificationArrival,
  type NotificationRead,
  realtimeTopic,
} from '@soirely/api-client';
import { useEffect, useRef } from 'react';

import { api } from './api.ts';
import { config } from './config.ts';

const RENEW_BEFORE_MS = 60_000;
const RETRY_MS = 5_000;

export interface LiveNotifications {
  onItem: (arrival: NotificationArrival) => void;
  onRead: (read: NotificationRead) => void;
  /** At every line that opens: what was published before it, the first one included, never arrives. */
  onGap: () => void;
}

/** The token goes in the URL, as EventSource sends no header. */
export function useLiveNotifications(userId: string, live: LiveNotifications): void {
  const latest = useRef(live);

  useEffect(() => {
    latest.current = live;
  });

  useEffect(() => {
    const hub = config().mercureUrl;
    if (hub === '') return;

    let source: EventSource | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    const connect = async (): Promise<void> => {
      let subscription;
      try {
        subscription = await api.realtimeSubscription();
      } catch {
        if (!stopped) timer = setTimeout(() => void connect(), RETRY_MS);
        return;
      }
      if (stopped) return;

      const url = new URL(hub);
      url.searchParams.append('topic', realtimeTopic('UserNotifications', userId));
      url.searchParams.append('authorization', subscription.token);

      source?.close();
      source = new EventSource(url);
      source.onopen = () => latest.current.onGap();
      source.onmessage = (message: MessageEvent<string>) => heard(message.data, latest.current);
      source.onerror = () => {
        if (source?.readyState !== EventSource.CLOSED || stopped) return;
        clearTimeout(timer);
        timer = setTimeout(() => void connect(), RETRY_MS);
      };

      const lapses = Date.parse(subscription.expiresAt) - Date.now() - RENEW_BEFORE_MS;
      clearTimeout(timer);
      timer = setTimeout(() => void connect(), Math.max(lapses, RETRY_MS));
    };

    void connect();

    return () => {
      stopped = true;
      clearTimeout(timer);
      source?.close();
    };
  }, [userId]);
}

function heard(data: string, live: LiveNotifications): void {
  let raw: unknown;
  try {
    raw = JSON.parse(data);
  } catch {
    return;
  }

  const read = asNotificationRead(raw);
  if (read != null) {
    live.onRead(read);
    return;
  }
  const arrival = asNotificationArrival(raw);
  if (arrival != null) live.onItem(arrival);
}

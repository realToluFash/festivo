import { asNotificationItem, type NotificationItem, realtimeTopic } from '@soirely/api-client';
import { useEffect, useRef } from 'react';

import { api } from './api.ts';
import { config } from './config.ts';

const RENEW_BEFORE_MS = 60_000;
const RETRY_MS = 5_000;

/** EventSource cannot send a header, so the subscriber token goes in the URL, renewed before it lapses. */
export function useLiveNotifications(
  userId: string,
  onItem: (item: NotificationItem) => void,
): void {
  const latest = useRef(onItem);

  useEffect(() => {
    latest.current = onItem;
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
      source.onmessage = (message: MessageEvent<string>) => {
        const item = parsed(message.data);
        if (item != null) latest.current(item);
      };
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

function parsed(data: string): NotificationItem | null {
  try {
    return asNotificationItem(JSON.parse(data));
  } catch {
    return null;
  }
}

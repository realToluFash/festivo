import { asNotificationItem, type NotificationItem, realtimeTopic } from '@soirely/api-client';
import { useEffect, useRef } from 'react';

import { api } from './api.ts';
import { config } from './config.ts';

const RENEW_BEFORE_MS = 60_000;
const RETRY_MS = 5_000;

/** The token goes in the URL, as EventSource sends no header; every line after the first follows a gap, renewed or not. */
export function useLiveNotifications(
  userId: string,
  onItem: (item: NotificationItem) => void,
  onGap: () => void,
): void {
  const latest = useRef({ onItem, onGap });

  useEffect(() => {
    latest.current = { onItem, onGap };
  });

  useEffect(() => {
    const hub = config().mercureUrl;
    if (hub === '') return;

    let source: EventSource | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    let opened = false;

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
      source.onopen = () => {
        if (opened) latest.current.onGap();
        opened = true;
      };
      source.onmessage = (message: MessageEvent<string>) => {
        const item = parsed(message.data);
        if (item != null) latest.current.onItem(item);
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

import { asNotificationItem, type NotificationItem, realtimeTopic } from '@soirely/api-client';
import EventSource from 'react-native-sse';

import { api } from './api.ts';
import { config } from './config.ts';

const RENEW_BEFORE_MS = 60_000;
const RETRY_MS = 5_000;

export interface LiveNotifications {
  onItem: (item: NotificationItem) => void;
  /** After a dropped line comes back: what was published meanwhile never arrives, so it is read again. */
  onGap: () => void;
}

/** The bell's topic (sc-3980). The subscriber token goes in a header, renewed before it lapses; a refusal or a dropped line connects again with a fresh one. */
export function followNotifications(userId: string, live: LiveNotifications): () => void {
  const hub = config.mercureUrl;
  if (hub === '') return () => {};

  const url = `${hub}${hub.includes('?') ? '&' : '?'}topic=${encodeURIComponent(
    realtimeTopic('UserNotifications', userId),
  )}`;
  let source: EventSource | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  let opened = false;

  const again = (after: number): void => {
    clearTimeout(timer);
    timer = setTimeout(() => void connect(), after);
  };

  const connect = async (): Promise<void> => {
    let subscription;
    try {
      subscription = await api.realtimeSubscription();
    } catch {
      if (!stopped) again(RETRY_MS);
      return;
    }
    if (stopped) return;

    source?.close();
    const current = new EventSource(url, {
      headers: { Authorization: `Bearer ${subscription.token}` },
      pollingInterval: RETRY_MS,
    });
    source = current;

    current.addEventListener('open', () => {
      if (opened) live.onGap();
      opened = true;
    });
    current.addEventListener('message', (message) => {
      const item = parsed(message.data);
      if (item != null) live.onItem(item);
    });
    current.addEventListener('error', () => {
      if (stopped || source !== current) return;
      current.close();
      again(RETRY_MS);
    });

    again(Math.max(Date.parse(subscription.expiresAt) - Date.now() - RENEW_BEFORE_MS, RETRY_MS));
  };

  void connect();

  return () => {
    stopped = true;
    clearTimeout(timer);
    source?.close();
  };
}

function parsed(data: string | null): NotificationItem | null {
  if (data == null) return null;

  try {
    return asNotificationItem(JSON.parse(data));
  } catch {
    return null;
  }
}

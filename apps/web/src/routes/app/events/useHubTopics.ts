import { type RealtimeSubscription } from '@soirely/api-client';
import { useEffect, useRef } from 'react';

import { config } from '../../../config.ts';

const RETRY_MS = 5_000;
const RENEW_BEFORE_MS = 60_000;

/** The hub's messages on these topics, read with a token `subscribe` fetches and renewed before it lapses; `onGap` when the stream opens again, so a reader catches up on what it missed. */
export function useHubTopics(
  topics: readonly string[],
  subscribe: () => Promise<RealtimeSubscription>,
  onMessage: (data: unknown) => void,
  onGap: () => void,
) {
  const latest = useRef({ subscribe, onMessage, onGap });
  const key = topics.join(' ');

  useEffect(() => {
    latest.current = { subscribe, onMessage, onGap };
  });

  useEffect(() => {
    const hub = config().mercureUrl;
    if (hub === '' || key === '') return;

    let source: EventSource | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    const connect = async (): Promise<void> => {
      let subscription;
      try {
        subscription = await latest.current.subscribe();
      } catch {
        if (!stopped) timer = setTimeout(() => void connect(), RETRY_MS);
        return;
      }
      if (stopped) return;

      const url = new URL(hub);
      for (const topic of key.split(' ')) url.searchParams.append('topic', topic);
      url.searchParams.append('authorization', subscription.token);

      source?.close();
      source = new EventSource(url);
      source.onopen = () => latest.current.onGap();
      source.onmessage = (message: MessageEvent<string>) => {
        let data: unknown = null;
        try {
          data = JSON.parse(message.data);
        } catch {
          data = null;
        }
        latest.current.onMessage(data);
      };
      source.onerror = () => {
        if (source?.readyState !== EventSource.CLOSED || stopped) return;
        clearTimeout(timer);
        timer = setTimeout(() => void connect(), RETRY_MS);
      };

      const lapses = Date.parse(subscription.expiresAt) - Date.now() - RENEW_BEFORE_MS;
      clearTimeout(timer);
      timer = setTimeout(
        () => void connect(),
        Number.isFinite(lapses) ? Math.max(lapses, RETRY_MS) : RETRY_MS,
      );
    };

    void connect();

    return () => {
      stopped = true;
      clearTimeout(timer);
      source?.close();
    };
  }, [key]);
}

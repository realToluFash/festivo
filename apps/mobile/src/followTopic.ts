import type { RealtimeSubscription } from '@soirely/api-client';
import EventSource from 'react-native-sse';

import { config } from './config.ts';

const RENEW_BEFORE_MS = 60_000;
const RETRY_MS = 5_000;

export interface TopicFollower {
  subscribe: () => Promise<RealtimeSubscription>;
  onData: (data: string | null) => void;
  /** At every line that opens, the first one included: what was published before it never arrives. */
  onGap: () => void;
  /** When a line drops, until the next one opens: what is published meanwhile never arrives. */
  onDrop?: () => void;
}

/** One Mercure topic. The subscriber token goes in a header, renewed before it lapses; a refusal or a dropped line connects again with a fresh one. False with no hub to follow. */
export function followTopic(
  topic: string,
  follower: TopicFollower,
): { stop: () => void; following: boolean } {
  const hub = config.mercureUrl;
  if (hub === '') return { stop: () => {}, following: false };

  const url = `${hub}${hub.includes('?') ? '&' : '?'}topic=${encodeURIComponent(topic)}`;
  let source: EventSource | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;

  const again = (after: number): void => {
    clearTimeout(timer);
    timer = setTimeout(() => void connect(), after);
  };

  const connect = async (): Promise<void> => {
    let subscription;
    try {
      subscription = await follower.subscribe();
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

    current.addEventListener('open', () => follower.onGap());
    current.addEventListener('message', (message) => follower.onData(message.data));
    current.addEventListener('error', () => {
      if (stopped || source !== current) return;
      current.close();
      follower.onDrop?.();
      again(RETRY_MS);
    });

    again(Math.max(Date.parse(subscription.expiresAt) - Date.now() - RENEW_BEFORE_MS, RETRY_MS));
  };

  void connect();

  return {
    stop: () => {
      stopped = true;
      clearTimeout(timer);
      source?.close();
    },
    following: true,
  };
}

/** A topic whose every change means reading again: read every so often while no line is open, and once at each line that opens. */
export function followReadingAgain(
  topic: string,
  subscribe: () => Promise<RealtimeSubscription>,
  read: () => void,
  everyMs: number,
): () => void {
  let every: ReturnType<typeof setInterval> | undefined;
  const readEvery = () => {
    every ??= setInterval(read, everyMs);
  };

  readEvery();
  const live = followTopic(topic, {
    subscribe,
    onData: read,
    onGap: () => {
      clearInterval(every);
      every = undefined;
      read();
    },
    onDrop: readEvery,
  });

  return () => {
    live.stop();
    clearInterval(every);
  };
}

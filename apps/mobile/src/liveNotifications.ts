import {
  asNotificationArrival,
  asNotificationRead,
  type NotificationArrival,
  type NotificationRead,
  realtimeTopic,
} from '@soirely/api-client';

import { api } from './api.ts';
import { followTopic } from './followTopic.ts';

export interface LiveNotifications {
  onItem: (arrival: NotificationArrival) => void;
  onRead: (read: NotificationRead) => void;
  /** At every line that opens, the first one included: what was published before it never arrives. */
  onGap: () => void;
}

/** The bell's topic (sc-3980). */
export function followNotifications(userId: string, live: LiveNotifications): () => void {
  return followTopic(realtimeTopic('UserNotifications', userId), {
    subscribe: () => api.realtimeSubscription(),
    onData: (data) => heard(data, live),
    onGap: live.onGap,
  }).stop;
}

function heard(data: string | null, live: LiveNotifications): void {
  if (data == null) return;

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

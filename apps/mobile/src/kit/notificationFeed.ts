import type { FeedItem, LoadedFeed } from '@soirely/domain';

/** A page asked for before an arrival is missing it, and the count with it, so it is asked for again. */
export async function readSettled<Page>(
  read: () => Promise<Page>,
  arrivalsSeen: () => number,
): Promise<Page> {
  const seen = arrivalsSeen();
  const page = await read();

  return arrivalsSeen() === seen ? page : readSettled(read, arrivalsSeen);
}

/** A read that did not save puts its row back to unread, and the count up with it. */
export function feedWithReadUndone<Item extends FeedItem>(
  feed: LoadedFeed<Item>,
  id: string,
): LoadedFeed<Item> {
  const item = feed.items.find((shown) => shown.id === id);
  if (item == null || !item.read) return feed;

  return {
    ...feed,
    items: feed.items.map((shown) => (shown.id === id ? { ...shown, read: false } : shown)),
    unread: feed.unread + 1,
  };
}

/** Mark all read says what the server did once it has answered: all read, or not saved. */
export async function markAllRead(client: {
  readAllNotifications(): Promise<number>;
}): Promise<{ said: 'notifications.allRead'; left: number } | { said: 'eventMute.notSaved' }> {
  try {
    return { said: 'notifications.allRead', left: await client.readAllNotifications() };
  } catch {
    return { said: 'eventMute.notSaved' };
  }
}

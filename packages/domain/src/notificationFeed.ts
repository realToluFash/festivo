import { formatDay, formatTimeOfDay } from './datetime.ts';

/** The shape `@soirely/api-client` reads as `NotificationItem`; only what the feed needs. */
export interface FeedItem {
  id: string;
  createdAt: string;
  category: string;
  eventId: string | null;
  muted: boolean;
  read: boolean;
}

export interface LoadedFeed<Item extends FeedItem> {
  items: Item[];
  unread: number;
  next: string | null;
}

/** A live item joins the top, replacing the one it rewrites (sc-13214), and the page boundary does not move; the count is the one the server published with it, as the item it rewrote may not be loaded (sc-21785). */
export function feedWithArrival<Item extends FeedItem>(
  feed: LoadedFeed<Item>,
  arrival: { item: Item; unreadCount: number },
): LoadedFeed<Item> {
  return {
    ...feed,
    items: [arrival.item, ...feed.items.filter((candidate) => candidate.id !== arrival.item.id)],
    unread: arrival.unreadCount,
  };
}

export function feedWithRead<Item extends FeedItem>(
  feed: LoadedFeed<Item>,
  id: string,
): LoadedFeed<Item> {
  const item = feed.items.find((shown) => shown.id === id);
  if (item == null || item.read) return feed;

  return {
    ...feed,
    items: feed.items.map((shown) => (shown.id === id ? { ...shown, read: true } : shown)),
    unread: Math.max(feed.unread - 1, 0),
  };
}

export function feedAllRead<Item extends FeedItem>(feed: LoadedFeed<Item>): LoadedFeed<Item> {
  return { ...feed, items: feed.items.map((item) => ({ ...item, read: true })), unread: 0 };
}

/** The next page goes below the last item, leaving out any a live arrival already showed. */
export function feedWithPage<Item extends FeedItem>(
  feed: LoadedFeed<Item>,
  page: { items: Item[]; next: string | null },
): { feed: LoadedFeed<Item>; added: Item[] } {
  const shown = new Set(feed.items.map((item) => item.id));
  const added = page.items.filter((item) => !shown.has(item.id));

  return { feed: { ...feed, items: [...feed.items, ...added], next: page.next }, added };
}

/** After a gap in the live line, page one read again replaces every loaded row in its range, so one taken away meanwhile goes too; the pages loaded below it stay, and the count is the server's. */
export function feedWithMissed<Item extends FeedItem>(
  feed: LoadedFeed<Item>,
  page: { items: Item[]; unread: number },
): LoadedFeed<Item> {
  const again = new Set(page.items.map((item) => item.id));
  const last = page.items.at(-1);
  const below = (item: Item): boolean => {
    if (last == null) return false;
    const at = Date.parse(item.createdAt);
    const lastAt = Date.parse(last.createdAt);

    return at < lastAt || (at === lastAt && item.id < last.id);
  };

  return {
    ...feed,
    items: [...page.items, ...feed.items.filter((item) => !again.has(item.id) && below(item))],
    unread: page.unread,
  };
}

/** A read made in another of the member's sessions, an unread item taken away, or one the member's own change rewrote: the rows follow it, and the count is the one the server published with it. */
export function feedWithLiveRead<Item extends FeedItem>(
  feed: LoadedFeed<Item>,
  read: { id: string | null; unreadCount: number; removed?: boolean; updated?: Item },
): LoadedFeed<Item> {
  const followed =
    read.id == null
      ? feedAllRead(feed)
      : read.removed === true
        ? { ...feed, items: feed.items.filter((item) => item.id !== read.id) }
        : read.updated != null
          ? feedWithUpdate(feed, read.updated)
          : feedWithRead(feed, read.id);

  return { ...followed, unread: read.unreadCount };
}

/** The rewritten words take the item's place, which keeps its time and its read state; an item not loaded yet stays unloaded (sc-21643). */
function feedWithUpdate<Item extends FeedItem>(
  feed: LoadedFeed<Item>,
  updated: Item,
): LoadedFeed<Item> {
  return {
    ...feed,
    items: feed.items.map((shown) =>
      shown.id === updated.id
        ? { ...updated, read: shown.read, createdAt: shown.createdAt }
        : shown,
    ),
  };
}

/** "at 14:05" today, the locale's date before today. */
export function whenShown(
  createdAt: string,
  now: Date,
  locale: string,
): { today: true; time: string } | { today: false; date: string } {
  const at = new Date(createdAt);

  return at.toDateString() === now.toDateString()
    ? { today: true, time: formatTimeOfDay(at, locale) }
    : { today: false, date: formatDay(at, locale) };
}

/** 1 to 99, then the locale's "99+", and none at 0. */
export function badgeOf(unread: number, overNinetyNine: string): string | null {
  if (unread <= 0) return null;

  return unread > 99 ? overNinetyNine : String(unread);
}

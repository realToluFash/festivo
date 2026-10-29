import { formatDay, formatTimeOfDay } from './datetime.ts';

/** The shape `@soirely/api-client` reads as `NotificationItem`; only what the feed needs. */
export interface FeedItem {
  id: string;
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

/** A live item joins the top; one already shown is left as it is, and the page boundary does not move. */
export function feedWithArrival<Item extends FeedItem>(
  feed: LoadedFeed<Item>,
  item: Item,
): LoadedFeed<Item> {
  if (feed.items.some((shown) => shown.id === item.id)) return feed;

  return { ...feed, items: [item, ...feed.items], unread: feed.unread + (item.read ? 0 : 1) };
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

/** After a gap in the live line, page one read again: what was published meanwhile joins the top, the pages loaded stay, and the count is the server's. */
export function feedWithMissed<Item extends FeedItem>(
  feed: LoadedFeed<Item>,
  page: { items: Item[]; unread: number },
): LoadedFeed<Item> {
  const shown = new Set(feed.items.map((item) => item.id));
  const missed = page.items.filter((item) => !shown.has(item.id));

  return { ...feed, items: [...missed, ...feed.items], unread: page.unread };
}

/** Mute this event is one switch per event, so every item of that event follows it at once, in the categories the server marks. */
export function feedWithMute<Item extends FeedItem>(
  feed: LoadedFeed<Item>,
  eventId: string,
  mute: { muted: boolean; markedWhenMuted: readonly string[] },
): LoadedFeed<Item> {
  return {
    ...feed,
    items: feed.items.map((item) =>
      item.eventId === eventId && mute.markedWhenMuted.includes(item.category)
        ? { ...item, muted: mute.muted }
        : item,
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

import { describe, expect, test } from 'vitest';

import {
  type FeedItem,
  type LoadedFeed,
  badgeOf,
  feedAllRead,
  feedWithArrival,
  feedWithLiveRead,
  feedWithMissed,
  feedWithPage,
  feedWithRead,
  whenShown,
} from './notificationFeed.ts';

function item(id: string, overrides: Partial<FeedItem> = {}): FeedItem {
  return {
    id,
    createdAt: '2026-10-29T10:00:00Z',
    category: 'messages',
    eventId: 'e1',
    muted: false,
    read: false,
    ...overrides,
  };
}

function at(id: string, minute: number, overrides: Partial<FeedItem> = {}): FeedItem {
  return item(id, { createdAt: `2026-10-29T10:0${minute}:00Z`, ...overrides });
}

function feed(items: FeedItem[], next: string | null = null): LoadedFeed<FeedItem> {
  return { items, unread: items.filter((shown) => !shown.read).length, next };
}

describe('the bell feed (sc-3980)', () => {
  test('a live item joins the top and counts up, without moving the page boundary', () => {
    const after = feedWithArrival(feed([item('a')], 'cursor'), item('b'));

    expect(after.items.map((shown) => shown.id)).toEqual(['b', 'a']);
    expect(after.unread).toBe(2);
    expect(after.next).toBe('cursor');
  });

  test('an item already shown is not added twice', () => {
    const after = feedWithArrival(feed([item('a')]), item('a'));

    expect(after.items.map((shown) => shown.id)).toEqual(['a']);
    expect(after.unread).toBe(1);
  });

  test('a rewritten item replaces the one shown and moves to the top (sc-13214)', () => {
    const rewritten = item('a', { category: 'event_day' });
    const after = feedWithArrival(
      feed([item('b'), item('a'), item('c', { read: true })]),
      rewritten,
    );

    expect(after.items.map((shown) => shown.id)).toEqual(['a', 'b', 'c']);
    expect(after.items[0]).toBe(rewritten);
    expect(after.unread).toBe(2);
  });

  test('opening an unread item reads it once', () => {
    const once = feedWithRead(feed([item('a'), item('b')]), 'a');

    expect(once.unread).toBe(1);
    expect(once.items[0]?.read).toBe(true);
    expect(feedWithRead(once, 'a')).toBe(once);
  });

  test('Mark all read reads every item', () => {
    const after = feedAllRead(feed([item('a'), item('b')]));

    expect(after.unread).toBe(0);
    expect(after.items.every((shown) => shown.read)).toBe(true);
  });

  test('the next page goes below, leaving out what a live arrival already showed', () => {
    const { feed: after, added } = feedWithPage(feed([item('live'), item('a')], 'c1'), {
      items: [item('live'), item('b')],
      next: null,
    });

    expect(after.items.map((shown) => shown.id)).toEqual(['live', 'a', 'b']);
    expect(added.map((shown) => shown.id)).toEqual(['b']);
    expect(after.next).toBeNull();
  });

  test('a gap reread adds what was missed on top and keeps every page loaded', () => {
    const loaded = feed([at('b', 3), at('a', 2), at('older', 1)], 'c2');
    const after = feedWithMissed(loaded, {
      items: [at('new', 4), at('b', 3), at('a', 2)],
      unread: 4,
    });

    expect(after.items.map((shown) => shown.id)).toEqual(['new', 'b', 'a', 'older']);
    expect(after.unread).toBe(4);
    expect(after.next).toBe('c2');
  });

  test('after a gap, a row read in another session meanwhile shows read', () => {
    const after = feedWithMissed(feed([at('b', 3), at('a', 2), at('older', 1)]), {
      items: [at('b', 3, { read: true }), at('a', 2, { read: true })],
      unread: 1,
    });

    expect(after.items.map((shown) => shown.read)).toEqual([true, true, false]);
    expect(after.unread).toBe(1);
  });

  test('after a gap, an unread item taken away meanwhile leaves the feed (sc-13214)', () => {
    const after = feedWithMissed(feed([at('c', 3), at('gone', 2), at('a', 1), at('older', 0)]), {
      items: [at('c', 3), at('a', 1)],
      unread: 2,
    });

    expect(after.items.map((shown) => shown.id)).toEqual(['c', 'a', 'older']);
  });

  test('after a gap, an empty page one leaves nothing above it', () => {
    expect(feedWithMissed(feed([at('gone', 1)]), { items: [], unread: 0 }).items).toEqual([]);
  });

  test('after a gap, an item rewritten meanwhile shows as it is now, on top', () => {
    const after = feedWithMissed(feed([item('b'), item('a')]), {
      items: [item('a', { category: 'event_day' }), item('b')],
      unread: 2,
    });

    expect(after.items.map((shown) => [shown.id, shown.category])).toEqual([
      ['a', 'event_day'],
      ['b', 'messages'],
    ]);
  });

  test('an unread item taken away leaves the feed, with the count the server published', () => {
    const after = feedWithLiveRead(feed([item('b'), item('a')]), {
      id: 'a',
      unreadCount: 1,
      removed: true,
    });

    expect(after.items.map((shown) => shown.id)).toEqual(['b']);
    expect(after.unread).toBe(1);
  });

  test("a read published from another session reads the row, and the count is the server's", () => {
    const loaded = feed([item('b'), item('a')]);

    const one = feedWithLiveRead(loaded, { id: 'a', unreadCount: 7 });
    expect(one.items.map((shown) => shown.read)).toEqual([false, true]);
    expect(one.unread).toBe(7);

    const all = feedWithLiveRead(loaded, { id: null, unreadCount: 0 });
    expect(all.items.map((shown) => shown.read)).toEqual([true, true]);
    expect(all.unread).toBe(0);
  });
});

describe('the time on a bell item', () => {
  test('is the time today, on a 24-hour clock', () => {
    expect(whenShown('2026-10-29T14:05:00', new Date('2026-10-29T18:00:00'), 'en')).toEqual({
      today: true,
      time: '14:05',
    });
  });

  test("is the locale's date before today", () => {
    expect(whenShown('2026-10-20T09:00:00', new Date('2026-10-29T18:00:00'), 'en')).toEqual({
      today: false,
      date: 'Tuesday, Oct 20',
    });
  });
});

describe('the badge', () => {
  test('counts 1 to 99, then 99+, and shows nothing at 0', () => {
    expect(badgeOf(0, '99+')).toBeNull();
    expect(badgeOf(1, '99+')).toBe('1');
    expect(badgeOf(99, '99+')).toBe('99');
    expect(badgeOf(100, '99+')).toBe('99+');
  });
});

import { describe, expect, test } from 'vitest';

import {
  type FeedItem,
  type LoadedFeed,
  badgeOf,
  feedAllRead,
  feedWithArrival,
  feedWithMissed,
  feedWithMute,
  feedWithPage,
  feedWithRead,
  whenShown,
} from './notificationFeed.ts';

function item(id: string, overrides: Partial<FeedItem> = {}): FeedItem {
  return { id, category: 'messages', eventId: 'e1', muted: false, read: false, ...overrides };
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
    const before = feed([item('a')]);

    expect(feedWithArrival(before, item('a'))).toBe(before);
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
    const loaded = feed([item('b'), item('a'), item('older')], 'c2');
    const after = feedWithMissed(loaded, { items: [item('new'), item('b'), item('a')], unread: 4 });

    expect(after.items.map((shown) => shown.id)).toEqual(['new', 'b', 'a', 'older']);
    expect(after.unread).toBe(4);
    expect(after.next).toBe('c2');
  });

  test("muting an event marks its items in the server's categories, and not another event's", () => {
    const after = feedWithMute(
      feed([item('a'), item('day', { category: 'event_day' }), item('other', { eventId: 'e2' })]),
      'e1',
      { muted: true, markedWhenMuted: ['messages'] },
    );

    expect(after.items.map((shown) => shown.muted)).toEqual([true, false, false]);
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

import { feedWithRead } from '@soirely/domain';
import { describe, expect, it } from 'vitest';

import { feedWithReadUndone, markAllRead, readSettled } from './notificationFeed.ts';

const item = (id: string, read: boolean) => ({
  id,
  category: 'messages',
  eventId: null,
  muted: false,
  read,
});

describe('The bell feed in the app (sc-3980)', () => {
  it('reads page one again when an item arrived while it loaded', async () => {
    let arrivals = 0;
    const pages = ['without B', 'with B'];
    const asked: string[] = [];

    const page = await readSettled(
      () => {
        const next = pages[asked.length] ?? 'none';
        asked.push(next);
        if (asked.length === 1) arrivals += 1;

        return Promise.resolve(next);
      },
      () => arrivals,
    );

    expect(asked).toEqual(['without B', 'with B']);
    expect(page).toBe('with B');
  });

  it('reads once when nothing arrived meanwhile', async () => {
    let asked = 0;

    const page = await readSettled(
      () => {
        asked += 1;

        return Promise.resolve('page');
      },
      () => 0,
    );

    expect(asked).toBe(1);
    expect(page).toBe('page');
  });

  it('puts a row back to unread when its read did not save', () => {
    const feed = { items: [item('a', false), item('b', false)], unread: 2, next: null };
    const opened = feedWithRead(feed, 'a');

    expect(feedWithReadUndone(opened, 'a')).toEqual(feed);
  });

  it('leaves the count alone for a row no longer shown, or already unread', () => {
    const feed = { items: [item('a', false)], unread: 1, next: null };

    expect(feedWithReadUndone(feed, 'a')).toBe(feed);
    expect(feedWithReadUndone(feed, 'gone')).toBe(feed);
  });

  it('says all read only once the server has answered, with the count it left', async () => {
    let answer: (left: number) => void = () => {};
    const said: string[] = [];
    const marking = markAllRead({
      readAllNotifications: () => new Promise((resolve) => (answer = resolve)),
    }).then((outcome) => said.push(outcome.said));

    await Promise.resolve();
    expect(said).toEqual([]);
    answer(0);
    await marking;

    expect(said).toEqual(['notifications.allRead']);
    expect(await markAllRead({ readAllNotifications: () => Promise.resolve(2) })).toEqual({
      said: 'notifications.allRead',
      left: 2,
    });
  });

  it('says not saved when Mark all read fails', async () => {
    expect(
      await markAllRead({ readAllNotifications: () => Promise.reject(new Error('down')) }),
    ).toEqual({ said: 'eventMute.notSaved' });
  });
});

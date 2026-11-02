import { describe, expect, it } from 'vitest';

import { markAllRead } from './notificationFeed.ts';

describe('The bell feed in the app (sc-3980)', () => {
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

import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { LiveNotifications } from './liveNotifications.ts';

const live = vi.hoisted(() => ({
  followed: [] as { userId: string; handlers: LiveNotifications; stop: () => void }[],
}));
const api = vi.hoisted(() => ({
  notifications: vi.fn(async (): Promise<{ unreadCount: number }> => ({ unreadCount: 3 })),
}));
const effects = vi.hoisted(() => ({
  cleanups: [] as (() => void)[],
  snapshot: (): number => Number.NaN,
}));

const signedIn = vi.hoisted(() => ({ id: 'u1' }));

vi.mock('./api.ts', () => ({ api }));
vi.mock('./signedIn.ts', () => ({ useSignedIn: () => ({ account: { id: signedIn.id } }) }));
vi.mock('./liveNotifications.ts', () => ({
  followNotifications: (userId: string, handlers: LiveNotifications) => {
    const stop = vi.fn();
    live.followed.push({ userId, handlers, stop });
    return stop;
  },
}));
vi.mock('react', () => ({
  useEffect: (effect: () => (() => void) | undefined) => {
    const cleanup = effect();
    if (cleanup != null) effects.cleanups.push(cleanup);
  },
  useRef: <T>(value: T) => ({ current: value }),
  useSyncExternalStore: (_subscribe: unknown, snapshot: () => number) => {
    effects.snapshot = snapshot;
    return snapshot();
  },
}));

const { arrivalsSeen, countedSince, setUnread, useArrivals, useUnread } =
  await import('./notificationsUnread.ts');

/** The count as the bells show it, without mounting another one. */
function shown(): number {
  return effects.snapshot();
}

const item = {
  id: 'n1',
  category: 'event_day' as const,
  title: '2 replies waiting',
  lines: [],
  eventId: null,
  eventName: null,
  eventAvailable: true,
  place: null,
  read: false,
  muted: false,
  createdAt: '2026-10-29T10:00:00Z',
};

describe("the bell's count, live (sc-3980)", () => {
  beforeEach(() => {
    effects.cleanups.splice(0).forEach((cleanup) => cleanup());
    live.followed.length = 0;
    signedIn.id = 'u1';
    setUnread(0);
  });

  it('opens one line to the hub for every bell on screen, and closes it with the last', () => {
    useUnread();
    useUnread();

    expect(live.followed).toHaveLength(1);
    expect(live.followed[0]?.userId).toBe('u1');

    effects.cleanups.pop()?.();
    expect(live.followed[0]?.stop).not.toHaveBeenCalled();
    effects.cleanups.splice(0).forEach((cleanup) => cleanup());
    expect(live.followed[0]?.stop).toHaveBeenCalledTimes(1);
  });

  it("takes the server's count with each arrival, and hands every one to the feed, a second raise of the same item too (sc-21785)", () => {
    useUnread();
    setUnread(91);
    const arrivals = vi.fn();
    useArrivals(arrivals);
    const handlers = live.followed[0]?.handlers;
    const raised = { ...item, title: 'Ada Obi changed the event' };

    handlers?.onItem({ item, unreadCount: 91 });
    handlers?.onItem({ item: raised, unreadCount: 91 });
    expect(shown()).toBe(91);

    handlers?.onItem({ item: { ...item, id: 'n2' }, unreadCount: 92 });

    expect(shown()).toBe(92);
    expect(arrivals).toHaveBeenCalledTimes(3);
    expect(arrivals).toHaveBeenNthCalledWith(2, { item: raised, unreadCount: 91 });
  });

  it('reads the count again after a gap, and has the feed read itself', async () => {
    useUnread();
    await vi.waitFor(() => expect(shown()).toBe(3));
    const arrivals = vi.fn();
    useArrivals(arrivals);
    api.notifications.mockResolvedValueOnce({ unreadCount: 5 });

    live.followed[0]?.handlers.onGap();
    await vi.waitFor(() => expect(shown()).toBe(5));

    expect(arrivals).toHaveBeenCalledWith('reread');
  });

  it('asks again when an item arrives while the count is read again, and keeps the arrival meanwhile', async () => {
    useUnread();
    await vi.waitFor(() => expect(shown()).toBe(3));
    let stale: (answer: { unreadCount: number }) => void = () => undefined;
    api.notifications
      .mockImplementationOnce(() => new Promise((resolve) => (stale = resolve)))
      .mockResolvedValueOnce({ unreadCount: 6 });

    live.followed[0]?.handlers.onGap();
    live.followed[0]?.handlers.onItem({ item: { ...item, id: 'n7' }, unreadCount: 4 });
    stale({ unreadCount: 3 });
    expect(shown()).toBe(4);

    await vi.waitFor(() => expect(shown()).toBe(6));
  });

  it("follows a read made in the member's other session, and hands it to the feed", () => {
    useUnread();
    setUnread(4);
    const arrivals = vi.fn();
    useArrivals(arrivals);

    live.followed[0]?.handlers.onRead({ id: 'n1', unreadCount: 3 });

    expect(shown()).toBe(3);
    expect(arrivals).toHaveBeenCalledWith({ read: { id: 'n1', unreadCount: 3 } });
  });

  it("hands a member's own rewrite to the feed as a read, with the count unchanged (sc-21643)", () => {
    useUnread();
    setUnread(2);
    const arrivals = vi.fn();
    useArrivals(arrivals);
    const updated = { ...item, lines: ['The venue is now Hall B (was Hall A).'] };

    live.followed[0]?.handlers.onRead({ id: 'n1', unreadCount: 2, updated });

    expect(shown()).toBe(2);
    expect(arrivals).toHaveBeenCalledExactlyOnceWith({
      read: { id: 'n1', unreadCount: 2, updated },
    });
  });

  it('starts from nothing when another account signs in on the phone', () => {
    useUnread();
    setUnread(12);
    effects.cleanups.splice(0).forEach((cleanup) => cleanup());
    api.notifications.mockImplementationOnce(() => new Promise(() => undefined));
    signedIn.id = 'u2';

    expect(useUnread()).toBe(0);
  });

  it('drops a count the server worked out before the latest arrival', () => {
    useUnread();
    setUnread(2);
    const seen = arrivalsSeen();

    live.followed[0]?.handlers.onItem({ item: { ...item, id: 'n9' }, unreadCount: 3 });
    expect(countedSince(seen, 1)).toBe(false);
    expect(useUnread()).toBe(3);

    expect(countedSince(arrivalsSeen(), 2)).toBe(true);
    expect(useUnread()).toBe(2);
  });
});

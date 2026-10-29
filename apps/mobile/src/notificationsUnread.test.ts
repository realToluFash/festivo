import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { LiveNotifications } from './liveNotifications.ts';

const live = vi.hoisted(() => ({
  followed: [] as { userId: string; handlers: LiveNotifications; stop: () => void }[],
}));
const api = vi.hoisted(() => ({ notifications: vi.fn(async () => ({ unreadCount: 3 })) }));
const effects = vi.hoisted(() => ({ cleanups: [] as (() => void)[] }));

vi.mock('./api.ts', () => ({ api }));
vi.mock('./signedIn.ts', () => ({ useSignedIn: () => ({ account: { id: 'u1' } }) }));
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
  useSyncExternalStore: (_subscribe: unknown, snapshot: () => number) => snapshot(),
}));

const { setUnread, useArrivals, useUnread } = await import('./notificationsUnread.ts');

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

  it('counts an unread arrival once, however often the hub publishes it, and hands it to the feed', () => {
    useUnread();
    const arrivals = vi.fn();
    useArrivals(arrivals);
    const handlers = live.followed[0]?.handlers;

    handlers?.onItem(item);
    handlers?.onItem(item);
    handlers?.onItem({ ...item, id: 'n2', read: true });

    expect(useUnread()).toBe(1);
    expect(arrivals).toHaveBeenCalledTimes(2);
    expect(arrivals).toHaveBeenCalledWith({ item });
  });

  it('reads the count again after a gap, and has the feed read itself', async () => {
    useUnread();
    const arrivals = vi.fn();
    useArrivals(arrivals);

    live.followed[0]?.handlers.onGap();
    await vi.waitFor(() => expect(useUnread()).toBe(3));

    expect(arrivals).toHaveBeenCalledWith('reread');
  });
});

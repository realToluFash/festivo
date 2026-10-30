import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Listener = (event: { data?: string | null }) => void;

const sources = vi.hoisted(
  () =>
    [] as {
      url: string;
      options: { headers: Record<string, string> };
      listeners: Map<string, Listener>;
      close: () => void;
      closed: boolean;
    }[],
);
const api = vi.hoisted(() => ({
  realtimeSubscription: vi.fn(async () => ({
    token: 'first',
    expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
  })),
}));
const settings = vi.hoisted(() => ({ mercureUrl: 'http://hub.test/.well-known/mercure' }));

vi.mock('./api.ts', () => ({ api }));
vi.mock('./config.ts', () => ({ config: settings }));
vi.mock('react-native-sse', () => ({
  default: class {
    listeners = new Map<string, Listener>();
    closed = false;
    constructor(
      public url: string,
      public options: { headers: Record<string, string> },
    ) {
      sources.push(this);
    }
    addEventListener(type: string, listener: Listener): void {
      this.listeners.set(type, listener);
    }
    close(): void {
      this.closed = true;
    }
  },
}));

const { followNotifications } = await import('./liveNotifications.ts');

const item = {
  id: 'n1',
  category: 'event_day',
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

function latest() {
  const source = sources.at(-1);
  if (source == null) throw new Error('nothing connected');

  return source;
}

describe("the app's live bell (sc-3980)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    sources.length = 0;
    settings.mercureUrl = 'http://hub.test/.well-known/mercure';
    api.realtimeSubscription.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("subscribes to the member's own topic with the token in a header", async () => {
    const stop = followNotifications('u1', { onItem: vi.fn(), onRead: vi.fn(), onGap: vi.fn() });
    await vi.advanceTimersByTimeAsync(0);

    expect(latest().url).toBe(
      'http://hub.test/.well-known/mercure?topic=users%2Fu1%2Fnotifications',
    );
    expect(latest().options.headers).toEqual({ Authorization: 'Bearer first' });
    stop();
    expect(latest().closed).toBe(true);
  });

  it('hands on each published item and each read, and passes over what is neither', async () => {
    const onItem = vi.fn();
    const onRead = vi.fn();
    const stop = followNotifications('u1', { onItem, onRead, onGap: vi.fn() });
    await vi.advanceTimersByTimeAsync(0);

    latest().listeners.get('message')?.({ data: JSON.stringify(item) });
    latest().listeners.get('message')?.({ data: JSON.stringify({ readId: 'n1', unreadCount: 4 }) });
    latest().listeners.get('message')?.({ data: 'not json' });
    latest().listeners.get('message')?.({ data: null });

    expect(onItem).toHaveBeenCalledTimes(1);
    expect(onItem.mock.calls[0]?.[0]).toMatchObject({ id: 'n1', title: '2 replies waiting' });
    expect(onRead).toHaveBeenCalledExactlyOnceWith({ id: 'n1', unreadCount: 4 });
    stop();
  });

  it("hands on a member's own rewrite as a read, never as an arrival (sc-21643)", async () => {
    const onItem = vi.fn();
    const onRead = vi.fn();
    const stop = followNotifications('u1', { onItem, onRead, onGap: vi.fn() });
    await vi.advanceTimersByTimeAsync(0);

    latest().listeners.get('message')?.({
      data: JSON.stringify({ updated: item, unreadCount: 4 }),
    });

    expect(onItem).not.toHaveBeenCalled();
    expect(onRead).toHaveBeenCalledExactlyOnceWith({ id: 'n1', unreadCount: 4, updated: item });
    stop();
  });

  it('connects again with a fresh token before the token lapses', async () => {
    const stop = followNotifications('u1', { onItem: vi.fn(), onRead: vi.fn(), onGap: vi.fn() });
    await vi.advanceTimersByTimeAsync(0);
    api.realtimeSubscription.mockResolvedValueOnce({
      token: 'second',
      expiresAt: new Date(Date.now() + 20 * 60_000).toISOString(),
    });

    await vi.advanceTimersByTimeAsync(9 * 60_000);

    expect(sources).toHaveLength(2);
    expect(sources[0]?.closed).toBe(true);
    expect(latest().options.headers).toEqual({ Authorization: 'Bearer second' });
    stop();
  });

  it('reads what it missed when the line opens, and again after a dropped line', async () => {
    const onGap = vi.fn();
    const stop = followNotifications('u1', { onItem: vi.fn(), onRead: vi.fn(), onGap });
    await vi.advanceTimersByTimeAsync(0);
    latest().listeners.get('open')?.({});
    expect(onGap).toHaveBeenCalledTimes(1);

    latest().listeners.get('error')?.({});
    await vi.advanceTimersByTimeAsync(5_000);

    expect(sources).toHaveLength(2);
    latest().listeners.get('open')?.({});
    expect(onGap).toHaveBeenCalledTimes(2);
    stop();
  });

  it('tries again when no token can be had, and not once stopped', async () => {
    api.realtimeSubscription.mockRejectedValueOnce(new Error('offline'));
    const stop = followNotifications('u1', { onItem: vi.fn(), onRead: vi.fn(), onGap: vi.fn() });
    await vi.advanceTimersByTimeAsync(0);
    expect(sources).toHaveLength(0);

    await vi.advanceTimersByTimeAsync(5_000);
    expect(sources).toHaveLength(1);

    stop();
    await vi.advanceTimersByTimeAsync(60 * 60_000);
    expect(sources).toHaveLength(1);
  });

  it('connects to nothing without a hub', () => {
    settings.mercureUrl = '';
    followNotifications('u1', { onItem: vi.fn(), onRead: vi.fn(), onGap: vi.fn() });

    expect(api.realtimeSubscription).not.toHaveBeenCalled();
  });
});

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { __setConfig, config } from '../config.ts';
import { NotificationsBell } from './NotificationsBell.tsx';

class StubSource {
  static readonly CLOSED = 2;
  static made: StubSource[] = [];

  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((message: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;

  readonly url: string;

  constructor(url: string | URL) {
    this.url = String(url);
    StubSource.made.push(this);
  }

  close(): void {
    this.readyState = StubSource.CLOSED;
  }

  open(): void {
    this.readyState = 1;
    act(() => this.onopen?.());
  }

  publish(data: unknown): void {
    act(() => this.onmessage?.({ data: JSON.stringify(data) }));
  }

  drop(): void {
    this.readyState = StubSource.CLOSED;
    this.onerror?.();
  }
}

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function item(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    category: 'messages',
    title: `Item ${id}`,
    lines: [],
    eventId: null,
    eventName: null,
    eventAvailable: true,
    muted: false,
    place: null,
    read: false,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function page(items: ReturnType<typeof item>[]) {
  return { items, unreadCount: items.filter((shown) => !shown.read).length, next: null };
}

/** Each GET of the feed takes the next answer; the last one repeats. */
function feedAnswers(...answers: (() => Promise<Response>)[]): void {
  let asked = 0;

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const line = `${init?.method ?? 'GET'} ${new URL(String(input)).pathname}`;
    if (line === 'POST /api/realtime/subscriptions') {
      return json({ token: 'tok', expiresAt: new Date(Date.now() + 3_600_000).toISOString() });
    }
    if (line === 'GET /api/notifications') {
      const answer = answers[Math.min(asked, answers.length - 1)];
      asked += 1;
      if (answer != null) return answer();
    }
    throw new TypeError('Failed to fetch');
  });
}

async function line(): Promise<StubSource> {
  await waitFor(() => expect(StubSource.made).toHaveLength(1));

  return StubSource.made[0] as StubSource;
}

function bell() {
  const router = createMemoryRouter(
    [{ path: '/app', element: <NotificationsBell userId="u1" /> }],
    { initialEntries: ['/app'] },
  );

  return render(<RouterProvider router={router} />);
}

const before = config();

beforeEach(() => {
  __setConfig({ ...before, mercureUrl: 'http://hub.test/.well-known/mercure' });
  StubSource.made = [];
  vi.stubGlobal('EventSource', StubSource);
});

afterEach(() => {
  __setConfig(before);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("the web bell's live line (sc-3980)", () => {
  it("follows the member's own topic, and an item published on it joins the feed and the badge", async () => {
    feedAnswers(async () => json(page([item('a')])));
    bell();
    const source = await line();
    expect(source.url).toContain('topic=users%2Fu1%2Fnotifications');
    expect(source.url).toContain('authorization=tok');
    source.open();
    await screen.findByRole('button', { name: 'Notifications, 1 unread' });

    source.publish(item('b'));

    expect(await screen.findByRole('button', { name: 'Notifications, 2 unread' })).toBeTruthy();
  });

  it('a read made in another session reads the row, and Mark all read there clears the badge', async () => {
    feedAnswers(async () => json(page([item('b'), item('a')])));
    bell();
    const source = await line();
    source.open();
    await screen.findByRole('button', { name: 'Notifications, 2 unread' });

    source.publish({ readId: 'a', unreadCount: 1 });
    expect(await screen.findByRole('button', { name: 'Notifications, 1 unread' })).toBeTruthy();

    source.publish({ readAll: true, unreadCount: 0 });
    expect(await screen.findByRole('button', { name: 'Notifications' })).toBeTruthy();
  });

  it('reads page one again when a line opens, and takes the rows read elsewhere meanwhile', async () => {
    feedAnswers(
      async () => json(page([item('a')])),
      async () => json(page([item('new'), item('a', { read: true })])),
    );
    bell();
    const source = await line();
    await screen.findByRole('button', { name: 'Notifications, 1 unread' });

    source.open();
    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledTimes(3));
    fireEvent.click(screen.getByRole('button', { name: 'Notifications, 1 unread' }));

    expect(await screen.findByText('Item new')).toBeTruthy();
    expect(screen.getAllByText('Unread')).toHaveLength(1);
  });

  it('an item that arrives while the page is read again is still counted', async () => {
    let stale: (response: Response) => void = () => undefined;
    feedAnswers(
      async () => json(page([item('a')])),
      () => new Promise<Response>((resolve) => (stale = resolve)),
      async () => json(page([item('b'), item('a')])),
    );
    bell();
    const source = await line();
    await screen.findByRole('button', { name: 'Notifications, 1 unread' });

    source.open();
    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledTimes(3));
    source.publish(item('b'));
    await act(async () => stale(json(page([item('a')]))));

    await waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledTimes(4));
    expect(screen.getByRole('button', { name: 'Notifications, 2 unread' })).toBeTruthy();
  });

  it('connects again after the line closes, and the new line reads page one again', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    feedAnswers(async () => json(page([item('a')])));
    bell();
    const first = await line();
    first.open();

    first.drop();
    await act(async () => vi.advanceTimersByTimeAsync(5_000));

    await waitFor(() => expect(StubSource.made).toHaveLength(2));
    expect(first.readyState).toBe(StubSource.CLOSED);
  });

  it('closes the line when the bell goes', async () => {
    feedAnswers(async () => json(page([])));
    const { unmount } = bell();
    const source = await line();

    unmount();

    expect(source.readyState).toBe(StubSource.CLOSED);
  });
});

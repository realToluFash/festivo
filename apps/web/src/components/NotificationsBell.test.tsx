import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Outlet, RouterProvider, createMemoryRouter } from 'react-router';

import { MuteSwitch } from './MuteSwitch.tsx';
import { cssRule } from '../test-styles.ts';
import { NotificationsBell } from './NotificationsBell.tsx';

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function item(overrides: Record<string, unknown> = {}) {
  return {
    id: 'n1',
    category: 'event_changes',
    title: 'Ada Obi changed the event',
    lines: ['The date is now Saturday, Nov 14 (was Friday, Nov 13).'],
    eventId: 'e1',
    eventName: 'Ada & Tomi',
    eventAvailable: true,
    muted: false,
    place: '/app/events/e1',
    read: false,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function answering(answers: Record<string, () => Response>) {
  const sent: string[] = [];

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const line = `${init?.method ?? 'GET'} ${new URL(String(input)).pathname}`;
    sent.push(line);

    const answer = answers[line];
    if (answer == null) throw new TypeError('Failed to fetch');

    return answer();
  });

  return sent;
}

function bell() {
  const router = createMemoryRouter(
    [
      { path: '/app', element: <NotificationsBell userId="u1" /> },
      { path: '/app/events/:id', element: <p>Event page</p> },
    ],
    { initialEntries: ['/app'] },
  );

  render(<RouterProvider router={router} />);

  return router;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the bell (sc-3980)', () => {
  it('names the exact count and shows 99+ above 99', async () => {
    answering({
      'GET /api/notifications': () => json({ items: [item()], unreadCount: 100, next: null }),
    });
    bell();

    const button = await screen.findByRole('button', { name: 'Notifications, 100 unread' });
    expect(within(button).getByText('99+')).toBeTruthy();
  });

  it('shows no badge at 0', async () => {
    answering({
      'GET /api/notifications': () => json({ items: [], unreadCount: 0, next: null }),
    });
    bell();

    const button = await screen.findByRole('button', { name: 'Notifications' });
    expect(button.querySelector('.notifications-badge')).toBeNull();
    fireEvent.click(button);

    expect(await screen.findByText(/Nothing yet/)).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Mark all read' }).getAttribute('aria-disabled'),
    ).toBe('true');
    expect(screen.getByRole('link', { name: 'Notification settings' })).toBeTruthy();
  });

  it('draws each change line as its own row, and the word Unread', async () => {
    answering({
      'GET /api/notifications': () =>
        json({
          items: [item({ lines: ['First line.', 'Second line.'], muted: true })],
          unreadCount: 1,
          next: null,
        }),
    });
    bell();

    fireEvent.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }));

    expect(await screen.findByText('First line.')).toBeTruthy();
    expect(screen.getByText('Second line.')).toBeTruthy();
    expect(screen.getByText('Unread')).toBeTruthy();
    expect(screen.getByText('Muted')).toBeTruthy();
    expect(screen.getByText(/^Ada & Tomi · at \d\d:\d\d$/)).toBeTruthy();
  });

  it('opening an item marks it read and goes to its place', async () => {
    const sent = answering({
      'GET /api/notifications': () => json({ items: [item()], unreadCount: 1, next: null }),
      'POST /api/notifications/n1/read': () => json({ item: item({ read: true }), unreadCount: 0 }),
    });
    const router = bell();

    fireEvent.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }));
    fireEvent.click(await screen.findByRole('button', { name: /^Ada Obi changed the event/ }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/app/events/e1'));
    expect(sent).toContain('POST /api/notifications/n1/read');
  });

  it('an item whose event is gone says so instead of navigating', async () => {
    answering({
      'GET /api/notifications': () =>
        json({ items: [item({ eventAvailable: false })], unreadCount: 1, next: null }),
      'POST /api/notifications/n1/read': () =>
        json({ item: item({ read: true, eventAvailable: false }), unreadCount: 0 }),
    });
    const router = bell();

    fireEvent.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }));
    fireEvent.click(await screen.findByRole('button', { name: /^Ada Obi changed the event/ }));

    expect((await screen.findByRole('status')).textContent).toBe(
      'This event is no longer available.',
    );
    expect(router.state.location.pathname).toBe('/app');
  });

  it('Mark all read clears the count and keeps focus on the button', async () => {
    const sent = answering({
      'GET /api/notifications': () => json({ items: [item()], unreadCount: 1, next: null }),
      'POST /api/notifications/read-all': () => json({ unreadCount: 0 }),
    });
    bell();

    fireEvent.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }));
    const markAll = await screen.findByRole('button', { name: 'Mark all read' });
    markAll.focus();
    fireEvent.click(markAll);

    expect(await screen.findByText('All read.')).toBeTruthy();
    expect(markAll.getAttribute('aria-disabled')).toBe('true');
    expect(document.activeElement).toBe(markAll);
    expect(sent).toContain('POST /api/notifications/read-all');
    expect(screen.getByRole('button', { name: 'Notifications' })).toBeTruthy();
  });
  it('Mark all read says All read only once the answer is in', async () => {
    let answer: (response: Response) => void = () => undefined;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) =>
      init?.method === 'POST' && new URL(String(input)).pathname === '/api/notifications/read-all'
        ? new Promise<Response>((resolve) => (answer = resolve))
        : json({ items: [item()], unreadCount: 1, next: null }),
    );
    bell();

    fireEvent.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Mark all read' }));
    await waitFor(() =>
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        expect.stringContaining('/api/notifications/read-all'),
        expect.anything(),
      ),
    );
    expect(screen.queryByText('All read.')).toBeNull();

    answer(json({ unreadCount: 0 }));

    expect(await screen.findByText('All read.')).toBeTruthy();
  });

  it('Mark all read that does not save says so and puts the unread back', async () => {
    answering({
      'GET /api/notifications': () => json({ items: [item()], unreadCount: 1, next: null }),
    });
    bell();

    fireEvent.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Mark all read' }));

    expect(await screen.findByText('Could not mark them all read. Try again.')).toBeTruthy();
    expect(screen.queryByText('All read.')).toBeNull();
    expect(screen.getByRole('button', { name: 'Notifications, 1 unread' })).toBeTruthy();
    expect(screen.getByText('Unread')).toBeTruthy();
  });

  it('More mutes the event, leaves the items already delivered unmarked, and Escape goes back to More', async () => {
    const sent = answering({
      'GET /api/notifications': () => json({ items: [item()], unreadCount: 1, next: null }),
      'GET /api/events/e1/mute': () => json({ muted: false }),
      'PUT /api/events/e1/mute': () => json({ muted: true }),
    });
    bell();

    fireEvent.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }));
    const more = await screen.findByRole('button', {
      name: 'More for Ada Obi changed the event, Ada & Tomi',
    });
    fireEvent.click(more);

    const mute = await screen.findByRole('switch', { name: 'Mute this event' });
    await waitFor(() => expect((mute as HTMLInputElement).disabled).toBe(false));
    fireEvent.click(mute);

    await waitFor(() => expect(sent).toContain('PUT /api/events/e1/mute'));
    await waitFor(() => expect((mute as HTMLInputElement).checked).toBe(true));
    expect(screen.queryByText('Muted')).toBeNull();

    mute.focus();
    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => expect(document.activeElement).toBe(more));
    expect(screen.queryByRole('switch', { name: 'Mute this event' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Notifications' })).toBeTruthy();
  });

  it("a mute from More shows on the event page's own switch, which is the same switch", async () => {
    answering({
      'GET /api/notifications': () => json({ items: [item()], unreadCount: 1, next: null }),
      'GET /api/events/e1/mute': () => json({ muted: false }),
      'PUT /api/events/e1/mute': () => json({ muted: true }),
    });
    const router = createMemoryRouter(
      [
        {
          path: '/app',
          element: (
            <>
              <NotificationsBell userId="u1" />
              <section aria-label="Just for you">
                <MuteSwitch eventId="e1" />
              </section>
            </>
          ),
        },
      ],
      { initialEntries: ['/app'] },
    );
    render(<RouterProvider router={router} />);

    const page = within(screen.getByRole('region', { name: 'Just for you' }));
    const pageSwitch = (await page.findByRole('switch')) as HTMLInputElement;
    await waitFor(() => expect(pageSwitch.disabled).toBe(false));
    expect(pageSwitch.checked).toBe(false);

    fireEvent.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }));
    fireEvent.click(
      await screen.findByRole('button', { name: 'More for Ada Obi changed the event, Ada & Tomi' }),
    );
    const more = (await screen.findAllByRole('switch', { name: 'Mute this event' })).find(
      (shown) => shown !== pageSwitch,
    ) as HTMLInputElement;
    await waitFor(() => expect(more.disabled).toBe(false));
    fireEvent.click(more);

    await waitFor(() => expect(pageSwitch.checked).toBe(true));
  });

  it('More says when the mute state did not load, and Try again reads it again', async () => {
    let reads = 0;
    answering({
      'GET /api/notifications': () => json({ items: [item()], unreadCount: 1, next: null }),
      'GET /api/events/e1/mute': () => {
        reads += 1;
        if (reads === 1) throw new TypeError('Failed to fetch');
        return json({ muted: true });
      },
    });
    bell();

    fireEvent.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }));
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'More for Ada Obi changed the event, Ada & Tomi',
      }),
    );

    expect(await screen.findByText('Could not check whether this event is muted.')).toBeTruthy();
    const mute = screen.getByRole('switch', { name: 'Mute this event' }) as HTMLInputElement;
    expect(mute.disabled).toBe(true);
    expect(screen.queryByText('Not saved. Try again.')).toBeNull();

    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Try again' }));

    await waitFor(() => expect(mute.checked).toBe(true));
    expect(mute.disabled).toBe(false);
    expect(screen.queryByText('Could not check whether this event is muted.')).toBeNull();
  });

  it('an item whose event is gone has no More', async () => {
    answering({
      'GET /api/notifications': () =>
        json({ items: [item({ eventAvailable: false })], unreadCount: 1, next: null }),
    });
    bell();

    fireEvent.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }));
    await screen.findByRole('button', { name: /^Ada Obi changed the event/ });

    expect(screen.queryByRole('button', { name: /^More for/ })).toBeNull();
  });

  it('Show more adds the next page under the first and says how many it added', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const after = new URL(String(input)).searchParams.get('after');

      return after == null
        ? json({ items: [item()], unreadCount: 1, next: 'n1' })
        : json({
            items: [item({ id: 'n2', title: 'Briefing from Bola', read: true })],
            unreadCount: 1,
            next: null,
          });
    });
    bell();

    fireEvent.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Show more' }));

    expect(await screen.findByRole('button', { name: /^Briefing from Bola/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Ada Obi changed the event/ })).toBeTruthy();
    expect(screen.getByText('1 more notification shown.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull();
  });

  it('Show more stays in place and busy while the page loads, and keeps focus', async () => {
    let answer: (response: Response) => void = () => undefined;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      if (!new URL(String(input)).searchParams.has('after')) {
        return json({ items: [item()], unreadCount: 1, next: 'n1' });
      }

      return new Promise<Response>((resolve) => {
        answer = resolve;
      });
    });
    bell();

    fireEvent.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }));
    const more = await screen.findByRole('button', { name: 'Show more' });
    more.focus();
    fireEvent.click(more);

    await waitFor(() => expect(more.getAttribute('aria-busy')).toBe('true'));
    expect(more.getAttribute('aria-disabled')).toBe('true');
    expect(document.activeElement).toBe(more);

    answer(
      json({
        items: [item({ id: 'n2', title: 'Briefing from Bola' })],
        unreadCount: 1,
        next: 'n2',
      }),
    );

    await screen.findByRole('button', { name: /^Briefing from Bola/ });
    expect(more.getAttribute('aria-busy')).toBe('false');
    expect(document.activeElement).toBe(more);
  });

  it('Show more moves focus to the first new item when the last page takes the button away', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) =>
      new URL(String(input)).searchParams.has('after')
        ? json({
            items: [item({ id: 'n2', title: 'Briefing from Bola' })],
            unreadCount: 1,
            next: null,
          })
        : json({ items: [item()], unreadCount: 1, next: 'n1' }),
    );
    bell();

    fireEvent.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }));
    const more = await screen.findByRole('button', { name: 'Show more' });
    more.focus();
    fireEvent.click(more);

    const added = await screen.findByRole('button', { name: /^Briefing from Bola/ });
    await waitFor(() => expect(document.activeElement).toBe(added));
  });

  it('Show more says when the next page did not load, and keeps the button', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      if (new URL(String(input)).searchParams.has('after')) throw new TypeError('Failed to fetch');

      return json({ items: [item()], unreadCount: 1, next: 'n1' });
    });
    bell();

    fireEvent.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Show more' }));

    expect((await screen.findByRole('alert')).textContent).toContain(
      'More notifications did not load. Try again in a moment.',
    );
    expect(screen.getByRole('button', { name: 'Show more' })).toBeTruthy();
  });
});

describe('the push ask', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  function permission(state: NotificationPermission) {
    const requestPermission = vi.fn(async () => 'granted' as NotificationPermission);
    vi.stubGlobal('Notification', { permission: state, requestPermission });

    return requestPermission;
  }

  it('shows on the first opening of the bell only, never on page load', async () => {
    permission('default');
    answering({ 'GET /api/notifications': () => json({ items: [], unreadCount: 0, next: null }) });
    bell();

    expect(screen.queryByText('Turn on push?')).toBeNull();

    const bellButton = screen.getByRole('button', { name: 'Notifications' });
    fireEvent.click(bellButton);
    expect(await screen.findByRole('heading', { name: 'Turn on push?' })).toBeTruthy();

    fireEvent.click(bellButton);
    fireEvent.click(bellButton);
    expect(screen.queryByText('Turn on push?')).toBeNull();
  });

  it('asks the browser on Turn on, then goes and moves focus to the heading', async () => {
    const requestPermission = permission('default');
    answering({ 'GET /api/notifications': () => json({ items: [], unreadCount: 0, next: null }) });
    bell();

    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Turn on' }));

    await waitFor(() => expect(screen.queryByText('Turn on push?')).toBeNull());
    expect(requestPermission).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Notifications' }));
  });

  it('goes on Not now without asking the browser, and the feed is unchanged', async () => {
    const requestPermission = permission('default');
    answering({
      'GET /api/notifications': () => json({ items: [item()], unreadCount: 1, next: null }),
    });
    bell();

    fireEvent.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Not now' }));

    expect(screen.queryByText('Turn on push?')).toBeNull();
    expect(requestPermission).not.toHaveBeenCalled();
    expect(screen.getByText('Ada Obi changed the event')).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Notifications' }));
  });

  it.each(['granted', 'denied'] as const)('does not show once the browser says %s', (state) => {
    permission(state);
    answering({ 'GET /api/notifications': () => json({ items: [], unreadCount: 0, next: null }) });
    bell();

    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    expect(screen.queryByText('Turn on push?')).toBeNull();
  });
});

describe('the heading at 320px (sc-21358)', () => {
  it('keeps the heading whole and wraps Mark all as read under it', () => {
    expect(cssRule('.notifications-header')).toMatch(/flex-wrap: wrap;/u);
    expect(cssRule('.notifications-header h2')).toMatch(/flex: none;/u);
    expect(cssRule('.notifications-header .link-button')).toMatch(/text-align: start;/u);
  });
});

describe('offline (sc-27096)', () => {
  function reachableFeed(answers: Record<string, () => Response> = {}) {
    const net = { reachable: true };
    const guarded = Object.fromEntries(
      Object.entries({
        'GET /api/notifications': () => json({ items: [item()], unreadCount: 1, next: null }),
        ...answers,
      }).map(([line, answer]) => [
        line,
        () => {
          if (!net.reachable) throw new TypeError('Failed to fetch');
          return answer();
        },
      ]),
    );
    const sent = answering(guarded);

    return { net, sent };
  }

  function goOffline(net: { reachable: boolean }): void {
    net.reachable = false;
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
  }

  const band = () => document.querySelector('.notifications-band');

  it('shows its own band under the header, keeps the feed, and Try again reloads only the feed', async () => {
    const { net, sent } = reachableFeed();
    bell();

    fireEvent.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }));
    await screen.findByText('Ada Obi changed the event');
    goOffline(net);

    expect(band()?.textContent).toMatch(/^Offline · as of /);
    expect(band()?.previousElementSibling?.classList.contains('notifications-header')).toBe(true);
    expect(screen.getByText('Ada Obi changed the event')).toBeTruthy();

    net.reachable = true;
    sent.length = 0;
    fireEvent.click(within(band() as HTMLElement).getByRole('button', { name: 'Try again' }));

    await waitFor(() => expect(band()).toBeNull());
    expect(sent).toEqual(['GET /api/notifications']);
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Notifications' })),
    );
  });

  it('opened again while offline shows the band and the same feed, and sends nothing', async () => {
    const { net, sent } = reachableFeed();
    bell();

    const opener = await screen.findByRole('button', { name: 'Notifications, 1 unread' });
    fireEvent.click(opener);
    await screen.findByText('Ada Obi changed the event');
    goOffline(net);
    fireEvent.click(opener);
    sent.length = 0;
    fireEvent.click(opener);

    expect(band()?.classList.contains('still')).toBe(true);
    expect(screen.getByText('Ada Obi changed the event')).toBeTruthy();
    expect(sent).toEqual([]);
  });

  it('keeps the feed when Try again cannot reach Soirely, and announces the band again', async () => {
    const { net } = reachableFeed();
    bell();

    fireEvent.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }));
    await screen.findByText('Ada Obi changed the event');
    goOffline(net);
    fireEvent.click(within(band() as HTMLElement).getByRole('button', { name: 'Try again' }));

    await waitFor(() => expect(band()?.textContent).toMatch(/^Offline · as of /));
    expect(screen.getByText('Ada Obi changed the event')).toBeTruthy();
    expect(screen.queryByText('Your notifications did not load.')).toBeNull();
  });

  it('a refused Mark all read puts the rows and the number back, and keeps the feed', async () => {
    const { net } = reachableFeed({ 'POST /api/notifications/read-all': () => json({}) });
    bell();

    fireEvent.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }));
    await screen.findByText('Ada Obi changed the event');
    goOffline(net);
    fireEvent.click(screen.getByRole('button', { name: 'Mark all read' }));

    expect(await screen.findByText('Could not mark them all read. Try again.')).toBeTruthy();
    expect(screen.getByText('Unread')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Notifications, 1 unread' })).toBeTruthy();
    expect(screen.queryByText('Your notifications did not load.')).toBeNull();
  });

  it('an unread notification opened offline opens its place and is unread again', async () => {
    const { net } = reachableFeed();
    const router = createMemoryRouter(
      [
        {
          path: '/app',
          element: (
            <>
              <NotificationsBell userId="u1" />
              <Outlet />
            </>
          ),
          children: [{ path: 'events/:id', element: <p>Event page</p> }],
        },
      ],
      { initialEntries: ['/app'] },
    );
    render(<RouterProvider router={router} />);

    const opener = await screen.findByRole('button', { name: 'Notifications, 1 unread' });
    fireEvent.click(opener);
    goOffline(net);
    fireEvent.click(await screen.findByRole('button', { name: /^Ada Obi changed the event/ }));

    expect(await screen.findByText('Event page')).toBeTruthy();
    expect(router.state.location.pathname).toBe('/app/events/e1');
    expect(await screen.findByRole('button', { name: 'Notifications, 1 unread' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Notifications, 1 unread' }));
    expect(screen.getByText('Unread')).toBeTruthy();
  });

  it('shows no band over a feed that never loaded', async () => {
    const { net } = reachableFeed();
    net.reachable = false;
    bell();

    fireEvent.click(screen.getByRole('button', { name: 'Notifications' }));

    expect(await screen.findByText('Your notifications did not load.')).toBeTruthy();
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    expect(band()).toBeNull();
  });

  it('puts Refreshing… beside the heading, outside it', () => {
    expect(cssRule('.notifications-heading')).toMatch(/flex-wrap: wrap;/u);
    expect(cssRule('.notifications-band')).toMatch(/padding-inline: var\(--spaceXl\);/u);
  });
});

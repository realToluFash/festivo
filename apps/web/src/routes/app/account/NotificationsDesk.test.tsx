import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { subscribeWebPush } from '../../../webPush.ts';
import { NotificationSettings } from './NotificationSettings.tsx';

vi.mock('../../../webPush.ts', () => ({ subscribeWebPush: vi.fn(async () => undefined) }));

const CATEGORIES = [
  'guest_replies',
  'messages',
  'event_day',
  'event_changes',
  'money',
  'account_security',
].map((category) => ({
  category,
  push: { on: category !== 'account_security', switchable: true },
  email: { on: category !== 'event_day', switchable: category !== 'account_security' },
}));

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function withRow(category: string, row: object) {
  return {
    categories: CATEGORIES.map((one) => (one.category === category ? { ...one, ...row } : one)),
  };
}

function opened(put: () => Response | Promise<Response> = () => json({ categories: CATEGORIES })) {
  const puts: unknown[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) => {
    if (init?.method !== 'PUT') return json({ categories: CATEGORIES });
    puts.push(typeof init.body === 'string' ? JSON.parse(init.body) : null);

    return put();
  });

  render(
    <RouterProvider
      router={createMemoryRouter(
        [{ path: '/app/account/notifications', element: <NotificationSettings /> }],
        { initialEntries: ['/app/account/notifications'] },
      )}
    />,
  );

  return puts;
}

function permission(state: NotificationPermission): { permission: NotificationPermission } {
  const browser = { permission: state };
  vi.stubGlobal('Notification', browser);

  return browser;
}

function row(name: string): HTMLElement {
  return screen.getByRole('button', { name: new RegExp(`^${name}`, 'u') });
}

async function openRow(name: string) {
  fireEvent.click(await screen.findByRole('button', { name: new RegExp(`^${name}`, 'u') }));

  return within(screen.getByRole('group', { name }));
}

const BLOCKED = "Push is off in this browser, so pushes won't reach you here.";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.mocked(subscribeWebPush).mockClear();
  Reflect.deleteProperty(document, 'visibilityState');
});

describe('Notification settings at a desk (sc-30411)', () => {
  it('opens on the card, how you hear and the counts, then each kind with its value in words', async () => {
    opened();

    expect(await screen.findByText('You hear by push and email')).toBeTruthy();
    expect(screen.getByText('5 of 6 by push · 5 of 6 by email')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'What you hear about' })).toBeTruthy();
    expect(row('Guest replies').textContent).toContain('Push and email');
    expect(row('Event day').textContent).toContain('Push only');
    expect(row('Account & security').textContent).toContain('Email only · email always on');
    expect(
      screen.getByText('Between 21:00 and 08:00 your time, only Event day pushes come through.'),
    ).toBeTruthy();
  });

  it('a kind opens in place to what it covers and its two switches, one row at a time', async () => {
    opened();

    const money = await openRow('Money');
    expect(
      money.getByText('Payments due, usage at 80% and 100%, failed payments and invoices.'),
    ).toBeTruthy();
    expect(money.getByRole('switch', { name: 'Money Push' }).getAttribute('aria-checked')).toBe(
      'true',
    );
    expect(row('Money').getAttribute('aria-expanded')).toBe('true');

    await openRow('Messages');
    expect(screen.queryByRole('group', { name: 'Money' })).toBeNull();
  });

  it('Account & security keeps email on and says so under the Email switch', async () => {
    opened();

    const security = await openRow('Account & security');
    const email = security.getByRole('switch', { name: 'Account & security Email' });
    expect(email.getAttribute('aria-disabled')).toBe('true');
    expect(security.getByText('Email cannot be switched off.')).toBeTruthy();
    expect(
      security.getByText('Sign-ins, your password, two-factor, ownership and access.'),
    ).toBeTruthy();
  });

  it('saves a switch as it changes, tags its row Saved and says so', async () => {
    const puts = opened(() =>
      json(withRow('event_changes', { push: { on: false, switchable: true } })),
    );

    const changes = await openRow('Event changes');
    fireEvent.click(changes.getByRole('switch', { name: 'Event changes Push' }));

    expect(await screen.findByText('Saved.')).toBeTruthy();
    expect(puts).toHaveLength(1);
    expect(row('Event changes').textContent).toContain('Saved');
    expect(row('Event changes').textContent).toContain('Email only');
    expect(
      changes.getByRole('switch', { name: 'Event changes Push' }).getAttribute('aria-checked'),
    ).toBe('false');

    await openRow('Money');
    expect(row('Event changes').textContent).not.toContain('Saved');
  });

  it('a switch stays busy while it saves and takes no second change until the answer', async () => {
    let answer: (response: Response) => void = () => undefined;
    const puts = opened(() => new Promise<Response>((resolve) => (answer = resolve)));

    const money = await openRow('Money');
    const push = money.getByRole('switch', { name: 'Money Push' });
    fireEvent.click(push);
    expect(push.getAttribute('aria-busy')).toBe('true');
    expect(row('Money').textContent).toContain('Saving…');
    await waitFor(() => expect(puts).toHaveLength(1));
    fireEvent.click(push);

    expect(puts).toHaveLength(1);
    answer(json(withRow('money', { push: { on: false, switchable: true } })));
    expect(await screen.findByText('Saved.')).toBeTruthy();
    expect(push.getAttribute('aria-busy')).toBe('false');
  });

  it('a failed save puts the switch back and says so under it', async () => {
    opened(() => json({ title: 'No.' }, 500));

    const money = await openRow('Money');
    fireEvent.click(money.getByRole('switch', { name: 'Money Push' }));

    expect((await screen.findByRole('alert')).textContent).toContain(
      'The push switch was not saved. Try again.',
    );
    await waitFor(() =>
      expect(money.getByRole('switch', { name: 'Money Push' }).getAttribute('aria-checked')).toBe(
        'true',
      ),
    );
    expect(row('Money').textContent).not.toContain('Saved');
  });

  it('while the browser blocks push, the card says so and shows How to allow push', async () => {
    permission('denied');
    opened();

    expect(await screen.findByText(BLOCKED)).toBeTruthy();
    const day = await openRow('Event day');
    expect(day.getByText('Blocked in this browser')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'How to allow push' }));
    const dialog = within(screen.getByRole('dialog', { name: 'Allow push in this browser' }));
    expect(
      dialog.getByText('Come back to this tab. Soirely checks again when you do.'),
    ).toBeTruthy();
    fireEvent.click(dialog.getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('checks push again when the tab comes back, without a reload', async () => {
    const browser = permission('denied');
    opened();
    expect(await screen.findByText(BLOCKED)).toBeTruthy();

    browser.permission = 'granted';
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    expect(screen.queryByText(BLOCKED)).toBeNull();
    expect(screen.queryByRole('button', { name: 'How to allow push' })).toBeNull();
  });

  it('checks push again when the reader switches back to the tab', async () => {
    const browser = permission('denied');
    opened();
    expect(await screen.findByText(BLOCKED)).toBeTruthy();

    browser.permission = 'granted';
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(screen.queryByText(BLOCKED)).toBeNull();
  });

  it('registers this browser for push once when push is allowed again', async () => {
    const browser = permission('denied');
    opened();
    expect(await screen.findByText(BLOCKED)).toBeTruthy();
    expect(subscribeWebPush).not.toHaveBeenCalled();

    browser.permission = 'granted';
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    expect(subscribeWebPush).toHaveBeenCalledTimes(1);

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    expect(subscribeWebPush).toHaveBeenCalledTimes(1);
  });

  it('says nothing about push when the browser has not blocked it', async () => {
    permission('default');
    opened();

    await screen.findByText('You hear by push and email');
    expect(screen.queryByText(BLOCKED)).toBeNull();
  });

  it('a page that did not load says so as an alert, and Try again loads it', async () => {
    let reads = 0;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      reads++ === 0 ? json({}, 500) : json({ categories: CATEGORIES }),
    );
    render(
      <RouterProvider
        router={createMemoryRouter(
          [{ path: '/app/account/notifications', element: <NotificationSettings /> }],
          { initialEntries: ['/app/account/notifications'] },
        )}
      />,
    );

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('Your notification settings did not load.');
    expect(alert.textContent).toContain('Check your connection and try again.');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('You hear by push and email')).toBeTruthy();
  });
});

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { NotificationSettings } from './NotificationSettings.tsx';

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
  email: { on: true, switchable: category !== 'account_security' },
}));

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function settings(put: () => Response | Promise<Response>) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (_input, init) =>
    init?.method === 'PUT' ? put() : json({ categories: CATEGORIES }),
  );

  const router = createMemoryRouter(
    [{ path: '/app/account/notifications', element: <NotificationSettings /> }],
    { initialEntries: ['/app/account/notifications'] },
  );
  render(<RouterProvider router={router} />);
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const PUSH_BLOCKED =
  "Push is off in this browser, so pushes won't reach you here. Turn it on in your browser settings.";

function permission(state: NotificationPermission): void {
  vi.stubGlobal('Notification', { permission: state });
}

describe('Notification settings (sc-3980)', () => {
  it('names every switch by its row and column, and Account & security email stays on', async () => {
    settings(() => json({ categories: CATEGORIES }));

    expect(await screen.findByRole('switch', { name: 'Event changes Push' })).toBeTruthy();
    expect(screen.getAllByRole('switch')).toHaveLength(12);
    const security = screen.getByRole('switch', { name: 'Account & security Email' });
    expect((security as HTMLInputElement).disabled).toBe(true);
    expect((security as HTMLInputElement).checked).toBe(true);
  });

  it('formats the quiet hours and the usage thresholds rather than carrying them in the copy', async () => {
    settings(() => json({ categories: CATEGORIES }));

    expect(
      await screen.findByText(
        'Between 21:00 and 08:00 your time, only Event day pushes come through.',
      ),
    ).toBeTruthy();
    expect(
      screen.getByText('Payments due, usage at 80% and 100%, failed payments and invoices.'),
    ).toBeTruthy();
  });

  it('saves a switch as it changes and says so', async () => {
    settings(() =>
      json({
        categories: CATEGORIES.map((row) =>
          row.category === 'event_changes'
            ? { ...row, push: { on: false, switchable: true } }
            : row,
        ),
      }),
    );

    fireEvent.click(await screen.findByRole('switch', { name: 'Event changes Push' }));

    expect(await screen.findByText('Saved.')).toBeTruthy();
    expect(
      (screen.getByRole('switch', { name: 'Event changes Push' }) as HTMLInputElement).checked,
    ).toBe(false);
  });

  it('a failed save puts the switch back and says so under its row', async () => {
    settings(() => json({ title: 'No.' }, 500));

    fireEvent.click(await screen.findByRole('switch', { name: 'Event changes Push' }));

    expect((await screen.findByRole('alert')).textContent).toContain(
      "Couldn't save the push switch. Try again.",
    );
    await waitFor(() =>
      expect(
        (screen.getByRole('switch', { name: 'Event changes Push' }) as HTMLInputElement).checked,
      ).toBe(true),
    );
    expect(
      screen.getByRole('switch', { name: 'Event changes Push' }).getAttribute('aria-describedby'),
    ).toBe('notification-note-event_changes notification-error-event_changes');
  });

  it('a failed save puts back only its own switch, not one saved meanwhile', async () => {
    let refuse: (answer: Response) => void = () => undefined;
    const answers = [
      new Promise<Response>((resolve) => (refuse = resolve)),
      Promise.resolve(
        json({
          categories: CATEGORIES.map((row) =>
            row.category === 'messages' ? { ...row, email: { on: false, switchable: true } } : row,
          ),
        }),
      ),
    ];
    settings(() => answers.shift() ?? Promise.reject(new Error('one too many')));

    fireEvent.click(await screen.findByRole('switch', { name: 'Event changes Push' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Messages Email' }));
    expect(await screen.findByText('Saved.')).toBeTruthy();
    expect(
      (screen.getByRole('switch', { name: 'Event changes Push' }) as HTMLInputElement).checked,
    ).toBe(false);
    refuse(json({ title: 'No.' }, 500));

    expect(await screen.findByText("Couldn't save the push switch. Try again.")).toBeTruthy();
    expect(
      (screen.getByRole('switch', { name: 'Event changes Push' }) as HTMLInputElement).checked,
    ).toBe(true);
    expect(
      (screen.getByRole('switch', { name: 'Messages Email' }) as HTMLInputElement).checked,
    ).toBe(false);
  });

  it('a switch stays busy while it saves and takes no second change until the answer', async () => {
    let answer: (response: Response) => void = () => undefined;
    let puts = 0;
    settings(() => {
      puts += 1;
      return new Promise<Response>((resolve) => (answer = resolve));
    });

    const push = (await screen.findByRole('switch', {
      name: 'Event changes Push',
    })) as HTMLInputElement;
    fireEvent.click(push);
    expect(push.getAttribute('aria-busy')).toBe('true');
    await waitFor(() => expect(puts).toBe(1));
    fireEvent.click(push);
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(puts).toBe(1);
    expect(push.checked).toBe(false);

    answer(
      json({
        categories: CATEGORIES.map((row) =>
          row.category === 'event_changes'
            ? { ...row, push: { on: false, switchable: true } }
            : row,
        ),
      }),
    );

    expect(await screen.findByText('Saved.')).toBeTruthy();
    expect(push.getAttribute('aria-busy')).toBe('false');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('says push is blocked when the browser has denied it', async () => {
    permission('denied');
    settings(() => json({ categories: CATEGORIES }));

    expect(await screen.findByText(PUSH_BLOCKED)).toBeTruthy();
  });

  it.each(['granted', 'default'] as const)(
    'says nothing about push when the browser says %s',
    async (state) => {
      permission(state);
      settings(() => json({ categories: CATEGORIES }));

      await screen.findByRole('switch', { name: 'Event changes Push' });
      expect(screen.queryByText(PUSH_BLOCKED)).toBeNull();
    },
  );

  it('a Push switch still saves while push is blocked', async () => {
    permission('denied');
    settings(() =>
      json({
        categories: CATEGORIES.map((row) =>
          row.category === 'messages' ? { ...row, push: { on: false, switchable: true } } : row,
        ),
      }),
    );

    const push = (await screen.findByRole('switch', { name: 'Messages Push' })) as HTMLInputElement;
    expect(screen.getByText(PUSH_BLOCKED)).toBeTruthy();
    fireEvent.click(push);

    expect(await screen.findByText('Saved.')).toBeTruthy();
    expect(push.checked).toBe(false);
  });
});

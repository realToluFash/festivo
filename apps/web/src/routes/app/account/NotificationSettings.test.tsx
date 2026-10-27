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

function settings(put: () => Response) {
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
});

describe('Notification settings (sc-3980)', () => {
  it('names every switch by its row and column, and Account & security email stays on', async () => {
    settings(() => json({ categories: CATEGORIES }));

    expect(await screen.findByRole('switch', { name: 'Event changes Push' })).toBeTruthy();
    expect(screen.getAllByRole('switch')).toHaveLength(12);
    const security = screen.getByRole('switch', { name: 'Account & security Email' });
    expect((security as HTMLInputElement).disabled).toBe(true);
    expect((security as HTMLInputElement).checked).toBe(true);
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

    expect(await screen.findByText("Couldn't save the push switch. Try again.")).toBeTruthy();
    await waitFor(() =>
      expect(
        (screen.getByRole('switch', { name: 'Event changes Push' }) as HTMLInputElement).checked,
      ).toBe(true),
    );
  });
});

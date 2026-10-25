import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { routes } from '../index.tsx';

function healthy(): Response {
  return new Response(JSON.stringify({ status: 'ok', checks: { database: { status: 'ok' } } }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

function open() {
  return render(
    <RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/status'] })} />,
  );
}

afterEach(() => vi.restoreAllMocks());

describe('Service status, Try again (sc-11369)', () => {
  it('lands on the answer once the API answers, read once', async () => {
    const health = vi
      .spyOn(globalThis, 'fetch')
      .mockRejectedValue(new TypeError('Failed to fetch'));
    open();

    await screen.findByText('The API could not be reached.');
    expect(screen.getByRole('alert')).toBeDefined();
    expect(document.activeElement).toBe(document.body);

    health.mockResolvedValue(healthy());
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    const answer = await screen.findByText('All services are responding.');
    await waitFor(() => expect(document.activeElement).toBe(answer));
    expect(answer.getAttribute('role')).toBeNull();
  });

  it('lands on "The API could not be reached." when it fails again', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Failed to fetch'));
    open();

    await screen.findByText('The API could not be reached.');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByText('The API could not be reached.')),
    );
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

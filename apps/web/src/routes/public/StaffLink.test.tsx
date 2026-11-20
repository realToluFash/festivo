import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { routes } from '../index.tsx';

function answer(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': status < 400 ? 'application/json' : 'application/problem+json' },
  });
}

async function open(reply: () => Response, visible = true): Promise<string[]> {
  const asked: string[] = [];

  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(visible ? 'visible' : 'hidden');
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    asked.push(
      `${init?.method ?? 'GET'} ${new URL(String(input)).pathname} ${String(init?.body ?? '')}`,
    );

    return reply();
  });
  render(
    <RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/w/tok_ada'] })} />,
  );
  await waitFor(() => expect(asked).not.toHaveLength(0));

  return asked;
}

describe('A person’s own link (sc-3912)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('sends its token in the body of a POST, never in the address', async () => {
    const asked = await open(() => answer({ state: 'ended' }));

    expect(asked).toEqual(['POST /api/staff-links/opened {"token":"tok_ada"}']);
  });

  it('records nothing while the page is not visible', async () => {
    const asked = await open(() => answer({ state: 'ended' }), false);

    expect(asked).toEqual(['POST /api/staff-links/look {"token":"tok_ada"}']);
  });

  it('says when a link not open yet starts working, in the event’s own time', async () => {
    await open(() => answer({ state: 'not_yet', from: '2026-10-24T05:00:00+01:00' }));

    expect(
      await screen.findByRole('heading', {
        name: 'This link works from 05:00 on Saturday, Oct 24.',
      }),
    ).toBeTruthy();
    expect(
      screen.getByText('This link is yours alone. Nothing stays on this device.'),
    ).toBeTruthy();
  });

  it('says an ended link has ended', async () => {
    await open(() => answer({ state: 'ended' }));

    expect(await screen.findByRole('heading', { name: 'This link has ended.' })).toBeTruthy();
    expect(screen.getByText('Nothing stays on this device.')).toBeTruthy();
  });

  it('says only that an unknown, replaced or removed link does not work', async () => {
    await open(() =>
      answer(
        { type: 'https://soirely.com/errors/not_found', title: 'Not found', status: 404 },
        404,
      ),
    );

    expect(await screen.findByRole('heading', { name: 'This link does not work.' })).toBeTruthy();
  });

  it('says a failure is one to try again', async () => {
    await open(() =>
      answer({ type: 'https://soirely.com/errors/internal', title: 'Oops', status: 500 }, 500),
    );

    expect((await screen.findByRole('alert')).textContent).toBe(
      'That did not work. Try again in a moment.',
    );
  });
});

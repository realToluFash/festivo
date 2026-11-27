import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { routes } from '../index.tsx';

function answer(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': status < 400 ? 'application/json' : 'application/problem+json' },
  });
}

function open(replies: (() => Response)[], at = '/unsubscribe/guest-replies#tok_ada'): string[] {
  const asked: string[] = [];

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    asked.push(
      `${init?.method ?? 'GET'} ${new URL(String(input)).pathname} ${String(init?.body ?? '')}`,
    );

    return (replies.shift() ?? (() => answer({}, 500)))();
  });
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [at] })} />);

  return asked;
}

describe('The summary’s unsubscribe page (sc-4331)', () => {
  afterEach(() => vi.restoreAllMocks());

  it('asks where emails stand with the token in the body, and opening it changes nothing', async () => {
    const asked = open([() => answer({ emailOn: true })]);

    expect(await screen.findByRole('heading', { name: 'Guest reply emails' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Turn off guest reply emails' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Notification settings' })).toBeTruthy();
    expect(asked).toEqual(['POST /api/unsubscribe/guest-replies {"token":"tok_ada"}']);
  });

  it('turns them off with one tap and moves focus to the new heading', async () => {
    const asked = open([() => answer({ emailOn: true }), () => answer({ emailOn: false })]);

    fireEvent.click(await screen.findByRole('button', { name: 'Turn off guest reply emails' }));

    const heading = await screen.findByRole('heading', { name: 'Guest reply emails are off' });
    expect(document.activeElement).toBe(heading);
    expect(screen.getByRole('button', { name: 'Turn them back on' })).toBeTruthy();
    expect(asked[1]).toBe('PUT /api/unsubscribe/guest-replies {"token":"tok_ada","emailOn":false}');
  });

  it('opened while they are off offers only Turn them back on, which ends with no button', async () => {
    open([() => answer({ emailOn: false }), () => answer({ emailOn: true })]);

    fireEvent.click(await screen.findByRole('button', { name: 'Turn them back on' }));

    expect(
      await screen.findByRole('heading', { name: 'Guest reply emails are back on' }),
    ).toBeTruthy();
    expect(within(screen.getByRole('main')).queryByRole('button')).toBeNull();
  });

  it('keeps the label while saving, says Saving… once, and never shows a failed save as made', async () => {
    open([
      () => answer({ emailOn: true }),
      () => {
        throw new TypeError('offline');
      },
      () => answer({ emailOn: false }),
    ]);

    const button = await screen.findByRole('button', { name: 'Turn off guest reply emails' });
    fireEvent.click(button);
    expect(screen.getByRole('status').textContent).toBe('Saving…');

    expect(await screen.findByRole('alert')).toHaveProperty(
      'textContent',
      'Saving did not work. Nothing has changed.',
    );
    expect(screen.getByRole('heading', { name: 'Guest reply emails' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: 'Guest reply emails are off' })).toBeTruthy();
  });

  it('says a link that does not work changes nothing, and names nobody', async () => {
    open([() => answer({ title: 'Not found' }, 404)]);

    expect(await screen.findByRole('heading', { name: 'This link does not work' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Sign in to notification settings' })).toBeTruthy();
    expect(within(screen.getByRole('main')).queryByRole('button')).toBeNull();
  });

  it('with no token at all, is the link that does not work without asking', async () => {
    const asked = open([], '/unsubscribe/guest-replies');

    expect(await screen.findByRole('heading', { name: 'This link does not work' })).toBeTruthy();
    await waitFor(() => expect(asked).toEqual([]));
  });
});

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { routes } from '../index.tsx';

const TOKEN = 'goJP8j72G8dKsdGysCtB7qA4o2SdVzDrjFodz60tDDc';
const ADAEZE = 'Chief Mrs Adaeze Okonkwo-Williams';

type Answer = { status: number; body?: unknown };

function json({ status, body }: Answer): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': status >= 400 ? 'application/problem+json' : 'application/json' },
  });
}

const PAGE = {
  guest: { fullName: ADAEZE },
  event: {
    id: '0193f5a8-0000-7000-8000-000000000001',
    name: "Amara & Tobi's wedding",
    type: 'wedding',
    cover: null,
    hosts: ['Amara', 'Tobi'],
  },
};

const NOT_FOUND = {
  type: 'https://soirely.com/errors/not_found',
  title: 'We could not find what you asked for.',
  status: 404,
  detail: 'Not found.',
};

/** Answers each path in turn; the bodies sent are kept. */
function api(answers: Record<string, Answer[]>): { sent: { path: string; body: unknown }[] } {
  const sent: { path: string; body: unknown }[] = [];

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const path = new URL(typeof input === 'string' ? input : (input as Request).url).pathname;
    sent.push({ path, body: init?.body == null ? null : JSON.parse(String(init.body)) });
    const next = answers[path]?.shift();
    if (next == null) throw new TypeError('Failed to fetch');

    return json(next);
  });

  return { sent };
}

function open(token = TOKEN) {
  return render(
    <RouterProvider router={createMemoryRouter(routes, { initialEntries: [`/i/${token}`] })} />,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("a guest's own link", () => {
  it('opens You are invited with their full name and the event, the token sent in the body only', async () => {
    const { sent } = api({ '/api/guest-links/page': [{ status: 200, body: PAGE }] });
    open();

    expect(await screen.findByRole('heading', { level: 1, name: 'You are invited' })).toBeDefined();
    expect(screen.getByText(ADAEZE)).toBeDefined();
    expect(screen.getByText("Amara & Tobi's wedding")).toBeDefined();
    expect(sent).toEqual([{ path: '/api/guest-links/page', body: { token: TOKEN } }]);
  });

  it('keeps the account line last before the closing line, and drops the old body', async () => {
    api({ '/api/guest-links/page': [{ status: 200, body: PAGE }] });
    open();

    const account = await screen.findByText('You do not need an account to reply.');
    const closing = screen.getByText(
      'This invitation is for you and your family. Other guests cannot see your answer.',
    );
    expect(
      account.compareDocumentPosition(closing) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.queryByText(/This page is yours for this event/)).toBeNull();
  });

  it('is marked not to be indexed and to send no referrer', async () => {
    api({ '/api/guest-links/page': [{ status: 200, body: PAGE }] });
    open();
    await screen.findByText(ADAEZE);

    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe(
      'noindex, nofollow',
    );
    expect(document.querySelector('meta[name="referrer"]')?.getAttribute('content')).toBe(
      'no-referrer',
    );
  });

  it('shows a photo cover with its description as its text alternative', async () => {
    api({
      '/api/guest-links/page': [
        {
          status: 200,
          body: {
            ...PAGE,
            event: {
              ...PAGE.event,
              cover: {
                position: 30,
                description: 'The couple under the arch',
                sizes: [{ width: 640, url: 'https://storage.test/c/small.webp' }],
              },
            },
          },
        },
      ],
    });
    open();

    expect(
      (await screen.findByRole('img', { name: 'The couple under the arch' })).getAttribute('src'),
    ).toBe('https://storage.test/c/small.webp');
  });

  it('opens This invitation link does not work for a token the API does not know', async () => {
    api({ '/api/guest-links/page': [{ status: 404, body: NOT_FOUND }] });
    open();

    expect(
      await screen.findByRole('heading', { name: 'This invitation link does not work' }),
    ).toBeDefined();
    expect(screen.queryByText(ADAEZE)).toBeNull();
  });
});

describe('Not {full name}? Tell us', () => {
  async function ask(answers: Answer[]) {
    const calls = api({
      '/api/guest-links/page': [{ status: 200, body: PAGE }],
      '/api/guest-links/wrong-person': answers,
    });
    open();
    fireEvent.click(await screen.findByRole('button', { name: `Not ${ADAEZE}? Tell us` }));

    return calls;
  }

  it('asks first, names both hosts, and thanks the person once told', async () => {
    const { sent } = await ask([{ status: 204 }]);

    expect(
      screen.getByRole('heading', {
        name: 'Tell Amara and Tobi this link reached the wrong person?',
      }),
    ).toBe(document.activeElement);
    fireEvent.click(screen.getByRole('button', { name: 'Tell them' }));

    const thanks = await screen.findByText(
      'Thank you. Amara and Tobi have been told and will look into it. You can close this page.',
    );
    expect(thanks).toBe(document.activeElement);
    expect(sent.at(-1)).toEqual({ path: '/api/guest-links/wrong-person', body: { token: TOKEN } });
    expect(screen.queryByRole('button', { name: `Not ${ADAEZE}? Tell us` })).toBeNull();
  });

  it('goes back to the card, sending nothing', async () => {
    const { sent } = await ask([]);

    fireEvent.click(screen.getByRole('button', { name: 'Go back' }));

    expect(screen.getByRole('button', { name: `Not ${ADAEZE}? Tell us` })).toBe(
      document.activeElement,
    );
    expect(sent.map(({ path }) => path)).toEqual(['/api/guest-links/page']);
  });

  it('says when it was not sent, and when the link has been tried too many times', async () => {
    await ask([
      {
        status: 500,
        body: { type: 'https://soirely.com/errors/internal_error', title: 'x', status: 500 },
      },
      {
        status: 429,
        body: { type: 'https://soirely.com/errors/too_many_attempts', title: 'x', status: 429 },
      },
    ]);

    fireEvent.click(screen.getByRole('button', { name: 'Tell them' }));
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Not sent. Check your connection and try again.',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Tell them' }));
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe(
        'Too many tries from this link. Try again later.',
      ),
    );
  });
});

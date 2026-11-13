import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18next from 'i18next';
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
  guest: { fullName: ADAEZE, reply: null, companions: 0 },
  event: {
    id: '0193f5a8-0000-7000-8000-000000000001',
    name: "Amara & Tobi's wedding",
    type: 'wedding',
    cover: null,
    hosts: ['Amara', 'Tobi'],
    startsAt: '2030-11-14T16:00:00+01:00',
    timeZone: 'Africa/Lagos',
    venue: { name: 'The Civic Centre', address: 'Ozumba Mbadiwe Ave, Victoria Island, Lagos' },
  },
  answersOpen: true,
};

function answered(answer: string, at = '2026-10-17T14:20:00+01:00', companions = 0) {
  return { ...PAGE, guest: { ...PAGE.guest, reply: { answer, at }, companions } };
}

const CLOSED = {
  type: 'https://soirely.com/errors/replies_closed',
  title: 'Answers have closed.',
  status: 409,
  detail: 'Answers have closed.',
};

const BROKEN = { type: 'https://soirely.com/errors/internal_error', title: 'x', status: 500 };

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
  localStorage.clear();
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

    const account = await screen.findByText('You do not need an account to answer.');
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

describe('answering', () => {
  it('offers the three answers with none marked, and says when and where with a maps link', async () => {
    api({ '/api/guest-links/page': [{ status: 200, body: PAGE }] });
    open();

    const rows = await screen.findAllByRole('button', {
      name: /I’ll be there|I can’t|not sure yet/,
    });
    expect(rows.map((row) => row.querySelector('.gp-answer-words')?.textContent)).toEqual([
      'Yes, I’ll be there',
      'Sorry, I can’t',
      'I’m not sure yet',
    ]);
    expect(rows.every((row) => row.getAttribute('aria-pressed') == null)).toBe(true);
    expect(screen.getByText('The Civic Centre')).toBeDefined();
    expect(screen.getByRole('link', { name: 'Open in maps' }).getAttribute('href')).toBe(
      'https://www.google.com/maps/search/?api=1&query=Ozumba%20Mbadiwe%20Ave%2C%20Victoria%20Island%2C%20Lagos',
    );
  });

  it('shows the address and its link with no name, and no line with neither', async () => {
    api({
      '/api/guest-links/page': [
        {
          status: 200,
          body: { ...PAGE, event: { ...PAGE.event, venue: { name: null, address: 'Lekki' } } },
        },
        { status: 200, body: { ...PAGE, event: { ...PAGE.event, venue: null } } },
      ],
    });
    const first = open();
    expect(await screen.findByText('Lekki')).toBeDefined();
    expect(screen.getByRole('link', { name: 'Open in maps' })).toBeDefined();
    first.unmount();

    open();
    await screen.findByText(ADAEZE);
    expect(screen.queryByRole('link', { name: 'Open in maps' })).toBeNull();
  });

  it('records Sorry, I can’t in one tap and greets the guest by their full name', async () => {
    const { sent } = api({
      '/api/guest-links/page': [{ status: 200, body: PAGE }],
      '/api/guest-links/reply': [{ status: 200, body: answered('notComing') }],
    });
    open();

    fireEvent.click(await screen.findByRole('button', { name: 'Sorry, I can’t' }));

    const greeting = await screen.findByRole('heading', { name: `We’ll miss you, ${ADAEZE}.` });
    expect(greeting).toBe(document.activeElement);
    expect(screen.getByText(/You answered Not coming on/)).toBeDefined();
    expect(screen.getByRole('button', { name: 'Change my answer' })).toBeDefined();
    expect(sent.at(-1)).toEqual({
      path: '/api/guest-links/reply',
      body: { token: TOKEN, answer: 'notComing' },
    });
  });

  it('tells a guest with companions that they won’t be coming either', async () => {
    api({
      '/api/guest-links/page': [
        { status: 200, body: { ...PAGE, guest: { ...PAGE.guest, companions: 2 } } },
      ],
      '/api/guest-links/reply': [{ status: 200, body: answered('notComing', undefined, 2) }],
    });
    open();

    fireEvent.click(await screen.findByRole('button', { name: 'Sorry, I can’t' }));

    expect(await screen.findByText('Your companions won’t be coming either.')).toBeDefined();
  });

  it('records I’m not sure yet in one tap', async () => {
    api({
      '/api/guest-links/page': [{ status: 200, body: PAGE }],
      '/api/guest-links/reply': [{ status: 200, body: answered('maybe') }],
    });
    open();

    fireEvent.click(await screen.findByRole('button', { name: 'I’m not sure yet' }));

    expect(
      await screen.findByRole('heading', { name: `Thanks for letting us know, ${ADAEZE}.` }),
    ).toBeDefined();
  });

  it('takes Yes to Check and send, sending nothing until Send my answer', async () => {
    const { sent } = api({
      '/api/guest-links/page': [{ status: 200, body: PAGE }],
      '/api/guest-links/reply': [{ status: 200, body: answered('coming') }],
    });
    open();

    fireEvent.click(await screen.findByRole('button', { name: 'Yes, I’ll be there' }));

    expect(screen.getByRole('heading', { name: 'Check and send' })).toBe(document.activeElement);
    expect(screen.getByText('Your answer: Coming')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Back' })).toBeDefined();
    expect(screen.queryByText(/Step/)).toBeNull();
    expect(sent.map(({ path }) => path)).toEqual(['/api/guest-links/page']);

    fireEvent.click(screen.getByRole('button', { name: 'Send my answer' }));

    expect(await screen.findByRole('heading', { name: `See you there, ${ADAEZE}.` })).toBeDefined();
    expect(sent.at(-1)?.body).toEqual({ token: TOKEN, answer: 'coming' });
  });

  it('goes back from Check and send to the three answers', async () => {
    api({ '/api/guest-links/page': [{ status: 200, body: PAGE }] });
    open();

    fireEvent.click(await screen.findByRole('button', { name: 'Yes, I’ll be there' }));
    fireEvent.click(screen.getByRole('button', { name: 'Change' }));

    expect(screen.getByRole('button', { name: 'Yes, I’ll be there' })).toBe(document.activeElement);
  });

  it('says a Yes left part-way was not sent on a return in the same browser, with nothing marked', async () => {
    api({
      '/api/guest-links/page': [
        { status: 200, body: PAGE },
        { status: 200, body: PAGE },
      ],
    });
    const first = open();
    fireEvent.click(await screen.findByRole('button', { name: 'Yes, I’ll be there' }));
    first.unmount();

    open();

    expect(await screen.findByText(i18next.t('guest.unsent'))).toBeDefined();
    expect(screen.getByRole('button', { name: 'Yes, I’ll be there' })).toBeDefined();
  });

  it('comes back to a recorded answer unchanged, with no notice, after a change left part-way', async () => {
    api({
      '/api/guest-links/page': [
        { status: 200, body: answered('maybe') },
        { status: 200, body: answered('maybe') },
      ],
    });
    const first = open();
    fireEvent.click(await screen.findByRole('button', { name: 'Change my answer' }));
    fireEvent.click(screen.getByRole('button', { name: /Yes, I’ll be there/ }));
    first.unmount();

    open();

    expect(
      await screen.findByRole('heading', { name: `Thanks for letting us know, ${ADAEZE}.` }),
    ).toBeDefined();
    expect(screen.queryByText(i18next.t('guest.unsent'))).toBeNull();
  });

  it('keeps Check and send as it was when the answer could not be sent, and sends again', async () => {
    api({
      '/api/guest-links/page': [{ status: 200, body: PAGE }],
      '/api/guest-links/reply': [
        { status: 500, body: BROKEN },
        { status: 200, body: answered('coming') },
      ],
    });
    open();
    fireEvent.click(await screen.findByRole('button', { name: 'Yes, I’ll be there' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send my answer' }));

    expect((await screen.findByRole('alert')).textContent).toBe(i18next.t('guest.notSent'));
    expect(screen.queryByText(/See you there/)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Send my answer' }));
    expect(await screen.findByRole('heading', { name: `See you there, ${ADAEZE}.` })).toBeDefined();
  });

  it('says a one-tap answer was not sent and records nothing on screen', async () => {
    api({
      '/api/guest-links/page': [{ status: 200, body: PAGE }],
      '/api/guest-links/reply': [{ status: 500, body: BROKEN }],
    });
    open();
    fireEvent.click(await screen.findByRole('button', { name: 'I’m not sure yet' }));

    expect((await screen.findByRole('alert')).textContent).toBe(i18next.t('guest.notSentTap'));
    expect(screen.queryByText(/Thanks for letting us know/)).toBeNull();
  });
});

describe('changing an answer', () => {
  it('shows the answer given, then the three with the current one marked', async () => {
    api({
      '/api/guest-links/page': [{ status: 200, body: answered('coming') }],
      '/api/guest-links/reply': [
        { status: 200, body: answered('notComing', '2026-10-19T10:00:00+01:00') },
      ],
    });
    open();

    expect(await screen.findByText(/You answered Coming on/)).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Change my answer' }));

    expect(screen.getByRole('heading', { name: 'Your new answer' })).toBe(document.activeElement);
    expect(
      screen.getByRole('button', { name: /Yes, I’ll be there/ }).getAttribute('aria-pressed'),
    ).toBe('true');
    expect(
      screen.getByRole('button', { name: 'Sorry, I can’t' }).getAttribute('aria-pressed'),
    ).toBe('false');

    fireEvent.click(screen.getByRole('button', { name: 'Sorry, I can’t' }));
    expect(
      await screen.findByRole('heading', { name: `We’ll miss you, ${ADAEZE}.` }),
    ).toBeDefined();
  });

  it('says nothing changed when the same answer is sent again', async () => {
    api({
      '/api/guest-links/page': [{ status: 200, body: answered('maybe') }],
      '/api/guest-links/reply': [{ status: 200, body: answered('maybe') }],
    });
    open();

    fireEvent.click(await screen.findByRole('button', { name: 'Change my answer' }));
    fireEvent.click(screen.getByRole('button', { name: /I’m not sure yet/ }));

    expect(
      await screen.findByText('You’re already down as Not sure yet. Nothing has changed.'),
    ).toBeDefined();
  });

  it('keeps the answer with Keep my answer', async () => {
    const { sent } = api({ '/api/guest-links/page': [{ status: 200, body: answered('coming') }] });
    open();

    fireEvent.click(await screen.findByRole('button', { name: 'Change my answer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep my answer' }));

    expect(screen.getByRole('button', { name: 'Change my answer' })).toBe(document.activeElement);
    expect(sent).toHaveLength(1);
  });
});

describe('when answers have closed', () => {
  it('shows the answer given with no buttons', async () => {
    api({
      '/api/guest-links/page': [
        { status: 200, body: { ...answered('coming'), answersOpen: false } },
      ],
    });
    open();

    expect(await screen.findByRole('heading', { name: /You answered Coming on/ })).toBeDefined();
    expect(
      screen.getByText('Answers have closed. Contact your host if something has changed.'),
    ).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Change my answer' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Yes, I’ll be there' })).toBeNull();
  });

  it('says You didn’t answer to a guest who never did', async () => {
    api({ '/api/guest-links/page': [{ status: 200, body: { ...PAGE, answersOpen: false } }] });
    open();

    expect(
      await screen.findByRole('heading', { name: i18next.t('guest.didNotAnswer') }),
    ).toBeDefined();
  });

  it('switches to the closed view when a send is refused 409 replies_closed', async () => {
    api({
      '/api/guest-links/page': [{ status: 200, body: PAGE }],
      '/api/guest-links/reply': [{ status: 409, body: CLOSED }],
    });
    open();
    fireEvent.click(await screen.findByRole('button', { name: 'Sorry, I can’t' }));

    expect(
      await screen.findByRole('heading', { name: i18next.t('guest.didNotAnswer') }),
    ).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Sorry, I can’t' })).toBeNull();
  });
});

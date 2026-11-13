import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18next from 'i18next';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { atPhoneWidth, atWideWidth } from '../../test-widths.ts';
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
  phase: 'live',
  started: false,
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
  vi.useRealTimers();
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

  it('reads cover, answers, when, where and who, then the foot', async () => {
    api({ '/api/guest-links/page': [{ status: 200, body: PAGE }] });
    open();

    const answers = await screen.findByRole('heading', { name: 'Your answer' });
    const where = screen.getByText('The Civic Centre');
    const foot = screen.getByText('You do not need an account to answer.');
    const after = (first: Node, second: Node) =>
      first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING;
    expect(after(screen.getByRole('heading', { level: 1 }), answers)).toBeTruthy();
    expect(after(answers, where)).toBeTruthy();
    expect(after(where, foot)).toBeTruthy();
  });

  it('draws only the cover, the answer and three rows while it loads at a phone', async () => {
    atPhoneWidth();
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise<Response>(() => {}));
    const { container } = open();

    await screen.findByRole('status');
    expect(container.querySelector('.gp-skel-cover')).not.toBeNull();
    expect(container.querySelectorAll('.gp-skel-row')).toHaveLength(3);
    expect(container.querySelector('.gp-skel-details')).toBeNull();
  });

  it('adds the details beside the answer while it loads in two columns', async () => {
    atWideWidth();
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise<Response>(() => {}));
    const { container } = open();

    await screen.findByRole('status');
    expect(container.querySelectorAll('.gp-skel-row')).toHaveLength(3);
    expect(container.querySelector('.gp-skel-details')).not.toBeNull();
  });

  it('names the language shown on a button that opens the four in their own names', async () => {
    api({ '/api/guest-links/page': [{ status: 200, body: PAGE }] });
    open();

    const button = await screen.findByRole('button', { name: 'Language: English' });
    expect(screen.queryByRole('combobox')).toBeNull();
    fireEvent.click(button);

    const items = screen.getAllByRole('menuitemradio');
    expect(items.map((item) => item.textContent)).toEqual([
      'English',
      'Español',
      'Français',
      'Português',
    ]);
    expect(items[0]?.getAttribute('aria-checked')).toBe('true');
    expect(items[2]?.getAttribute('lang')).toBe('fr');
    expect(screen.queryByText('Your language follows you to every device.')).toBeNull();

    fireEvent.keyDown(items[0] as HTMLElement, { key: 'End' });
    expect(document.activeElement).toBe(items[3]);
    fireEvent.keyDown(items[3] as HTMLElement, { key: 'Home' });
    expect(document.activeElement).toBe(items[0]);
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

  it('keeps the closing line and Not {name}? in the foot, without the line about answering', async () => {
    api({ '/api/guest-links/page': [{ status: 200, body: { ...PAGE, answersOpen: false } }] });
    open();

    expect(
      await screen.findByText(
        'This invitation is for you and your family. Other guests cannot see your answer.',
      ),
    ).toBeDefined();
    expect(screen.queryByText('You do not need an account to answer.')).toBeNull();
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

describe('when the event is paused, called off or over (sc-3591)', () => {
  const PAUSED_NOTICE =
    'This event is paused. Answers are closed. Nothing you sent has been lost, and this page will update if the event resumes.';
  const REASON = 'Answers are closed while the event is paused. Anything you sent is kept.';

  function at(phase: string, started: boolean, page: object = PAGE) {
    return { ...page, phase, started, answersOpen: false };
  }

  it('keeps the invitation’s head when paused before the start, with Change my answer off and described by its reason', async () => {
    const { sent } = api({
      '/api/guest-links/page': [{ status: 200, body: at('paused', false, answered('coming')) }],
    });
    open();

    const notice = (await screen.findByText(PAUSED_NOTICE)).closest('[role="status"]');
    expect(notice?.getAttribute('aria-live')).toBe('polite');
    expect(notice?.textContent).toContain('Paused');
    expect(screen.getByRole('heading', { level: 1, name: 'You are invited' })).toBeDefined();
    expect(screen.getByText(ADAEZE)).toBeDefined();
    expect(screen.getByRole('heading', { name: /You answered Coming on/ })).toBeDefined();
    const change = screen.getByRole('button', { name: 'Change my answer' });
    expect(change.getAttribute('aria-disabled')).toBe('true');
    expect(
      document.getElementById(change.getAttribute('aria-describedby') ?? '')?.textContent,
    ).toBe(REASON);
    fireEvent.click(change);
    expect(screen.queryByRole('button', { name: 'Yes, I’ll be there' })).toBeNull();
    expect(sent.map(({ path }) => path)).toEqual(['/api/guest-links/page']);
    expect(screen.queryByText(/Answers have closed/)).toBeNull();
  });

  it('reads the notice before the cover card at a desk, where the columns sit side by side', async () => {
    atWideWidth();
    api({
      '/api/guest-links/page': [{ status: 200, body: at('paused', false, answered('coming')) }],
    });
    open();

    const notice = (await screen.findByText(PAUSED_NOTICE)).closest('[role="status"]');
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(notice?.parentElement?.classList.contains('gp-columns')).toBe(true);
    expect(notice?.compareDocumentPosition(h1)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });

  it('says You didn’t answer, paused before the start, and offers no answer', async () => {
    api({ '/api/guest-links/page': [{ status: 200, body: at('paused', false) }] });
    open();

    expect(
      await screen.findByRole('heading', { name: i18next.t('guest.didNotAnswer') }),
    ).toBeDefined();
    expect(
      screen.getByRole('button', { name: 'Change my answer' }).getAttribute('aria-disabled'),
    ).toBe('true');
    expect(screen.queryByRole('button', { name: 'Sorry, I can’t' })).toBeNull();
  });

  it('shows the answer read-only when paused after the start, with no closed line', async () => {
    api({
      '/api/guest-links/page': [{ status: 200, body: at('paused', true, answered('coming')) }],
    });
    open();

    expect(await screen.findByRole('heading', { name: /You answered Coming on/ })).toBeDefined();
    expect(screen.getByText(PAUSED_NOTICE)).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Change my answer' })).toBeNull();
    expect(screen.queryByText(/Answers have closed/)).toBeNull();
    expect(screen.queryByText(REASON)).toBeNull();
  });

  it('leads with the event’s name once called off, with no answer and the name only in Tell us', async () => {
    api({
      '/api/guest-links/page': [{ status: 200, body: at('calledOff', false, answered('coming')) }],
    });
    open();

    expect(
      await screen.findByRole('heading', { level: 1, name: "Amara & Tobi's wedding" }),
    ).toBeDefined();
    expect(
      screen.getByText(
        'This event has been called off. It will not go ahead. There is nothing you need to do.',
      ),
    ).toBeDefined();
    expect(screen.queryByText('You are invited')).toBeNull();
    expect(screen.queryByText(/You answered/)).toBeNull();
    expect(screen.queryByText('Coming')).toBeNull();
    expect(screen.queryByText(ADAEZE)).toBeNull();
    expect(screen.getByRole('button', { name: `Not ${ADAEZE}? Tell us` })).toBeDefined();
    expect(screen.queryByText('You do not need an account to answer.')).toBeNull();
  });

  it('keeps the answer read-only once finished, under the event’s name', async () => {
    api({
      '/api/guest-links/page': [{ status: 200, body: at('finished', true, answered('notComing')) }],
    });
    open();

    expect(
      await screen.findByRole('heading', { level: 1, name: "Amara & Tobi's wedding" }),
    ).toBeDefined();
    expect(
      screen.getByText('This event has taken place. This page stays here as a keepsake.'),
    ).toBeDefined();
    expect(screen.getByText(/You answered Not coming on/)).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Change my answer' })).toBeNull();
    expect(screen.queryByText('You are invited')).toBeNull();
    expect(screen.getByRole('button', { name: `Not ${ADAEZE}? Tell us` })).toBeDefined();
  });

  it.each([
    ['paused before the start', 'paused', false],
    ['paused after the start', 'paused', true],
    ['called off', 'calledOff', false],
    ['finished', 'finished', true],
  ])(
    'drops the account line from the foot when %s, keeping the closing line and Tell us',
    async (_, phase, started) => {
      api({
        '/api/guest-links/page': [{ status: 200, body: at(phase, started, answered('coming')) }],
      });
      open();

      expect(await screen.findByText(i18next.t('guest.closing'))).toBeDefined();
      expect(screen.getByRole('button', { name: `Not ${ADAEZE}? Tell us` })).toBeDefined();
      expect(screen.queryByText('You do not need an account to answer.')).toBeNull();
    },
  );

  it('keeps Check and send with what was chosen when a send is refused 409 event_paused', async () => {
    api({
      '/api/guest-links/page': [
        { status: 200, body: PAGE },
        { status: 200, body: at('paused', false) },
      ],
      '/api/guest-links/reply': [
        {
          status: 409,
          body: {
            type: 'https://soirely.com/errors/event_paused',
            title: 'The event is paused.',
            status: 409,
          },
        },
      ],
    });
    open();
    fireEvent.click(await screen.findByRole('button', { name: 'Yes, I’ll be there' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send my answer' }));

    expect(
      await screen.findByText(
        'Answers closed before this was sent. Everything you chose is still here.',
      ),
    ).toBeDefined();
    expect(await screen.findByText(PAUSED_NOTICE)).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Send my answer' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Check and send' })).toBe(document.activeElement);
  });

  it('gives a one-tap answer refused 409 event_concluded way to the page as it now stands, focus on the h1', async () => {
    api({
      '/api/guest-links/page': [
        { status: 200, body: PAGE },
        { status: 200, body: at('calledOff', false) },
      ],
      '/api/guest-links/reply': [
        {
          status: 409,
          body: {
            type: 'https://soirely.com/errors/event_concluded',
            title: 'x',
            status: 409,
          },
        },
      ],
    });
    open();
    const no = await screen.findByRole('button', { name: 'Sorry, I can’t' });
    no.focus();
    fireEvent.click(no);

    const h1 = await screen.findByRole('heading', { level: 1, name: "Amara & Tobi's wedding" });
    await waitFor(() => expect(document.activeElement).toBe(h1));
  });
});

describe('a page left open (sc-3591)', () => {
  async function leftOpen(first: object, next: object) {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    api({
      '/api/guest-links/page': [
        { status: 200, body: first },
        { status: 200, body: next },
      ],
    });
    open();
    await screen.findByRole('heading', { level: 1 });
  }

  async function later() {
    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });
  }

  it('shows the paused notice within a minute and moves focus from an answer button to the h1', async () => {
    await leftOpen(PAGE, { ...PAGE, phase: 'paused', answersOpen: false });
    screen.getByRole('button', { name: 'Sorry, I can’t' }).focus();

    await later();

    expect(await screen.findByText(/This event is paused\. Answers are closed\./)).toBeDefined();
    const h1 = screen.getByRole('heading', { level: 1, name: 'You are invited' });
    await waitFor(() => expect(document.activeElement).toBe(h1));
  });

  it('keeps focus on Change my answer when a guest who answered sees the event resume', async () => {
    await leftOpen(
      { ...answered('coming'), phase: 'paused', answersOpen: false },
      answered('coming'),
    );
    screen.getByRole('button', { name: 'Change my answer' }).focus();

    await later();

    expect(await screen.findByRole('heading', { name: `See you there, ${ADAEZE}.` })).toBeDefined();
    expect(screen.queryByText(/This event is paused/)).toBeNull();
    const change = screen.getByRole('button', { name: 'Change my answer' });
    expect(change.getAttribute('aria-disabled')).toBe('false');
    expect(document.activeElement).toBe(change);
  });

  it('moves focus to the h1 when a guest who never answered sees the event resume', async () => {
    await leftOpen({ ...PAGE, phase: 'paused', answersOpen: false }, PAGE);
    screen.getByRole('button', { name: 'Change my answer' }).focus();

    await later();

    expect(await screen.findByRole('button', { name: 'Sorry, I can’t' })).toBeDefined();
    expect(screen.getByText('You do not need an account to answer.')).toBeDefined();
    const h1 = screen.getByRole('heading', { level: 1, name: 'You are invited' });
    await waitFor(() => expect(document.activeElement).toBe(h1));
  });

  it('moves focus from the switched-off Change my answer to the h1 when the start passes while paused', async () => {
    await leftOpen(
      { ...answered('coming'), phase: 'paused', answersOpen: false },
      { ...answered('coming'), phase: 'paused', started: true, answersOpen: false },
    );
    screen.getByRole('button', { name: 'Change my answer' }).focus();

    await later();

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Change my answer' })).toBeNull(),
    );
    const h1 = screen.getByRole('heading', { level: 1, name: 'You are invited' });
    await waitFor(() => expect(document.activeElement).toBe(h1));
  });

  it('writes the paused notice into the status region already there while Live', async () => {
    await leftOpen(PAGE, { ...PAGE, phase: 'paused', answersOpen: false });
    const region = document.querySelector('.gp-columns [aria-live="polite"][role="status"]');
    expect(region?.textContent).toBe('');

    await later();

    await waitFor(() => expect(region?.textContent).toContain('This event is paused.'));
    expect(region?.isConnected).toBe(true);
  });

  it('keeps the answer just sent when a poll asked before it lands after it', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    let land: (response: Response) => void = () => undefined;
    const pages = [
      Promise.resolve(json({ status: 200, body: PAGE })),
      new Promise<Response>((resolve) => {
        land = resolve;
      }),
    ];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const path = new URL(typeof input === 'string' ? input : (input as Request).url).pathname;
      if (path === '/api/guest-links/reply') {
        return json({ status: 200, body: answered('notComing') });
      }
      const next = pages.shift();
      if (next == null) throw new TypeError('Failed to fetch');

      return next;
    });
    open();
    await screen.findByRole('heading', { level: 1 });

    await later();
    fireEvent.click(screen.getByRole('button', { name: 'Sorry, I can’t' }));
    const greeting = await screen.findByRole('heading', { name: `We’ll miss you, ${ADAEZE}.` });
    await act(async () => {
      land(json({ status: 200, body: PAGE }));
    });

    expect(greeting.isConnected).toBe(true);
    expect(screen.getByRole('button', { name: 'Change my answer' })).toBeDefined();
  });

  it('leaves focus where it was when nothing it held goes away', async () => {
    await leftOpen(PAGE, { ...PAGE, phase: 'paused', answersOpen: false });
    const tell = screen.getByRole('button', { name: `Not ${ADAEZE}? Tell us` });
    tell.focus();

    await later();

    expect(await screen.findByText(/This event is paused\. Answers are closed\./)).toBeDefined();
    expect(document.activeElement).toBe(tell);
  });

  it('opens This invitation link does not work once the event is deleted', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    api({
      '/api/guest-links/page': [
        { status: 200, body: PAGE },
        { status: 404, body: NOT_FOUND },
      ],
    });
    open();
    await screen.findByRole('heading', { level: 1 });

    await later();

    expect(
      await screen.findByRole('heading', { name: 'This invitation link does not work' }),
    ).toBeDefined();
  });
});

describe('Add to calendar (sc-3627)', () => {
  const FEED = '/api/guest-calendars/abc.ics';
  const coming = (extra: Record<string, unknown> = {}) => ({
    ...answered('coming'),
    calendarFeed: FEED,
    ...extra,
  });

  it('offers Apple / Outlook by webcal and Google Calendar by URL after Coming, each read with the line', async () => {
    api({ '/api/guest-links/page': [{ status: 200, body: coming() }] });
    open();

    const heading = await screen.findByRole('heading', { level: 2, name: 'Add to calendar' });
    const apple = screen.getByRole('link', { name: 'Apple / Outlook' });
    const google = screen.getByRole('link', { name: 'Google Calendar' });
    const line = screen.getByText(
      'Your calendar updates by itself if the date, time or place changes.',
    );

    expect(heading).toBeDefined();
    expect(apple.getAttribute('href')).toMatch(/^webcal:\/\/.+\/api\/guest-calendars\/abc\.ics$/);
    expect(google.getAttribute('href')).toMatch(
      /^https:\/\/calendar\.google\.com\/calendar\/r\?cid=webcal%3A%2F%2F.+abc\.ics$/,
    );
    expect(google.getAttribute('target')).toBe('_blank');
    for (const link of [apple, google]) {
      expect(link.getAttribute('aria-describedby')).toBe(line.id);
    }
  });

  it('stays with Coming once answers have closed, during Happening now', async () => {
    api({
      '/api/guest-links/page': [
        { status: 200, body: coming({ answersOpen: false, started: true }) },
      ],
    });
    open();

    expect(await screen.findByRole('heading', { name: 'Add to calendar' })).toBeDefined();
  });

  it('is not there without a feed: another answer, or a paused, called-off or finished event', async () => {
    for (const body of [
      { ...answered('notComing'), calendarFeed: null },
      { ...answered('maybe'), calendarFeed: null },
      { ...answered('coming'), phase: 'paused', answersOpen: false, calendarFeed: null },
      { ...answered('coming'), phase: 'calledOff', answersOpen: false, calendarFeed: null },
      { ...answered('coming'), phase: 'finished', answersOpen: false, calendarFeed: null },
    ]) {
      api({ '/api/guest-links/page': [{ status: 200, body }] });
      const { unmount } = open();

      expect(await screen.findAllByRole('heading', { level: 1 })).toBeDefined();
      expect(screen.queryByRole('heading', { name: 'Add to calendar' })).toBeNull();
      unmount();
      vi.restoreAllMocks();
    }
  });

  it('leaves while the answer is being changed, and comes back on keeping it', async () => {
    api({ '/api/guest-links/page': [{ status: 200, body: coming() }] });
    open();

    fireEvent.click(await screen.findByRole('button', { name: 'Change my answer' }));
    expect(screen.queryByRole('heading', { name: 'Add to calendar' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Keep my answer' }));
    expect(screen.getByRole('heading', { name: 'Add to calendar' })).toBeDefined();
  });

  it('leaves when Coming changes to Sorry, I can’t', async () => {
    api({
      '/api/guest-links/page': [{ status: 200, body: coming() }],
      '/api/guest-links/reply': [
        { status: 200, body: { ...answered('notComing'), calendarFeed: null } },
      ],
    });
    open();

    fireEvent.click(await screen.findByRole('button', { name: 'Change my answer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Sorry, I can’t' }));

    expect(
      await screen.findByRole('heading', { name: `We’ll miss you, ${ADAEZE}.` }),
    ).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'Add to calendar' })).toBeNull();
  });
});

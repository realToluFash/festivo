import { fireEvent, render, screen } from '@testing-library/react';
import i18next from 'i18next';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { routes } from '../index.tsx';

const TOKEN = 'goJP8j72G8dKsdGysCtB7qA4o2SdVzDrjFodz60tDDc';
const ADAEZE = 'Chief Mrs Adaeze Okonkwo-Williams';

type Answer = { status: number; body?: unknown };

const NO_NEEDS = {
  allergies: [] as string[],
  otherAllergy: null,
  diet: [] as string[],
  otherDiet: null,
  access: [] as string[],
  otherAccess: null,
  changed: null,
};

const PAGE = {
  guest: {
    fullName: ADAEZE,
    reply: null as object | null,
    needs: NO_NEEDS,
    places: 0,
    unnamed: [] as object[],
    companions: [] as object[],
  },
  language: { chosen: null, host: null, organisation: 'en' },
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
  onTheDay: false,
  answersOpen: true,
};

function answered(answer: string, at = '2026-10-20T14:20:00+01:00', places = 0) {
  return { ...PAGE, guest: { ...PAGE.guest, reply: { answer, at }, places } };
}

function api(answers: Record<string, Answer[]>): { sent: { path: string; body: unknown }[] } {
  const sent: { path: string; body: unknown }[] = [];

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const path = new URL(typeof input === 'string' ? input : (input as Request).url).pathname;
    sent.push({ path, body: init?.body == null ? null : JSON.parse(String(init.body)) });
    const next = answers[path]?.shift();
    if (next == null) throw new TypeError('Failed to fetch');

    return new Response(next.body === undefined ? null : JSON.stringify(next.body), {
      status: next.status,
      headers: {
        'Content-Type': next.status >= 400 ? 'application/problem+json' : 'application/json',
      },
    });
  });

  return { sent };
}

function open(answer: string) {
  return render(
    <RouterProvider
      router={createMemoryRouter(routes, { initialEntries: [`/i/${TOKEN}?answer=${answer}`] })}
    />,
  );
}

afterEach(async () => {
  await i18next.changeLanguage('en');
  vi.restoreAllMocks();
  localStorage.clear();
});

describe('an answer link from the invitation (sc-1291)', () => {
  it('opens with Not coming chosen and records it only on Confirm, from the email link', async () => {
    const { sent } = api({
      '/api/guest-links/page': [{ status: 200, body: PAGE }],
      '/api/guest-links/reply': [{ status: 200, body: answered('notComing') }],
    });
    open('notComing');

    expect(await screen.findByRole('heading', { name: 'Confirm your answer' })).toBe(
      document.activeElement,
    );
    expect(screen.getByText('Sorry, I can’t')).toBeDefined();
    expect(screen.getByText('From your message')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Choose a different answer' })).toBeDefined();
    expect(sent.map(({ path }) => path)).toEqual(['/api/guest-links/page']);

    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(await screen.findByRole('heading', { name: 'You’re down as not coming.' })).toBe(
      document.activeElement,
    );
    expect(screen.getByRole('button', { name: 'Change my answer' })).toBeDefined();
    expect(sent.at(-1)).toEqual({
      path: '/api/guest-links/reply',
      body: { token: TOKEN, answer: 'notComing', emailLink: true },
    });
  });

  it('confirms Not sure yet the same way', async () => {
    api({
      '/api/guest-links/page': [{ status: 200, body: PAGE }],
      '/api/guest-links/reply': [{ status: 200, body: answered('maybe') }],
    });
    open('maybe');

    expect(await screen.findByText('I’m not sure yet')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(
      await screen.findByRole('heading', { name: 'You’re down as not sure yet.' }),
    ).toBeDefined();
  });

  it('carries Coming on into the Yes steps, Back returning to it, and records at Send my answer', async () => {
    const { sent } = api({
      '/api/guest-links/page': [{ status: 200, body: PAGE }],
      '/api/guest-links/reply': [{ status: 200, body: answered('coming') }],
    });
    open('coming');

    fireEvent.click(await screen.findByRole('button', { name: 'Carry on' }));
    expect(screen.getByRole('heading', { name: 'Anything the kitchen must know?' })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('heading', { name: 'Confirm your answer' })).toBe(
      document.activeElement,
    );
    expect(screen.getByText('Yes, I’ll be there')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Carry on' }));
    fireEvent.click(screen.getByRole('button', { name: 'Nothing to add' }));
    expect(sent.map(({ path }) => path)).toEqual(['/api/guest-links/page']);
    fireEvent.click(screen.getByRole('button', { name: 'Send my answer' }));

    expect(await screen.findByRole('heading', { name: `See you there, ${ADAEZE}.` })).toBeDefined();
    expect(sent.at(-1)?.body).toEqual({ token: TOKEN, answer: 'coming', emailLink: true });
  });

  it('shows the answer already given, and its date, above a different one', async () => {
    api({ '/api/guest-links/page': [{ status: 200, body: answered('coming') }] });
    open('notComing');

    expect(await screen.findByText('You answered Coming on Tuesday, October 20.')).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Confirm your answer' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeDefined();
  });

  it('says the guest is already down for the answer they gave, with nothing to confirm', async () => {
    api({ '/api/guest-links/page': [{ status: 200, body: answered('coming') }] });
    open('coming');

    expect(
      await screen.findByRole('heading', { name: 'You’re already down as coming.' }),
    ).toBeDefined();
    expect(
      screen.getByText('Since Tuesday, October 20. There is nothing to confirm.'),
    ).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Confirm' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Carry on' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Choose a different answer' }));
    expect(screen.getByRole('heading', { name: 'Your new answer' })).toBe(document.activeElement);
  });

  it('tells a guest with companions, before Confirm, that they won’t be coming either', async () => {
    api({
      '/api/guest-links/page': [
        { status: 200, body: { ...PAGE, guest: { ...PAGE.guest, places: 2 } } },
      ],
    });
    open('notComing');

    expect(await screen.findByText('Your companions won’t be coming either.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeDefined();
  });

  it('keeps the answer chosen when Confirm is not sent', async () => {
    api({
      '/api/guest-links/page': [{ status: 200, body: PAGE }],
      '/api/guest-links/reply': [{ status: 500, body: { type: 'x', title: 'x', status: 500 } }],
    });
    open('notComing');

    fireEvent.click(await screen.findByRole('button', { name: 'Confirm' }));

    expect(
      await screen.findByText(
        'Your answer was not sent. Everything you chose is still here. Try again.',
      ),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: 'Confirm' })).toBe(document.activeElement);
  });

  it('records an answer chosen from Choose a different answer as one given on the page', async () => {
    const { sent } = api({
      '/api/guest-links/page': [{ status: 200, body: PAGE }],
      '/api/guest-links/reply': [{ status: 200, body: answered('maybe') }],
    });
    open('notComing');

    fireEvent.click(await screen.findByRole('button', { name: 'Choose a different answer' }));
    fireEvent.click(screen.getByRole('button', { name: 'I’m not sure yet' }));

    expect(
      await screen.findByRole('heading', { name: `Thanks for letting us know, ${ADAEZE}.` }),
    ).toBeDefined();
    expect(sent.at(-1)?.body).toEqual({ token: TOKEN, answer: 'maybe' });
  });

  it('opens with nothing chosen, and no error, for an answer that is not one of the three', async () => {
    api({ '/api/guest-links/page': [{ status: 200, body: PAGE }] });
    open('perhaps');

    expect(await screen.findByRole('button', { name: 'Sorry, I can’t' })).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'Confirm your answer' })).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows the closed page, without the link’s answer, once answers have closed', async () => {
    api({ '/api/guest-links/page': [{ status: 200, body: { ...PAGE, answersOpen: false } }] });
    open('notComing');

    await screen.findByText(ADAEZE);
    expect(screen.queryByRole('heading', { name: 'Confirm your answer' })).toBeNull();
    expect(screen.queryByText('From your message')).toBeNull();
  });

  it('opens the link-does-not-work page for an unknown token', async () => {
    api({
      '/api/guest-links/page': [
        {
          status: 404,
          body: { type: 'https://soirely.com/errors/not_found', title: 'x', status: 404 },
        },
      ],
    });
    open('coming');

    expect(await screen.findByText(/This invitation link does not work/)).toBeDefined();
  });
});

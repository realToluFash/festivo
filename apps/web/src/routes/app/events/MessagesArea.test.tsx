import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { __setSessionState, type Session } from '../../../session.ts';
import { OWNER_PERMISSIONS, membership } from '../../../test-memberships.ts';
import { routes } from '../../index.tsx';

const IRE = membership({ id: 'org_1', name: 'Ìrè Events' });

const EVENT = {
  id: 'ev_1',
  organisationId: 'org_1',
  name: 'Adaeze and Tunde',
  type: 'wedding',
  status: 'live',
  startsAt: '2030-11-15T18:00:00+01:00',
  endsAt: '2030-11-16T02:00:00+01:00',
  timeZone: 'Africa/Lagos',
  dayCount: 1,
  currency: 'NGN',
  cover: null,
  venue: null,
  arrivalNote: null,
  hosts: [],
  madeLiveAt: '2026-10-26T15:00:00+00:00',
  pausedAt: null,
  phase: 'live',
  concludedAt: null,
  createdAt: '2026-10-21T09:00:00+00:00',
  permissions: OWNER_PERMISSIONS,
};

function signedIn(): void {
  const session: Session = {
    name: 'Folake Adeyemi',
    email: 'folake@ire.events',
    verified: true,
    complete: true,
    awaiting: null,
    providers: [],
    userId: 'u_folake',
    needsOrganisation: false,
    hasPassword: true,
    organisation: IRE,
    organisations: [IRE],
    organisationCountry: null,
    timezone: null,
    waitingFor: null,
  };

  __setSessionState({ status: 'signedIn', session });
}

async function previewOn(): Promise<void> {
  const button = screen.getByRole('button', { name: 'Preview' });
  await waitFor(() => expect(button.getAttribute('aria-disabled')).toBe('false'));
  fireEvent.click(button);
}

function writeMessage(field: HTMLElement, words: string): void {
  field.textContent = words;
  fireEvent.input(field);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ETag: '"1"', 'Content-Type': 'application/json' },
  });
}

type Answer = (body: unknown) => Response | Promise<Response>;

const GUESTS = [
  { id: 'g_kwame', name: 'Kwame Mensah', flag: 'no_address', email: null, language: 'fr' },
  { id: 'g_ada', name: 'Ada Obi', flag: null, email: 'ada@example.test', language: 'en' },
];

const SENT = {
  id: 'm_1',
  subject: null,
  firstLine: 'Dinner starts at seven',
  message: 'Dinner starts at seven',
  audience: 'all',
  channels: ['email'],
  sentBy: 'Folake Adeyemi',
  sentAt: '2030-11-10T19:42:00+01:00',
  reached: 1,
  sending: false,
  deliveries: [
    {
      guestId: 'g_ada',
      name: 'Ada Obi',
      channel: 'email',
      state: 'delivered',
      reason: null,
      code: null,
      at: null,
      address: 'ada@example.test',
    },
    {
      guestId: 'g_bisi',
      name: 'Bisi Ade',
      channel: 'email',
      state: 'bounced',
      reason: null,
      code: '5.1.1',
      at: null,
      address: 'bisi@example.test',
    },
    {
      guestId: 'g_kwame',
      name: 'Kwame Mensah',
      channel: 'email',
      state: 'not_sent',
      reason: 'no_address',
      code: null,
      at: null,
      address: null,
    },
  ],
};

function onMessages(
  answers: Record<string, Answer> = {},
  event: Record<string, unknown> = {},
): { line: string; body: unknown }[] {
  const sent: { line: string; body: unknown }[] = [];
  signedIn();
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const line = `${init?.method ?? 'GET'} ${new URL(String(input)).pathname}`;
    const body: unknown = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined;
    sent.push({ line, body });
    const answer = answers[line];
    if (answer != null) return answer(body);
    if (line === 'GET /api/events/ev_1') return json({ event: { ...EVENT, ...event } });
    if (line === 'GET /api/events/ev_1/messages') return json({ messages: [] });
    if (line === 'GET /api/events/ev_1/messages/guests') return json({ guests: GUESTS });

    return json({});
  });
  render(
    <RouterProvider
      router={createMemoryRouter(routes, { initialEntries: ['/app/events/ev_1/messages'] })}
    />,
  );

  return sent;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Messages at a desk (sc-3942)', () => {
  it('says why Send refuses, every field at once, before asking the API', async () => {
    const sent = onMessages();

    fireEvent.click(await screen.findByRole('button', { name: 'New' }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Subject' }), {
      target: { value: 's'.repeat(151) },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByText('Shorten the subject to 150 characters or fewer.')).toBeTruthy();
    expect(screen.getByText('Enter a message.')).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Subject' }));
    expect(sent.some(({ line }) => line.startsWith('POST'))).toBe(false);
  });

  it('threads a follow-up under its message, and writes the next one into the same conversation', async () => {
    const FOLLOW = {
      ...SENT,
      id: 'm_2',
      firstLine: 'Parking is behind the hall',
      message: 'Parking is behind the hall',
      sentAt: '2030-11-10T20:05:00+01:00',
      sending: true,
      deliveries: [{ ...SENT.deliveries[0], state: 'queued' }],
      follows: 'm_1' as string | null,
    };
    const row = ({ message: _body, deliveries, ...summary }: typeof FOLLOW) => ({
      ...summary,
      deliveries: deliveries.length,
    });
    const sent = onMessages({
      'GET /api/events/ev_1/messages': () =>
        json({ messages: [row(FOLLOW), row({ ...FOLLOW, ...SENT, follows: null })] }),
      'GET /api/events/ev_1/messages/m_1': () => json({ message: { ...SENT, follows: null } }),
      'GET /api/events/ev_1/messages/m_2': () => json({ message: FOLLOW }),
      'POST /api/events/ev_1/messages/check': () =>
        json({ people: 3, toldByEmail: 2, cantBeTold: [] }),
      'POST /api/events/ev_1/messages': () =>
        json({ id: 'm_3', queued: { email: 2 }, notSent: { email: 1 } }, 202),
    });

    const rows = await screen.findAllByRole('button', { name: /Dinner starts at seven/ });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.getAttribute('aria-label')).toMatch(/^Dinner starts at seven, Follow-up · /);

    fireEvent.click(rows[0] as HTMLElement);
    expect(await screen.findByText('Parking is behind the hall')).toBeTruthy();
    expect(screen.getAllByText('Dinner starts at seven').length).toBeGreaterThan(0);

    const field = screen.getByRole('textbox', { name: 'Write a follow-up' });
    const followLine = /^A follow-up goes to the same \d+ guests?, under the first message/;
    expect(screen.getAllByText(followLine)).toHaveLength(2);
    expect(screen.queryByText('To')).toBeNull();
    fireEvent.focus(field);
    expect(screen.queryByRole('textbox', { name: 'Message' })).toBeNull();

    fireEvent.change(field, { target: { value: 'G' } });
    const body = await screen.findByRole('textbox', { name: 'Message' });
    expect(body.textContent).toBe('G');
    expect(screen.queryByRole('textbox', { name: 'Subject' })).toBeNull();
    expect(screen.queryByRole('button', { name: /All guests/ })).toBeNull();
    expect(screen.getByText(followLine)).toBeTruthy();

    writeMessage(body, 'Gates open at six');
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    fireEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Send to 3 people',
      }),
    );

    await waitFor(() =>
      expect(sent.find(({ line }) => line === 'POST /api/events/ev_1/messages')?.body).toEqual({
        audience: 'all',
        subject: null,
        message: 'Gates open at six',
        follows: 'm_1',
      }),
    );
    expect(sent.find(({ line }) => line === 'POST /api/events/ev_1/messages/check')?.body).toEqual({
      audience: 'all',
      follows: 'm_1',
    });
  });

  it('checks, then sends to all guests, and opens what went', async () => {
    const sent = onMessages({
      'POST /api/events/ev_1/messages/check': () =>
        json({
          people: 2,
          toldByEmail: 1,
          cantBeTold: [{ guestId: 'g_kwame', name: 'Kwame Mensah', reason: 'no_address' }],
        }),
      'POST /api/events/ev_1/messages': () =>
        json({ id: 'm_1', queued: { email: 1 }, notSent: { email: 1 } }, 202),
      'GET /api/events/ev_1/messages/m_1': () => json({ message: SENT }),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'New' }));
    writeMessage(screen.getByRole('textbox', { name: 'Message' }), 'Dinner starts at seven');
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    const check = await screen.findByRole('alertdialog');
    expect(within(check).getByText('Sending to 2 people cannot be undone.')).toBeTruthy();
    expect(within(check).getByText('Kwame Mensah · No email address')).toBeTruthy();

    fireEvent.click(within(check).getByRole('button', { name: 'Send to 2 people' }));

    expect(await screen.findByRole('heading', { name: 'Dinner starts at seven' })).toBeTruthy();
    expect(sent.find(({ line }) => line === 'POST /api/events/ev_1/messages')?.body).toEqual({
      audience: 'all',
      subject: null,
      message: 'Dinner starts at seven',
      follows: null,
    });

    fireEvent.click(screen.getByRole('button', { name: /Who it reached/ }));
    const kwame = (await screen.findByText('Kwame Mensah')).closest('li');
    expect(kwame?.textContent).toContain('Not sent · No email address');
    expect(screen.getByText('Bisi Ade').closest('li')?.textContent).toContain(
      'Bounced · This address doesn’t exist (5.1.1)',
    );
  });

  it('refuses Done with nobody chosen, under To', async () => {
    onMessages();

    fireEvent.click(await screen.findByRole('button', { name: 'New' }));
    fireEvent.click(screen.getByRole('button', { name: /All guests/ }));
    fireEvent.click(screen.getByRole('radio', { name: 'Choose guests' }));
    await screen.findByRole('checkbox', { name: 'Ada Obi' });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    await waitFor(() => expect(screen.getByText('Choose at least one guest.')).toBeTruthy());
  });

  it('keeps New off on a Draft and says why', async () => {
    onMessages({}, { phase: 'draft', status: 'draft' });

    const add = await screen.findByRole('button', { name: 'New' });
    expect(add.getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByTestId('messages-closed').textContent).toBe(
      'This event is a draft. Make it live to write to your guests.',
    );
  });

  it('is refused without messages.read, and hidden from the nav', async () => {
    onMessages(
      {},
      { permissions: OWNER_PERMISSIONS.filter((one) => !one.startsWith('messages.')) },
    );

    expect(await screen.findByRole('heading', { level: 1 })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Messages' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'New' })).toBeNull();
  });
});

describe('Write it once (sc-3960)', () => {
  const ADA_PREVIEW = {
    guest: {
      id: 'g_ada',
      name: 'Ada Obi',
      greetAs: 'Auntie Ada',
      language: 'en',
      languageFrom: 'host',
    },
    notices: [
      {
        channel: 'email',
        subject: 'Adaeze and Tunde: a message from Ìrè Events',
        text: 'Dear Auntie Ada,',
      },
    ],
  };

  it('puts a token where Insert is pressed, and Send carries it as a token, not as braces', async () => {
    const sent = onMessages({
      'POST /api/events/ev_1/messages/check': () =>
        json({ people: 2, toldByEmail: 1, cantBeTold: [] }),
      'POST /api/events/ev_1/messages': () => json({ id: 'm_1', queued: { email: 1 } }, 202),
      'GET /api/events/ev_1/messages/m_1': () => json({ message: SENT }),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'New' }));
    const field = screen.getByRole('textbox', { name: 'Message' });
    writeMessage(field, 'Dear {name}, ');
    fireEvent.click(screen.getByRole('button', { name: 'Insert' }));
    const menu = screen.getByRole('menu', { name: 'Insert' });
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((one) => one.getAttribute('aria-label')),
    ).toEqual(['Greeting', 'Event', 'Date', 'Hosts']);
    fireEvent.click(within(menu).getByRole('menuitem', { name: 'Greeting' }));

    expect(screen.queryByRole('menu')).toBeNull();
    expect(
      within(field).getByRole('img', { name: 'Greeting, filled in for each guest' }),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    fireEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Send to 2 people',
      }),
    );

    await waitFor(() =>
      expect(
        sent.find(({ line }) => line === 'POST /api/events/ev_1/messages')?.body,
      ).toMatchObject({
        message: 'Dear {name}, \uE000greeting\uE001',
      }),
    );
  });

  it('previews as the first guest in To, A to Z, then as another, with the lines that say why', async () => {
    const sent = onMessages({
      'GET /api/events/ev_1/messages/preview/g_ada': () => json(ADA_PREVIEW),
      'GET /api/events/ev_1/messages/preview/g_kwame': () =>
        json({
          guest: {
            id: 'g_kwame',
            name: 'Kwame Mensah',
            greetAs: null,
            language: 'fr',
            languageFrom: 'chose',
          },
          notices: [],
        }),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'New' }));
    writeMessage(screen.getByRole('textbox', { name: 'Message' }), 'Bring a {plus one}');
    await previewOn();

    expect(await screen.findByRole('heading', { name: 'As Ada Obi will see it' })).toBeTruthy();
    expect(await screen.findByText('In English, the language you set for them.')).toBeTruthy();
    expect(screen.getByText('Bring a {plus one}', { selector: 'blockquote' })).toBeTruthy();
    expect(
      screen.getByText(
        'Anything you type in braces shows exactly as typed. To fill something in for each guest, use Insert.',
      ),
    ).toBeTruthy();
    expect(
      screen.getByText('Nothing to fill in, so every guest gets exactly these words.'),
    ).toBeTruthy();
    expect(screen.getByText('Adaeze and Tunde: a message from Ìrè Events')).toBeTruthy();
    expect(screen.queryByText(/^Greeted as/)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /Preview as/ }));
    const options = screen.getAllByRole('option');
    expect(options.map((one) => one.textContent)).toEqual([
      'Ada Obi · English',
      'Kwame Mensah · French',
    ]);
    fireEvent.click(options[1] as HTMLElement);

    expect(
      await screen.findByRole('heading', { name: 'As Kwame Mensah will see it' }),
    ).toBeTruthy();
    expect(
      await screen.findByText('In French, the language they chose on their page.'),
    ).toBeTruthy();
    expect(sent.some(({ line }) => line === 'GET /api/events/ev_1/messages/preview/g_kwame')).toBe(
      true,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(screen.getByRole('textbox', { name: 'Message' }).textContent).toBe('Bring a {plus one}');
  });

  it('says who the greeting reaches as, and fills it in on their page', async () => {
    onMessages({ 'GET /api/events/ev_1/messages/preview/g_ada': () => json(ADA_PREVIEW) });

    fireEvent.click(await screen.findByRole('button', { name: 'New' }));
    const field = screen.getByRole('textbox', { name: 'Message' });
    writeMessage(field, 'Hello ');
    fireEvent.click(screen.getByRole('button', { name: 'Insert' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Greeting' }));
    await previewOn();

    expect(await screen.findByText('Greeted as “Auntie Ada”, their Greet as.')).toBeTruthy();
    expect(screen.getByText('Hello Auntie Ada', { selector: 'blockquote' })).toBeTruthy();
  });

  it('says it could not fill it in for Ada Obi, and Try again fills it in', async () => {
    let tries = 0;
    onMessages({
      'GET /api/events/ev_1/messages/preview/g_ada': () =>
        (tries += 1) === 1 ? json({ error: { code: 'server_error' } }, 500) : json(ADA_PREVIEW),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'New' }));
    writeMessage(screen.getByRole('textbox', { name: 'Message' }), 'Hello');
    await previewOn();

    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toContain('We could not fill it in for Ada Obi.');
    expect(alert.textContent).toContain('Check your connection and try again.');
    expect(screen.getByRole('heading', { name: 'As Ada Obi will see it' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Preview as/ })).toBeTruthy();

    fireEvent.click(within(alert).getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('In English, the language you set for them.')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(tries).toBe(2);
  });

  it('drops one who is no longer a guest from Preview as, and fills it in for the first left', async () => {
    onMessages({
      'GET /api/events/ev_1/messages/preview/g_ada': () =>
        json({ error: { code: 'not_found' } }, 404),
      'GET /api/events/ev_1/messages/preview/g_kwame': () =>
        json({
          guest: {
            id: 'g_kwame',
            name: 'Kwame Mensah',
            greetAs: null,
            language: 'fr',
            languageFrom: 'chose',
          },
          notices: [],
        }),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'New' }));
    writeMessage(screen.getByRole('textbox', { name: 'Message' }), 'Hello');
    await previewOn();

    expect(
      await screen.findByRole('heading', { name: 'As Kwame Mensah will see it' }),
    ).toBeTruthy();
    const line = screen.getByText(
      'Ada Obi is no longer a guest, so it is filled in for Kwame Mensah instead.',
    );
    expect(line.closest('[role=status]')).not.toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(
      await screen.findByText('In French, the language they chose on their page.'),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /Preview as/ }));
    expect(screen.getAllByRole('option').map((one) => one.textContent)).toEqual([
      'Kwame Mensah · French',
    ]);
  });

  it('closes the preview when nobody is left, and says why beside Preview', async () => {
    onMessages({
      'GET /api/events/ev_1/messages/guests': () => json({ guests: [GUESTS[1]] }),
      'GET /api/events/ev_1/messages/preview/g_ada': () =>
        json({ error: { code: 'not_found' } }, 404),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'New' }));
    writeMessage(screen.getByRole('textbox', { name: 'Message' }), 'Hello');
    await previewOn();

    expect(
      await screen.findByText('Ada Obi is no longer a guest, so there is nobody to preview it as.'),
    ).toBeTruthy();
    expect(screen.queryByRole('heading', { name: /will see it$/ })).toBeNull();
    const preview = screen.getByRole('button', { name: 'Preview' });
    expect(preview.getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByRole('textbox', { name: 'Message' }).textContent).toBe('Hello');
  });

  it('offers no preview while nobody is in To, and says why', async () => {
    onMessages({ 'GET /api/events/ev_1/messages/guests': () => json({ guests: [] }) });

    fireEvent.click(await screen.findByRole('button', { name: 'New' }));
    const preview = screen.getByRole('button', { name: 'Preview' });
    expect(
      await screen.findByText('No guests chosen yet, so there is nobody to preview it as.'),
    ).toBeTruthy();
    expect(preview.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(preview);
    expect(screen.queryByRole('heading', { name: /will see it$/ })).toBeNull();
  });
});

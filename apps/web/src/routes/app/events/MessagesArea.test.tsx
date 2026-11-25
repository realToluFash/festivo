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

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ETag: '"1"', 'Content-Type': 'application/json' },
  });
}

type Answer = (body: unknown) => Response | Promise<Response>;

const GUESTS = [
  { id: 'g_ada', name: 'Ada Obi', flag: null, email: 'ada@example.test' },
  { id: 'g_kwame', name: 'Kwame Mensah', flag: 'no_address', email: null },
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
    expect((body as HTMLTextAreaElement).value).toBe('G');
    expect(screen.queryByRole('textbox', { name: 'Subject' })).toBeNull();
    expect(screen.queryByRole('button', { name: /All guests/ })).toBeNull();
    expect(screen.getByText(followLine)).toBeTruthy();

    fireEvent.change(body, { target: { value: 'Gates open at six' } });
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
    fireEvent.change(screen.getByRole('textbox', { name: 'Message' }), {
      target: { value: 'Dinner starts at seven' },
    });
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

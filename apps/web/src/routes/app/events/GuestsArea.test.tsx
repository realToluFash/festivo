import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { __setConfig, config } from '../../../config.ts';
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
  startsAt: '2030-11-14T16:00:00+01:00',
  endsAt: '2030-11-15T02:00:00+01:00',
  timeZone: 'Africa/Lagos',
  dayCount: 2,
  currency: 'NGN',
  cover: null,
  venue: null,
  hosts: [],
  madeLiveAt: '2026-10-26T15:00:00+00:00',
  pausedAt: null,
  phase: 'live',
  concludedAt: null,
  createdAt: '2026-10-21T09:00:00+00:00',
  permissions: OWNER_PERMISSIONS,
};

function guest(id: string, fullName: string, more: Record<string, unknown> = {}) {
  return {
    id,
    fullName,
    email: null,
    mobile: null,
    reply: 'noReply',
    companions: [] as { id: string; fullName: string | null; state: string }[],
    ...more,
  };
}

function listOf(guests: ReturnType<typeof guest>[]) {
  const companions = guests.reduce((sum, one) => sum + one.companions.length, 0);

  return {
    guests,
    counts: { people: guests.length + companions, guests: guests.length, companions },
  };
}

const NGOZI = guest('g_1', 'Ngozi Eze', {
  email: 'ngozi@example.com',
  mobile: '+2348035550142',
  reply: 'coming',
  companions: [
    { id: 'c_1', fullName: 'Obi Eze', state: 'coming' },
    { id: 'c_2', fullName: null, state: 'coming' },
    { id: 'c_3', fullName: null, state: 'coming' },
  ],
});
const AMAKA = guest('g_2', 'Chief Amaka Obi', { reply: 'maybe' });

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
    organisationCountry: 'GB',
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

function problem(code: string, status: number, more: Record<string, unknown> = {}): Response {
  return new Response(
    JSON.stringify({ type: `https://soirely.com/errors/${code}`, title: code, status, ...more }),
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );
}

type Answer = (body: unknown) => Response | Promise<Response>;

async function onGuests(
  answers: Record<string, Answer>,
  permissions: string[] = OWNER_PERMISSIONS,
): Promise<{ line: string; body: unknown }[]> {
  const sent: { line: string; body: unknown }[] = [];

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const line = `${init?.method ?? 'GET'} ${new URL(String(input)).pathname}`;
    const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : null;
    sent.push({ line, body });

    const answer = answers[line];
    if (answer != null) return answer(body);
    if (line === 'GET /api/events/ev_1') return json({ event: { ...EVENT, permissions } });

    return json({});
  });
  render(
    <RouterProvider
      router={createMemoryRouter(routes, { initialEntries: ['/app/events/ev_1/guests'] })}
    />,
  );

  return sent;
}

function field(name: string | RegExp): HTMLInputElement {
  return screen.getByRole('textbox', { name }) as HTMLInputElement;
}

const EMAIL = /^Email address/u;

function type(name: string | RegExp, value: string): void {
  fireEvent.change(field(name), { target: { value } });
}

function form(): HTMLElement {
  return screen.getByRole('region', { name: 'Add guest' });
}

async function opened(answers: Record<string, Answer>) {
  signedIn();
  const sent = await onGuests({
    'GET /api/events/ev_1/guests': () => json(listOf([NGOZI])),
    ...answers,
  });
  fireEvent.click(await screen.findByRole('button', { name: 'Add guest' }));
  await waitFor(() => expect(document.activeElement).toBe(field('Full name')));

  return sent;
}

function addButton(): HTMLElement {
  return within(form()).getAllByRole('button', { name: 'Add guest' }).at(-1)!;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Guests (sc-1468)', () => {
  it('lists every guest by name, each companion under their host, under the card’s count', async () => {
    signedIn();
    await onGuests({ 'GET /api/events/ev_1/guests': () => json(listOf([NGOZI, AMAKA])) });

    expect(await screen.findByRole('heading', { level: 1, name: 'Guests' })).toBeDefined();
    expect(await screen.findByText('5 on the list')).toBeDefined();
    const rows = within(screen.getByRole('region', { name: 'Guests' })).getAllByRole('listitem');

    expect(rows.map((row) => row.textContent)).toEqual([
      'Chief Amaka ObiNot sure yet',
      'Ngozi EzeComing · ngozi@example.com · +234 803 555 0142',
      'Obi EzeComing',
      'Guest of Ngozi EzeComing',
      'Guest of Ngozi Eze · 2Coming',
    ]);
    expect(rows[2]?.className).toBe('is-companion');
  });

  it('says No guests yet with Add guest on the event’s cover, and no count', async () => {
    signedIn();
    await onGuests({ 'GET /api/events/ev_1/guests': () => json(listOf([])) });

    const cover = (await screen.findByText('No guests yet')).closest('section') as HTMLElement;
    expect(cover.className).toMatch(/\bev-card today-cover is-\S+ gs-card is-page\b/u);
    expect(
      within(cover).getByRole('button', { name: 'Add guest' }).closest('.ev-card-foot'),
    ).not.toBeNull();
    expect(screen.queryByText(/on the list/u)).toBeNull();
  });

  it('says No guests yet alone without guests.manage', async () => {
    signedIn();
    await onGuests(
      { 'GET /api/events/ev_1/guests': () => json(listOf([])) },
      OWNER_PERMISSIONS.filter((one) => one !== 'guests.manage'),
    );

    expect(await screen.findByText('No guests yet')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Add guest' })).toBeNull();
  });

  it('is not found without guests.read', async () => {
    signedIn();
    await onGuests(
      {},
      OWNER_PERMISSIONS.filter((one) => one !== 'guests.read'),
    );

    expect(await screen.findByRole('heading', { level: 1, name: /not/iu })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Add guest' })).toBeNull();
  });

  it('adds a guest with a companion, clears the form and lists them at once', async () => {
    const sent = await opened({
      'POST /api/events/ev_1/guests': () =>
        json(
          {
            guest: guest('g_9', 'Bimpe Adeyemi', {
              email: 'bimpe@example.com',
              mobile: '+447700900123',
              companions: [{ id: 'c_9', fullName: null, state: 'held' }],
            }),
          },
          201,
        ),
    });

    type('Full name', '  Bimpe Adeyemi ');
    type(EMAIL, 'bimpe@example.com');
    fireEvent.change(screen.getByRole('combobox', { name: 'Country' }), {
      target: { value: 'GB' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: /^Mobile number/u }), {
      target: { value: '07700 900123' },
    });
    fireEvent.click(within(form()).getByRole('button', { name: 'Add a companion' }));
    fireEvent.click(addButton());

    expect(await within(form()).findByText('Bimpe Adeyemi added.')).toBeDefined();
    expect(sent.find((one) => one.line === 'POST /api/events/ev_1/guests')?.body).toEqual({
      fullName: 'Bimpe Adeyemi',
      email: 'bimpe@example.com',
      mobile: { countryCode: 'GB', number: '07700 900123' },
      companions: [{ fullName: null }],
    });
    expect(field('Full name').value).toBe('');
    expect(within(form()).getByText('None yet · 0 of 10')).toBeDefined();
    await waitFor(() => expect(document.activeElement).toBe(field('Full name')));
    expect(screen.getByText('6 on the list')).toBeDefined();
    expect(screen.getByText('Bimpe Adeyemi')).toBeDefined();
    expect(screen.getByText('No reply · bimpe@example.com · +44 7700 900123')).toBeDefined();
    expect(
      within(screen.getByRole('region', { name: 'Guests' }))
        .getAllByRole('listitem')
        .map((row) => row.textContent),
    ).toContain('Guest of Bimpe AdeyemiHeld');
  });

  it('sends nothing for a blank name and says every problem at once, focus on the first', async () => {
    const sent = await opened({});

    type('Full name', '   ');
    type(EMAIL, 'bimpe@');
    fireEvent.click(addButton());

    expect(within(form()).getByText('Enter their full name.')).toBeDefined();
    expect(
      within(form()).getByText(
        'That does not look like an email address. Check it has an @ and a domain.',
      ),
    ).toBeDefined();
    await waitFor(() => expect(document.activeElement).toBe(field('Full name')));
    expect(sent.some((one) => one.line === 'POST /api/events/ev_1/guests')).toBe(false);
  });

  it('refuses a number too short for its country and a name over 200', async () => {
    await opened({});

    type('Full name', 'A'.repeat(201));
    fireEvent.change(screen.getByRole('combobox', { name: 'Country' }), {
      target: { value: 'GB' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: /^Mobile number/u }), {
      target: { value: '0770' },
    });
    fireEvent.click(addButton());

    expect(within(form()).getByText('Shorten the name to 200 characters or fewer.')).toBeDefined();
    expect(within(form()).getByText(/^That number looks too short for/u)).toBeDefined();
  });

  it('asks about a name already on the list, ignoring case and accents, and adds it anyway', async () => {
    const sent = await opened({
      'POST /api/events/ev_1/guests': () => json({ guest: guest('g_9', 'NGÓZI eze') }, 201),
    });

    type('Full name', 'NGÓZI eze');
    fireEvent.click(addButton());

    const ask = await within(form()).findByRole('alert');
    expect(
      within(ask).getByRole('heading', { name: 'NGÓZI eze is already on the list' }),
    ).toBeDefined();
    expect(sent.some((one) => one.line === 'POST /api/events/ev_1/guests')).toBe(false);

    fireEvent.click(within(ask).getByRole('button', { name: 'Add anyway' }));

    expect(await within(form()).findByText('NGÓZI eze added.')).toBeDefined();
    expect(sent.find((one) => one.line === 'POST /api/events/ev_1/guests')?.body).toMatchObject({
      fullName: 'NGÓZI eze',
      allowDuplicate: true,
    });
  });

  it('asks the same when the server answers guest_already_listed', async () => {
    await opened({
      'POST /api/events/ev_1/guests': () => problem('guest_already_listed', 409),
    });

    type('Full name', 'Kwame Mensah');
    fireEvent.click(addButton());

    expect(
      await within(form()).findByRole('heading', { name: 'Kwame Mensah is already on the list' }),
    ).toBeDefined();
    fireEvent.click(within(form()).getByRole('button', { name: 'Cancel' }));
    expect(within(form()).queryByRole('heading', { name: /already on the list/u })).toBeNull();
  });

  it('puts the server’s refusals beside their fields', async () => {
    await opened({
      'POST /api/events/ev_1/guests': () =>
        problem('validation_failed', 422, {
          violations: [{ propertyPath: 'email', message: 'Bad', code: 'x' }],
        }),
    });

    type('Full name', 'Kwame Mensah');
    type(EMAIL, 'kwame@example.com');
    fireEvent.click(addButton());

    expect(
      await within(form()).findByText(
        'That does not look like an email address. Check it has an @ and a domain.',
      ),
    ).toBeDefined();
    await waitFor(() => expect(document.activeElement).toBe(field(EMAIL)));
  });

  it('keeps everything typed when the save fails', async () => {
    await opened({
      'POST /api/events/ev_1/guests': () => problem('internal_error', 500),
    });

    type('Full name', 'Kwame Mensah');
    fireEvent.click(addButton());

    expect(
      await within(form()).findByText('Not added. Nothing was saved. Try again.'),
    ).toBeDefined();
    expect(field('Full name').value).toBe('Kwame Mensah');
  });

  it('closes on Escape, focus back on Add guest', async () => {
    await opened({});

    fireEvent.keyDown(field('Full name'), { key: 'Escape' });

    expect(screen.queryByRole('region', { name: 'Add guest' })).toBeNull();
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Add guest' })),
    );
  });

  it('stops at 10 companions', async () => {
    await opened({});

    for (let at = 0; at < 10; at += 1)
      fireEvent.click(within(form()).getByRole('button', { name: 'Add a companion' }));

    expect(within(form()).queryByRole('button', { name: 'Add a companion' })).toBeNull();
    expect(
      within(form()).getByText('10 companions is the most one guest can bring.'),
    ).toBeDefined();
    expect(within(form()).getByText('10 of 10')).toBeDefined();
  });
});

class StubSource {
  static readonly CLOSED = 2;
  static made: StubSource[] = [];

  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((message: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;

  readonly url: string;

  constructor(url: string | URL) {
    this.url = String(url);
    StubSource.made.push(this);
  }

  close(): void {
    this.readyState = StubSource.CLOSED;
  }

  publish(data: unknown): void {
    act(() => this.onmessage?.({ data: JSON.stringify(data) }));
  }
}

describe('Guests, live (sc-1468)', () => {
  const before = config();

  beforeEach(() => {
    __setConfig({ ...before, mercureUrl: 'http://hub.test/.well-known/mercure' });
    StubSource.made = [];
    vi.stubGlobal('EventSource', StubSource);
  });

  afterEach(() => {
    __setConfig(before);
    vi.unstubAllGlobals();
  });

  it('shows a guest another session added, from the list published on the event’s topic', async () => {
    signedIn();
    const hub = () =>
      json({ token: 'tok', expiresAt: new Date(Date.now() + 3_600_000).toISOString() });
    await onGuests({
      'GET /api/events/ev_1/guests': () => json(listOf([AMAKA])),
      'POST /api/events/ev_1/guests/subscriptions': hub,
      'POST /api/realtime/subscriptions': hub,
    });
    await screen.findByText('Chief Amaka Obi');
    const guests = () => StubSource.made.filter((one) => one.url.includes('guests'));
    await waitFor(() => expect(guests()).toHaveLength(1));
    const source = guests()[0]!;

    expect(source.url).toContain('topic=events%2Fev_1%2Fguests');
    source.publish(listOf([AMAKA, guest('g_3', 'Tomás Ferreira')]));

    expect(await screen.findByText('Tomás Ferreira')).toBeDefined();
    expect(screen.getByText('2 on the list')).toBeDefined();
  });
});

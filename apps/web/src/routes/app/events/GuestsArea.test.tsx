import { readFileSync } from 'node:fs';
import { join } from 'node:path';

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

  it('asks about a name a companion already has (Decided, 13 Nov)', async () => {
    const sent = await opened({});

    type('Full name', 'OBI EZE');
    fireEvent.click(addButton());

    expect(
      await within(form()).findByRole('heading', { name: 'OBI EZE is already on the list' }),
    ).toBeDefined();
    expect(sent.some((one) => one.line === 'POST /api/events/ev_1/guests')).toBe(false);
  });

  it('never takes an unnamed companion for a name that keys to nothing (Decided, 13 Nov)', async () => {
    const sent = await opened({
      'POST /api/events/ev_1/guests': () => json({ guest: guest('g_9', '\u0301') }, 201),
    });

    type('Full name', '\u0301');
    fireEvent.click(addButton());

    await waitFor(() =>
      expect(sent.find((one) => one.line === 'POST /api/events/ev_1/guests')?.body).toEqual(
        expect.not.objectContaining({ allowDuplicate: true }),
      ),
    );
    expect(within(form()).queryByRole('heading', { name: /is already on the list$/u })).toBeNull();
  });

  it('says a number the server refuses as not a mobile in the server’s words, not as too short', async () => {
    await opened({
      'POST /api/events/ev_1/guests': () =>
        problem('validation_failed', 422, {
          violations: [
            {
              propertyPath: 'mobile',
              message: 'That is not a mobile number for United Kingdom. Check it and try again.',
              code: 'phone_invalid',
            },
          ],
        }),
    });

    type('Full name', 'Kwame Mensah');
    fireEvent.change(screen.getByRole('combobox', { name: 'Country' }), {
      target: { value: 'GB' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: /^Mobile number/u }), {
      target: { value: '07700900123' },
    });
    fireEvent.click(addButton());

    expect(
      await within(form()).findByText(
        'That is not a mobile number for United Kingdom. Check it and try again.',
      ),
    ).toBeDefined();
    expect(within(form()).queryByText(/too short/u)).toBeNull();
  });

  it('answers a deleted event as one that never existed, under the organisation’s sidebar', async () => {
    signedIn();
    await onGuests({ 'GET /api/events/ev_1': () => problem('not_found', 404) });

    const heading = await screen.findByRole('heading', {
      level: 1,
      name: 'This event is not available',
    });
    await waitFor(() => expect(document.activeElement).toBe(heading));
    expect(screen.queryByRole('navigation', { name: 'Event' })).toBeNull();
    expect(screen.queryByRole('link', { name: /Event$/u })).toBeNull();
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

  it('names each Remove by the companion, or as the host’s guest while it has no name (sc-43267)', async () => {
    await opened({});

    fireEvent.click(within(form()).getByRole('button', { name: 'Add a companion' }));
    expect(
      within(form()).getByRole('button', { name: 'Remove Companion’s full name, 1 of 1' }),
    ).toBeDefined();

    type('Full name', 'Ifeoluwa Bankole');
    fireEvent.click(within(form()).getByRole('button', { name: 'Add a companion' }));
    fireEvent.click(within(form()).getByRole('button', { name: 'Add a companion' }));
    type('Companion’s full name, 3 of 3', 'Tolu Bankole');

    expect(
      within(form())
        .getAllByRole('button', { name: /^Remove /u })
        .map((button) => button.getAttribute('aria-label')),
    ).toEqual([
      'Remove Ifeoluwa Bankole’s guest',
      'Remove Ifeoluwa Bankole’s guest · 2',
      'Remove Tolu Bankole',
    ]);
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

  const hub = () =>
    json({ token: 'tok', expiresAt: new Date(Date.now() + 3_600_000).toISOString() });

  async function live(list: () => unknown, permissions?: string[]) {
    signedIn();
    const sent = await onGuests(
      {
        'GET /api/events/ev_1/guests': () => json(list()),
        'POST /api/events/ev_1/guests/subscriptions': hub,
        'POST /api/realtime/subscriptions': hub,
      },
      permissions,
    );
    await screen.findByText('Chief Amaka Obi');
    const guests = () => StubSource.made.filter((one) => one.url.includes('guests'));
    await waitFor(() => expect(guests()).toHaveLength(1));

    return { sent, source: guests()[0]! };
  }

  it('shows a guest another session added, from the list published on the event’s topic', async () => {
    const { source } = await live(
      () => listOf([AMAKA]),
      OWNER_PERMISSIONS.filter((one) => one !== 'guests.manage'),
    );

    expect(source.url).toContain('topic=events%2Fev_1%2Fguests');
    source.publish(listOf([AMAKA, guest('g_3', 'Tomás Ferreira')]));

    expect(await screen.findByText('Tomás Ferreira')).toBeDefined();
    expect(screen.getByText('2 on the list')).toBeDefined();
  });

  it('reads the list again for someone who manages guests, since the published one has no contacts (sc-3773)', async () => {
    let list = listOf([AMAKA]);
    const { sent, source } = await live(() => list);
    const reads = () => sent.filter((one) => one.line === 'GET /api/events/ev_1/guests').length;
    const before = reads();

    list = listOf([AMAKA, guest('g_3', 'Tomás Ferreira', { email: 'tomas@example.com' })]);
    source.publish(listOf([AMAKA, guest('g_3', 'Tomás Ferreira')]));

    expect(await screen.findByText('No reply · tomas@example.com')).toBeDefined();
    expect(reads()).toBe(before + 1);
  });
});

function tagged(body: unknown, tag: string, status = 200): Response {
  return new Response(JSON.stringify({ guest: body }), {
    status,
    headers: { ETag: tag, 'Content-Type': 'application/json' },
  });
}

const DETAILS = {
  ...NGOZI,
  companions: [{ id: 'c_1', fullName: 'Obi Eze', state: 'coming' }],
  added: { at: '2026-09-14T10:00:00+00:00', by: 'Kemi Bankole' },
};

function column(): HTMLElement {
  return screen
    .getAllByRole('region', { name: 'Ngozi Eze' })
    .find((one) => one.classList.contains('gs-column'))!;
}

async function openNgozi(answers: Record<string, Answer> = {}, permissions?: string[]) {
  signedIn();
  const sent = await onGuests(
    {
      'GET /api/events/ev_1/guests': () => json(listOf([NGOZI, AMAKA])),
      'GET /api/events/ev_1/guests/g_1': () => tagged(DETAILS, '"1"'),
      ...answers,
    },
    permissions,
  );
  fireEvent.click(await screen.findByRole('link', { name: /^Ngozi Eze/u }));
  await waitFor(() =>
    expect(document.activeElement).toBe(
      screen.getByRole('heading', { level: 2, name: 'Ngozi Eze' }),
    ),
  );

  return sent;
}

async function editNgozi(answers: Record<string, Answer> = {}) {
  const sent = await openNgozi(answers);
  fireEvent.click(within(column()).getByRole('button', { name: 'Edit' }));
  await waitFor(() => expect(document.activeElement).toBe(field('Full name')));

  return sent;
}

function puts(sent: { line: string; body: unknown }[]) {
  return sent.filter((one) => one.line === 'PUT /api/events/ev_1/guests/g_1');
}

describe('A guest’s details, and correcting them (sc-3773)', () => {
  it('opens a guest beside the list: their reply, contacts, companions and who added them', async () => {
    await openNgozi();

    const row = screen.getByRole('link', { name: /^Ngozi Eze/u });
    expect(row.getAttribute('aria-current')).toBe('true');
    expect(row.getAttribute('href')).toBe('/app/events/ev_1/guests?guest=g_1');
    const details = within(column());
    expect(details.getByText('Coming')).toBeDefined();
    expect(details.getByText('ngozi@example.com')).toBeDefined();
    expect(details.getByText('+234 803 555 0142')).toBeDefined();
    expect(details.getByText('Obi Eze')).toBeDefined();
    expect(details.getByText('Companion · Coming')).toBeDefined();
    expect(details.getByText('Sep 14 by Kemi Bankole')).toBeDefined();
    expect(details.getByRole('button', { name: 'Edit' })).toBeDefined();
  });

  it('shows no contact details and no Edit with guests.read alone', async () => {
    const { email: _email, mobile: _mobile, ...withoutContacts } = DETAILS;
    await openNgozi(
      { 'GET /api/events/ev_1/guests/g_1': () => tagged(withoutContacts, '"1"') },
      OWNER_PERMISSIONS.filter((one) => one !== 'guests.manage'),
    );

    const details = within(column());
    expect(details.queryByText('Email address')).toBeNull();
    expect(details.queryByText('Mobile number')).toBeNull();
    expect(details.queryByText('Added')).toBeNull();
    expect(details.queryByRole('button', { name: 'Edit' })).toBeNull();
    expect(details.getByText('Obi Eze')).toBeDefined();
  });

  it('closes on Escape and gives the focus back to the guest’s row', async () => {
    await openNgozi();

    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });

    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('link', { name: /^Ngozi Eze/u })),
    );
    expect(screen.getByText('Pick a guest to see their details, or add one.')).toBeDefined();
  });

  it('sends nothing when Save changes nothing, and goes back to the details', async () => {
    const sent = await editNgozi();

    fireEvent.click(within(column()).getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(document.activeElement).toBe(within(column()).getByRole('button', { name: 'Edit' })),
    );
    expect(puts(sent)).toHaveLength(0);
  });

  it('saves against the version it read, and says Saved', async () => {
    const saved = { ...DETAILS, fullName: 'Ngozi Eze-Okafor' };
    const sent = await editNgozi({
      'PUT /api/events/ev_1/guests/g_1': () => tagged(saved, '"2"'),
    });
    let ifMatch: string | null = null;
    const fetch = vi.mocked(globalThis.fetch);
    const answer = fetch.getMockImplementation()!;
    fetch.mockImplementation(async (input, init) => {
      if (init?.method === 'PUT') ifMatch = new Headers(init.headers).get('If-Match');
      return answer(input, init);
    });

    type('Full name', 'Ngozi Eze-Okafor');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Saved')).toBeDefined();
    expect(ifMatch).toBe('"1"');
    expect(puts(sent)[0]?.body).toEqual({
      fullName: 'Ngozi Eze-Okafor',
      email: 'ngozi@example.com',
      mobile: { countryCode: 'NG', number: '0803 555 0142' },
      companions: [{ id: 'c_1', fullName: 'Obi Eze' }],
    });
    expect(screen.getByRole('heading', { level: 2, name: 'Ngozi Eze-Okafor' })).toBeDefined();
  });

  it('refuses a blank name before sending, as Add guest does', async () => {
    const sent = await editNgozi();

    type('Full name', '  ');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Enter their full name.')).toBeDefined();
    expect(document.activeElement).toBe(field('Full name'));
    expect(puts(sent)).toHaveLength(0);
  });

  it('asks before saving a name already on the list', async () => {
    const sent = await editNgozi();

    type('Full name', 'chief amaka obi');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('chief amaka obi is already on the list')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Save anyway' })).toBeDefined();
    expect(puts(sent)).toHaveLength(0);
  });

  it('shows a colleague’s change on a 412, only the fields that differ, and holds Save until one is chosen', async () => {
    let reads = 0;
    let saves = 0;
    const theirs = { ...DETAILS, mobile: '+2348035550199' };
    const sent = await editNgozi({
      'GET /api/events/ev_1/guests/g_1': () => {
        reads += 1;
        return reads === 1 ? tagged(DETAILS, '"1"') : tagged(theirs, '"2"');
      },
      'PUT /api/events/ev_1/guests/g_1': () => {
        saves += 1;
        return saves === 1
          ? problem('precondition_failed', 412)
          : tagged({ ...theirs, email: 'ngozi.eze@example.com' }, '"3"');
      },
    });
    const ifMatches: (string | null)[] = [];
    const fetch = vi.mocked(globalThis.fetch);
    const answer = fetch.getMockImplementation()!;
    fetch.mockImplementation(async (input, init) => {
      if (init?.method === 'PUT') ifMatches.push(new Headers(init.headers).get('If-Match'));
      return answer(input, init);
    });

    type(EMAIL, 'ngozi.eze@example.com');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByText('Someone else changed this guest. Here is their version.'),
    ).toBeDefined();
    const panel = screen.getByRole('alert');
    expect(
      within(panel)
        .getAllByRole('term')
        .map((one) => one.textContent),
    ).toEqual(['Email address', 'Mobile number']);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(puts(sent)).toHaveLength(1);

    fireEvent.click(within(panel).getByRole('button', { name: 'Keep mine' }));

    expect(await screen.findByText('Saved')).toBeDefined();
    expect(puts(sent)).toHaveLength(2);
    expect(ifMatches).toEqual(['"1"', '"2"']);
  });

  it('keeps everything typed when the save fails, and says so', async () => {
    await editNgozi({ 'PUT /api/events/ev_1/guests/g_1': () => problem('server_error', 500) });

    type('Full name', 'Ngozi Okafor');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Not saved. Nothing was changed. Try again.')).toBeDefined();
    expect(field('Full name').value).toBe('Ngozi Okafor');
  });

  it('says the guest is not on this list when they were removed before the save', async () => {
    await editNgozi({ 'PUT /api/events/ev_1/guests/g_1': () => problem('not_found', 404) });

    type('Full name', 'Ngozi Okafor');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('This guest isn’t on this list')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Back to guests' })).toBeDefined();
  });

  it('asks before Cancel drops a change', async () => {
    await editNgozi();

    type('Full name', 'Ngozi Okafor');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(await screen.findByRole('alertdialog', { name: 'Discard your changes?' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }));

    await waitFor(() =>
      expect(document.activeElement).toBe(within(column()).getByRole('button', { name: 'Edit' })),
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Ngozi Eze' })).toBeDefined();
  });

  it('asks before Add guest drops a change, and keeps the edit on Keep editing', async () => {
    await editNgozi();

    type('Full name', 'Ngozi Okafor');
    fireEvent.click(screen.getByRole('button', { name: 'Add guest' }));

    expect(await screen.findByRole('alertdialog', { name: 'Discard your changes?' })).toBeDefined();
    expect(field('Full name').value).toBe('Ngozi Okafor');
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }));

    await waitFor(() =>
      expect(screen.queryByRole('alertdialog', { name: 'Discard your changes?' })).toBeNull(),
    );
    expect(within(column()).getByRole('heading', { level: 2, name: 'Edit guest' })).toBeDefined();
    expect(field('Full name').value).toBe('Ngozi Okafor');

    fireEvent.click(screen.getByRole('button', { name: 'Add guest' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Discard changes' }));

    await waitFor(() => expect(document.activeElement).toBe(field('Full name')));
    expect(form()).toBeDefined();
    expect(field('Full name').value).toBe('');
    fireEvent.click(screen.getByRole('link', { name: /^Chief Amaka Obi/u }));
    expect(screen.queryByRole('alertdialog', { name: 'Discard your changes?' })).toBeNull();
  });

  it('asks before another row drops a change, and opens that guest on Discard', async () => {
    await editNgozi();

    type('Full name', 'Ngozi Okafor');
    fireEvent.click(screen.getByRole('link', { name: /^Chief Amaka Obi/u }));

    expect(await screen.findByRole('alertdialog', { name: 'Discard your changes?' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
    await waitFor(() =>
      expect(screen.queryByRole('alertdialog', { name: 'Discard your changes?' })).toBeNull(),
    );
    expect(field('Full name').value).toBe('Ngozi Okafor');

    fireEvent.click(screen.getByRole('link', { name: /^Chief Amaka Obi/u }));
    fireEvent.click(await screen.findByRole('button', { name: 'Discard changes' }));

    await waitFor(() =>
      expect(
        screen
          .getAllByRole('region', { name: 'Chief Amaka Obi' })
          .some((one) => one.classList.contains('gs-column')),
      ).toBe(true),
    );
  });

  it('goes back to the details on Escape from Edit, asking first when something changed', async () => {
    await editNgozi();

    fireEvent.keyDown(field('Full name'), { key: 'Escape' });
    await waitFor(() =>
      expect(document.activeElement).toBe(within(column()).getByRole('button', { name: 'Edit' })),
    );

    fireEvent.click(within(column()).getByRole('button', { name: 'Edit' }));
    await waitFor(() => expect(document.activeElement).toBe(field('Full name')));
    type('Full name', 'Ngozi Okafor');
    fireEvent.keyDown(field('Full name'), { key: 'Escape' });

    expect(await screen.findByRole('alertdialog', { name: 'Discard your changes?' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }));
    await waitFor(() =>
      expect(document.activeElement).toBe(within(column()).getByRole('button', { name: 'Edit' })),
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Ngozi Eze' })).toBeDefined();
  });

  it('counts the form unchanged after Use theirs, so Cancel asks nothing', async () => {
    const theirs = { ...DETAILS, mobile: '+2348035550199' };
    let reads = 0;
    await editNgozi({
      'GET /api/events/ev_1/guests/g_1': () => {
        reads += 1;
        return reads === 1 ? tagged(DETAILS, '"1"') : tagged(theirs, '"2"');
      },
      'PUT /api/events/ev_1/guests/g_1': () => problem('precondition_failed', 412),
    });

    type(EMAIL, 'ngozi.eze@example.com');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Use theirs' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    await waitFor(() =>
      expect(document.activeElement).toBe(within(column()).getByRole('button', { name: 'Edit' })),
    );
    expect(screen.queryByRole('alertdialog', { name: 'Discard your changes?' })).toBeNull();
  });

  it('removes a companion at once and says to save', async () => {
    await editNgozi();

    fireEvent.click(screen.getByRole('button', { name: 'Remove Obi Eze' }));

    expect(await screen.findByText('Obi Eze removed. Save to keep the change.')).toBeDefined();
    expect(screen.getByText('None yet · 0 of 10')).toBeDefined();
  });

  it('names an unnamed companion’s Remove as the guest’s guest, as the add form does (sc-43267)', async () => {
    await editNgozi({
      'GET /api/events/ev_1/guests/g_1': () =>
        tagged({ ...DETAILS, companions: [{ id: 'c_1', fullName: null, state: 'coming' }] }, '"1"'),
    });

    expect(screen.getByRole('button', { name: 'Remove Ngozi Eze’s guest' })).toBeDefined();
  });
});

describe('A guest’s invitation link (sc-1526)', () => {
  const LINK = 'https://app.soirely.test/i/goJP8j72G8dKsdGysCtB7qA4o2SdVzDrjFodz60tDDc';

  async function openNgozi(
    answers: Record<string, Answer> = {},
    event: Record<string, unknown> = {},
    permissions: string[] = OWNER_PERMISSIONS,
  ) {
    signedIn();
    const sent = await onGuests(
      {
        'GET /api/events/ev_1': () => json({ event: { ...EVENT, ...event, permissions } }),
        'GET /api/events/ev_1/guests': () => json(listOf([NGOZI])),
        'GET /api/events/ev_1/guests/g_1': () => tagged(DETAILS, '"1"'),
        ...answers,
      },
      permissions,
    );
    fireEvent.click(await screen.findByRole('link', { name: /^Ngozi Eze/u }));
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('heading', { level: 2, name: 'Ngozi Eze' }),
      ),
    );

    return sent;
  }

  function writes(outcome: 'takes' | 'refuses'): { written: string[] } {
    const written: string[] = [];
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: (text: string) => {
          written.push(text);

          return outcome === 'takes' ? Promise.resolve() : Promise.reject(new Error('denied'));
        },
      },
    });

    return { written };
  }

  it('copies the whole link from the guest’s Invitation, and says so politely', async () => {
    const { written } = writes('takes');
    await openNgozi({ 'GET /api/events/ev_1/guests/g_1/link': () => json({ url: LINK }) });

    fireEvent.click(screen.getByRole('button', { name: /^Copy invitation link/u }));

    expect((await screen.findByText('Link copied')).closest('[role="status"]')).not.toBeNull();
    expect(written).toEqual([LINK]);
  });

  it('shows the link selected in a read-only field when the browser keeps the clipboard', async () => {
    writes('refuses');
    await openNgozi({ 'GET /api/events/ev_1/guests/g_1/link': () => json({ url: LINK }) });

    fireEvent.click(screen.getByRole('button', { name: /^Copy invitation link/u }));

    const box = (await screen.findByRole('textbox', {
      name: 'Invitation link',
    })) as HTMLTextAreaElement;
    await waitFor(() =>
      expect([box.value, box.readOnly, document.activeElement]).toEqual([LINK, true, box]),
    );
  });

  it('asks before replacing, Keep it changes nothing, and Replace link ends the old one', async () => {
    const sent = await openNgozi({
      'POST /api/events/ev_1/guests/g_1/link/replace': () => new Response(null, { status: 204 }),
    });

    fireEvent.click(screen.getByRole('button', { name: /^Replace link…/u }));
    const ask = screen.getByRole('alertdialog', { name: 'Replace Ngozi Eze’s link?' });
    expect(within(ask).getByText('The old link will stop working straight away.')).toBeDefined();
    fireEvent.click(within(ask).getByRole('button', { name: 'Keep it' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /^Replace link…/u }));
    fireEvent.click(screen.getByRole('button', { name: 'Replace link' }));

    expect(
      await screen.findByText(
        'Link replaced. Ngozi Eze’s old link no longer works. Copy the new one and send it.',
      ),
    ).toBeDefined();
    expect(sent.filter(({ line }) => line.includes('/link'))).toEqual([
      { line: 'POST /api/events/ev_1/guests/g_1/link/replace', body: null },
    ]);
  });

  it('re-reads an event paused elsewhere when a copy is refused, and says why, not the connection', async () => {
    let reads = 0;
    await openNgozi({
      'GET /api/events/ev_1': () => {
        reads += 1;

        return json({
          event: {
            ...EVENT,
            ...(reads > 1
              ? { status: 'paused', phase: 'paused', pausedAt: '2026-11-01T10:00:00+00:00' }
              : {}),
            permissions: OWNER_PERMISSIONS,
          },
        });
      },
      'GET /api/events/ev_1/guests/g_1/link': () => problem('event_state_invalid', 409),
    });

    fireEvent.click(screen.getByRole('button', { name: /^Copy invitation link/u }));

    expect(
      await screen.findByText('Guests can’t be invited while this event is paused.'),
    ).toBeDefined();
    expect(screen.queryByRole('button', { name: /^Copy invitation link/u })).toBeNull();
    expect(screen.queryByText('Check your connection and try again.')).toBeNull();
  });

  it('says the old link still works when a replace fails', async () => {
    await openNgozi({
      'POST /api/events/ev_1/guests/g_1/link/replace': () => problem('internal_error', 500),
    });

    fireEvent.click(screen.getByRole('button', { name: /^Replace link…/u }));
    fireEvent.click(screen.getByRole('button', { name: 'Replace link' }));

    expect(
      await screen.findByText('Not replaced. The old link still works. Try again.'),
    ).toBeDefined();
  });

  it('offers no copy on a Draft, says why with Make live, and keeps Replace link…', async () => {
    await openNgozi({}, { status: 'draft', phase: 'draft', madeLiveAt: null });

    expect(screen.getByText("Guests can't be invited until this event is live.")).toBeDefined();
    expect(screen.getByRole('button', { name: 'Make live' })).toBeDefined();
    expect(screen.queryByRole('button', { name: /^Copy invitation link/u })).toBeNull();
    expect(screen.getByRole('button', { name: /^Replace link…/u })).toBeDefined();
  });

  it('offers no copy on a Paused event, and says why in one line', async () => {
    await openNgozi(
      {},
      { status: 'paused', phase: 'paused', pausedAt: '2026-11-01T10:00:00+00:00' },
    );

    expect(screen.getByText('Guests can’t be invited while this event is paused.')).toBeDefined();
    expect(screen.queryByRole('button', { name: /^Copy invitation link/u })).toBeNull();
  });

  it('shows neither control to someone who cannot add guests', async () => {
    await openNgozi(
      {},
      {},
      OWNER_PERMISSIONS.filter((one) => one !== 'guests.manage'),
    );

    expect(screen.queryByRole('button', { name: /^Copy invitation link/u })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Replace link…/u })).toBeNull();
  });
});

describe('The wrong-person flag (sc-1526)', () => {
  const TITLE = 'Their link may have reached the wrong person';
  const FLAGGED = { 'GET /api/events/ev_1/guests/flagged': () => json({ guests: ['g_1'] }) };

  async function openFlagged(
    answers: Record<string, Answer> = {},
    permissions: string[] = OWNER_PERMISSIONS,
  ) {
    signedIn();
    const sent = await onGuests(
      {
        'GET /api/events/ev_1/guests': () => json(listOf([NGOZI, AMAKA])),
        'GET /api/events/ev_1/guests/g_1': () => tagged(DETAILS, '"1"'),
        ...FLAGGED,
        ...answers,
      },
      permissions,
    );
    fireEvent.click(await screen.findByRole('link', { name: /^Ngozi Eze/u }));
    await screen.findByRole('heading', { level: 2, name: 'Ngozi Eze' });

    return sent;
  }

  function guestColumn(): HTMLElement {
    return screen.getAllByRole('region', { name: 'Ngozi Eze' })[0]!;
  }

  it('puts the notice under the card and before Invitation, with its triangle and words', async () => {
    await openFlagged();

    const notice = await within(guestColumn()).findByRole('region', { name: TITLE });
    const invitation = within(guestColumn()).getByRole('region', { name: 'Invitation' });

    expect(within(notice).getByRole('heading', { level: 3 }).querySelector('svg')).not.toBeNull();
    expect(notice.textContent).toContain(
      'Someone who opened Ngozi Eze’s link told us it was not meant for them. The reply is unchanged. Replace the link so the old one stops working, then send Ngozi Eze the new one.',
    );
    expect(
      notice.compareDocumentPosition(invitation) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.queryAllByText(TITLE)).toHaveLength(1);
  });

  it('marks nobody else, and no row', async () => {
    await openFlagged({
      'GET /api/events/ev_1/guests/g_2': () =>
        tagged({ ...AMAKA, added: { at: '2026-09-14T10:00:00+00:00', by: null } }, '"1"'),
    });
    await within(guestColumn()).findByRole('region', { name: TITLE });

    expect(within(screen.getByRole('region', { name: 'Guests' })).queryByText(TITLE)).toBeNull();
    fireEvent.click(screen.getByRole('link', { name: /^Chief Amaka Obi/u }));
    await screen.findByRole('heading', { level: 2, name: 'Chief Amaka Obi' });
    expect(screen.queryByText(TITLE)).toBeNull();
  });

  it('keeps the notice on Keep it, and a replace from it clears it, focus on Replace link…', async () => {
    await openFlagged({
      'POST /api/events/ev_1/guests/g_1/link/replace': () => new Response(null, { status: 204 }),
    });
    const notice = await within(guestColumn()).findByRole('region', { name: TITLE });

    fireEvent.click(within(notice).getByRole('button', { name: 'Replace link…' }));
    fireEvent.click(
      within(screen.getByRole('alertdialog', { name: 'Replace Ngozi Eze’s link?' })).getByRole(
        'button',
        { name: 'Keep it' },
      ),
    );
    expect(within(guestColumn()).getByRole('region', { name: TITLE })).toBeDefined();

    fireEvent.click(within(notice).getByRole('button', { name: 'Replace link…' }));
    fireEvent.click(screen.getByRole('button', { name: 'Replace link' }));

    const done = await within(guestColumn()).findByText(
      'Link replaced. Ngozi Eze’s old link no longer works. Copy the new one and send it.',
    );
    expect(done.closest('[role="status"]')).not.toBeNull();
    expect(within(guestColumn()).queryByRole('region', { name: TITLE })).toBeNull();
    const invitation = within(guestColumn()).getByRole('region', { name: 'Invitation' });
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(invitation).getByRole('button', { name: /^Replace link…/u }),
      ),
    );
  });

  it('keeps the notice when the replace fails, and says the old link still works', async () => {
    await openFlagged({
      'POST /api/events/ev_1/guests/g_1/link/replace': () => problem('internal_error', 500),
    });
    const notice = await within(guestColumn()).findByRole('region', { name: TITLE });

    fireEvent.click(within(notice).getByRole('button', { name: 'Replace link…' }));
    fireEvent.click(screen.getByRole('button', { name: 'Replace link' }));

    expect((await within(guestColumn()).findByRole('alert')).textContent).toBe(
      'Not replaced. The old link still works. Try again.',
    );
    expect(within(guestColumn()).getByRole('region', { name: TITLE })).toBeDefined();
  });

  it('neither asks for nor shows the flag to someone who cannot add guests', async () => {
    const sent = await openFlagged(
      {},
      OWNER_PERMISSIONS.filter((one) => one !== 'guests.manage'),
    );

    expect(screen.queryByText(TITLE)).toBeNull();
    expect(sent.some(({ line }) => line.endsWith('/flagged'))).toBe(false);
  });
});

describe('a companion field (sc-43267)', () => {
  it('ends a placeholder too long for the field in an ellipsis, on one line', () => {
    expect(readFileSync(join(import.meta.dirname, 'guests.css'), 'utf8')).toMatch(
      /\.gs-companion \.desk-box input \{\s*overflow: hidden;\s*text-overflow: ellipsis;\s*white-space: nowrap;\s*\}/u,
    );
  });
});

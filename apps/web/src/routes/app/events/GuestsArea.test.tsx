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

  it('removes a companion at once and says to save', async () => {
    await editNgozi();

    fireEvent.click(screen.getByRole('button', { name: 'Remove Obi Eze' }));

    expect(await screen.findByText('Obi Eze removed. Save to keep the change.')).toBeDefined();
    expect(screen.getByText('None yet · 0 of 10')).toBeDefined();
  });
});

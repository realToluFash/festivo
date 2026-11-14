import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { __setConfig, config } from '../../../config.ts';
import { __setSessionState, type Session } from '../../../session.ts';
import { OWNER_PERMISSIONS, membership } from '../../../test-memberships.ts';
import { cssRule, stylesheet } from '../../../test-styles.ts';
import { routes } from '../../index.tsx';

const GUESTS_CSS = stylesheet(import.meta.dirname, 'guests.css');
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
    invitation: null as { at: string; how: string; by: string | null } | null,
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

type Listed = ReturnType<typeof listOf>;

/** sc-99's headcount for a list, as HeadcountCalculator counts it. */
function headcountOf({ guests: all }: Listed) {
  const waiting = all.filter((one) => one.invitation == null && one.reply === 'noReply');
  const notYetInvited = waiting.reduce((sum, one) => sum + 1 + one.companions.length, 0);
  const guests = all.filter((one) => !waiting.includes(one));
  const companions = guests.flatMap((one) => one.companions.map(() => one.reply));
  const count = (reply: string) => guests.filter((one) => one.reply === reply).length;
  const held = (reply: string) => companions.filter((host) => host === reply).length;
  const invited = guests.length + companions.length;

  return {
    headcount: {
      counts: {
        onList: invited + notYetInvited,
        notYetInvited,
        invited,
        accepted: count('coming') + held('coming'),
        maybe: count('maybe'),
        awaitingReply: count('noReply'),
        held: held('noReply') + held('maybe') + held('notComing'),
        heldBy: {
          hostNoReply: held('noReply'),
          hostMaybe: held('maybe'),
          hostNotComing: held('notComing'),
        },
        declined: count('notComing'),
      },
      byGroup: [],
      byDietaryNeed: { addsUp: false, needs: [] },
    },
  };
}

let shownRouter: ReturnType<typeof createMemoryRouter> | null = null;

async function onGuests(
  answers: Record<string, Answer>,
  permissions: string[] = OWNER_PERMISSIONS,
  at = '',
): Promise<{ line: string; body: unknown }[]> {
  const sent: { line: string; body: unknown }[] = [];

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const line = `${init?.method ?? 'GET'} ${new URL(String(input)).pathname}`;
    const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : null;
    sent.push({ line, body });

    const answer = answers[line];
    if (answer != null) return answer(body);
    if (line === 'GET /api/events/ev_1') return json({ event: { ...EVENT, permissions } });
    const listed = answers['GET /api/events/ev_1/guests'];
    if (line === 'GET /api/events/ev_1/headcount' && listed != null) {
      const list = (await (await listed(null)).json()) as Listed;

      return json(headcountOf(list));
    }

    return json({});
  });
  shownRouter = createMemoryRouter(routes, { initialEntries: [`/app/events/ev_1/guests${at}`] });
  render(<RouterProvider router={shownRouter} />);

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
    expect(await screen.findByText('4 coming of 5 invited')).toBeDefined();
    expect(screen.getByText('Everyone has replied.')).toBeDefined();
    const list = screen.getByRole('region', { name: 'Guests' });
    const rows = within(list).getAllByRole('listitem');

    expect(
      within(list)
        .getAllByRole('heading', { level: 2 })
        .map((head) => head.textContent),
    ).toEqual(['Coming · 4', 'Not sure yet · 1']);
    expect(rows.map((row) => row.textContent)).toEqual([
      'Ngozi EzeComing · ngozi@example.com · +234 803 555 0142',
      'Obi EzeComing',
      'Guest of Ngozi EzeComing',
      'Guest of Ngozi Eze · 2Coming',
      'Chief Amaka ObiNot sure yet',
    ]);
    expect(rows[1]?.className).toBe('is-companion');
  });

  it('dates a reply by the event’s day, not the browser’s (sc-1439)', async () => {
    const zone = process.env.TZ;
    process.env.TZ = 'Europe/London';
    try {
      signedIn();
      await onGuests({
        'GET /api/events/ev_1/guests': () =>
          json(
            listOf([
              guest('g_2', 'Chief Amaka Obi', {
                reply: 'coming',
                repliedAt: '2030-11-13T23:30:00+00:00',
              }),
            ]),
          ),
      });

      expect(await screen.findByText('Coming · replied Nov 14')).toBeDefined();
    } finally {
      if (zone == null) delete process.env.TZ;
      else process.env.TZ = zone;
    }
  });

  it('dates the reply in a replied guest’s details by the event’s day too (sc-3773)', async () => {
    const zone = process.env.TZ;
    process.env.TZ = 'Europe/London';
    try {
      const amaka = guest('g_2', 'Chief Amaka Obi', {
        reply: 'coming',
        repliedAt: '2030-11-13T23:30:00+00:00',
      });
      signedIn();
      await onGuests({
        'GET /api/events/ev_1/guests': () => json(listOf([amaka])),
        'GET /api/events/ev_1/guests/g_2': () =>
          tagged({ ...amaka, added: { at: '2030-11-01T10:00:00+00:00', by: null } }, '"1"'),
      });
      fireEvent.click(await screen.findByRole('link', { name: /^Chief Amaka Obi/u }));

      const reply = await screen.findByRole('region', { name: 'Reply' });
      expect(within(reply).getByText('Coming')).toBeDefined();
      expect(within(reply).getByText('replied Nov 14')).toBeDefined();
      const card = screen
        .getByRole('heading', { level: 2, name: 'Chief Amaka Obi' })
        .closest('section') as HTMLElement;
      expect(card.querySelector('.desk-on-card')?.textContent).toBe('Coming · replied Nov 14');
    } finally {
      if (zone == null) delete process.env.TZ;
      else process.env.TZ = zone;
    }
  });

  it('shows no Reply in the details of a guest who has not replied (sc-3773)', async () => {
    await openNgozi();

    expect(within(column()).queryByRole('region', { name: 'Reply' })).toBeNull();
    expect(column().querySelector('.gs-card.is-guest .desk-on-card')).toBeNull();
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
    let added = false;
    const sent = await opened({
      'GET /api/events/ev_1/headcount': () =>
        json(
          headcountOf(
            listOf(
              added
                ? [
                    NGOZI,
                    guest('g_9', 'Bimpe', {
                      companions: [{ id: 'c_9', fullName: null, state: 'held' }],
                    }),
                  ]
                : [NGOZI],
            ),
          ),
        ),
      'POST /api/events/ev_1/guests': () => {
        added = true;

        return json(
          {
            guest: guest('g_9', 'Bimpe Adeyemi', {
              email: 'bimpe@example.com',
              mobile: '+447700900123',
              companions: [{ id: 'c_9', fullName: null, state: 'notYetInvited' }],
            }),
          },
          201,
        );
      },
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
    expect(await screen.findByText('4 coming of 6 invited')).toBeDefined();
    expect(screen.getByText('2 haven’t replied (1 guest and 1 companion).')).toBeDefined();
    expect(screen.getByText('Bimpe Adeyemi')).toBeDefined();
    expect(screen.getByText('Not yet invited · bimpe@example.com · +44 7700 900123')).toBeDefined();
    expect(
      within(screen.getByRole('region', { name: 'Guests' }))
        .getAllByRole('listitem')
        .map((row) => row.textContent),
    ).toContain('Guest of Bimpe AdeyemiNot yet invited');
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

describe('Finding a guest (sc-3772)', () => {
  const invitation = { at: '2026-11-01T10:00:00+01:00', how: 'whatsapp', by: 'Folake Adeyemi' };
  const WAITING = [
    guest('g_3', 'Bola Ade', { invitation }),
    guest('g_4', 'José Ávila', {
      invitation,
      companions: [{ id: 'c_4', fullName: 'Rui Ávila', state: 'held' }],
    }),
    guest('g_5', 'Dayo Kalu', { invitation, mobile: '+2348031234567' }),
  ];
  const EVERYONE = [NGOZI, AMAKA, ...WAITING];

  async function shown(at = '') {
    signedIn();
    await onGuests({ 'GET /api/events/ev_1/guests': () => json(listOf(EVERYONE)) }, undefined, at);
    await screen.findByText('4 coming of 9 invited');
  }

  function names(): string[] {
    return within(screen.getByRole('region', { name: 'Guests' }))
      .getAllByRole('listitem')
      .map((row) => row.querySelector('.desk-row-name')?.textContent ?? '');
  }

  it('says who hasn’t replied, companions held behind them in the bracket', async () => {
    await shown();

    expect(screen.getByText('4 haven’t replied (3 guests and 1 companion).')).toBeDefined();
  });

  async function cardOn(event: Record<string, unknown>): Promise<HTMLElement> {
    signedIn();
    await onGuests({
      'GET /api/events/ev_1/guests': () => json(listOf(EVERYONE)),
      'GET /api/events/ev_1': () =>
        json({ event: { ...EVENT, ...event, permissions: OWNER_PERMISSIONS } }),
    });

    return (await screen.findByText(/^(4 coming of 9 invited|\d+ on the list)$/u)).closest(
      'section',
    )!;
  }

  it('says Paused on the card, with its line and no step, as the demo draws it', async () => {
    const card = await cardOn({
      status: 'paused',
      phase: 'paused',
      pausedAt: '2026-11-01T10:00:00+00:00',
    });

    expect(within(card).getByText('Paused')).toBeDefined();
    expect(
      within(card).getByText('Guests can’t be invited while this event is paused.'),
    ).toBeDefined();
    expect(within(card).queryByRole('button')).toBeNull();
  });

  it('says Draft on the card, with its line and Make live as its step', async () => {
    const card = await cardOn({ status: 'draft', phase: 'draft', madeLiveAt: null });

    expect(within(card).getByText('Draft')).toBeDefined();
    expect(
      within(card).getByText("Guests can't be invited until this event is live."),
    ).toBeDefined();
    fireEvent.click(within(card).getByRole('button', { name: 'Make live' }));

    expect(await screen.findByRole('dialog')).toBeDefined();
  });

  it('says a Draft whose end has passed cannot be made live, with Change dates as its step', async () => {
    const card = await cardOn({
      status: 'draft',
      phase: 'draft',
      madeLiveAt: null,
      startsAt: '2026-10-24T12:00:00+01:00',
      endsAt: '2026-10-24T18:00:00+01:00',
    });

    expect(within(card).getByText('Draft')).toBeDefined();
    expect(
      within(card).getByText(
        "This event's end has passed, so it cannot be made live. Change its dates first.",
      ),
    ).toBeDefined();
    expect(within(card).queryByRole('button', { name: 'Make live' })).toBeNull();
    fireEvent.click(within(card).getByRole('button', { name: 'Change dates' }));

    await waitFor(() => expect(shownRouter?.state.location.pathname).toBe('/app/events/ev_1/edit'));
  });

  it('says Finished on the card, with its line, its counts and no step', async () => {
    const card = await cardOn({ status: 'live', phase: 'finished' });

    expect(within(card).getByText('Finished')).toBeDefined();
    expect(within(card).getByText('4 coming of 9 invited')).toBeDefined();
    expect(
      within(card).getByText('This event has finished, so guests can’t be invited.'),
    ).toBeDefined();
    expect(within(card).queryByRole('button')).toBeNull();
  });

  it('groups All by reply, each with its first rows and Show all', async () => {
    await shown();

    expect(screen.getByRole('heading', { level: 2, name: 'No reply · 3' })).toBeDefined();
    expect(names()).not.toContain('José Ávila');
    fireEvent.click(screen.getByRole('button', { name: 'Show all 3' }));

    expect(names()).toContain('Rui Ávila');
    await waitFor(() => expect(document.activeElement?.textContent).toContain('José Ávila'));
  });

  it('chooses from the filter menu with each count, kept in the address', async () => {
    await shown();
    fireEvent.click(screen.getByRole('button', { name: 'All · 9' }));
    const menu = screen.getByRole('menu');

    expect(
      within(menu)
        .getAllByRole('menuitemradio')
        .map((item) => item.textContent),
    ).toEqual(['All9', 'Coming4', 'Not sure yet1', 'No reply3', 'Held1', 'Not coming0']);
    fireEvent.click(within(menu).getByRole('menuitemradio', { name: /^Held/u }));

    expect(names()).toEqual(['Rui Ávila']);
    expect(screen.getByText('Held · comes only if their host accepts')).toBeDefined();
    expect(screen.getByText('1 of 9 shown')).toBeDefined();
    expect(shownRouter?.state.location.search).toBe('?filter=held');
  });

  it('lists Not yet invited last, counting companions, with its own group on All and none of them under No reply (sc-3788)', async () => {
    signedIn();
    const BISI = guest('g_6', 'Bisi Adewale', {
      companions: [{ id: 'c_6', fullName: 'Tunde Adewale', state: 'notYetInvited' }],
    });
    await onGuests({ 'GET /api/events/ev_1/guests': () => json(listOf([...EVERYONE, BISI])) });
    await screen.findByText('4 coming of 9 invited');

    const groups = screen.getAllByRole('heading', { level: 2 }).map((one) => one.textContent);

    expect(groups.slice(-2)).toEqual(['No reply · 3', 'Not yet invited · 2']);

    fireEvent.click(screen.getByRole('button', { name: 'All · 11' }));
    const menu = screen.getByRole('menu');

    expect(
      within(menu)
        .getAllByRole('menuitemradio')
        .map((item) => item.textContent),
    ).toEqual([
      'All11',
      'Coming4',
      'Not sure yet1',
      'No reply3',
      'Held1',
      'Not coming0',
      'Not yet invited2',
    ]);
    fireEvent.click(within(menu).getByRole('menuitemradio', { name: /^No reply/u }));

    expect(names()).toEqual(['Bola Ade', 'José Ávila', 'Dayo Kalu']);
    fireEvent.click(screen.getByRole('button', { name: 'No reply · 3' }));
    fireEvent.click(
      within(screen.getByRole('menu')).getByRole('menuitemradio', { name: /^Not yet invited/u }),
    );

    expect(names()).toEqual(['Bisi Adewale', 'Tunde Adewale']);
    expect(screen.getByText('2 of 11 shown')).toBeDefined();
    expect(shownRouter?.state.location.search).toBe('?filter=notYetInvited');
  });

  it('steps Back through each change, the search once typing settles, then the choice', async () => {
    await shown();
    fireEvent.click(screen.getByRole('button', { name: 'All · 9' }));
    fireEvent.click(
      within(screen.getByRole('menu')).getByRole('menuitemradio', { name: /^Held/u }),
    );
    fireEvent.change(screen.getByRole('searchbox', { name: 'Find a guest' }), {
      target: { value: 'zz' },
    });
    await waitFor(() => expect(shownRouter?.state.location.search).toBe('?filter=held&q=zz'));
    expect(screen.getByRole('heading', { name: 'No guests match' })).toBeDefined();

    await act(() => shownRouter?.navigate(-1));

    expect(shownRouter?.state.location.search).toBe('?filter=held');
    expect(screen.getByRole<HTMLInputElement>('searchbox', { name: 'Find a guest' }).value).toBe(
      '',
    );
    expect(names()).toEqual(['Rui Ávila']);

    await act(() => shownRouter?.navigate(-1));

    expect(shownRouter?.state.location.pathname).toBe('/app/events/ev_1/guests');
    expect(shownRouter?.state.location.search).toBe('');
    expect(screen.getByRole('button', { name: 'All · 9' })).toBeDefined();
    expect(screen.getByRole('heading', { level: 2, name: 'Coming · 4' })).toBeDefined();
  });

  it('finds a name ignoring accents, and a number typed the national way, then keeps the search', async () => {
    await shown();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Find a guest' }), {
      target: { value: 'jose' },
    });

    expect(names()).toEqual(['José Ávila']);
    await waitFor(() => expect(shownRouter?.state.location.search).toBe('?q=jose'));
    fireEvent.change(screen.getByRole('searchbox', { name: 'Find a guest' }), {
      target: { value: '0803 123' },
    });

    expect(names()).toEqual(['Dayo Kalu']);
  });

  it('says No guests match with Clear, never an empty list, and Clear brings everyone back', async () => {
    await shown('?filter=maybe&q=ngozi');

    expect(screen.getByRole('heading', { name: 'No guests match' })).toBeDefined();
    expect(screen.getByText('0 of 9 shown')).toBeDefined();
    fireEvent.click(screen.getAllByRole('button', { name: 'Clear' }).at(-1)!);

    await waitFor(() => expect(shownRouter?.state.location.search).toBe(''));
    expect(screen.getByRole('heading', { level: 2, name: 'Coming · 4' })).toBeDefined();
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('searchbox', { name: 'Find a guest' })),
    );
  });
});

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
    let listed = listOf([AMAKA]);
    const { source } = await live(
      () => listed,
      OWNER_PERMISSIONS.filter((one) => one !== 'guests.manage'),
    );

    expect(source.url).toContain('topic=events%2Fev_1%2Fguests');
    listed = listOf([AMAKA, guest('g_3', 'Tomás Ferreira')]);
    source.publish(listed);

    expect(await screen.findByText('Tomás Ferreira')).toBeDefined();
    expect(await screen.findByText('0 coming of 2 invited')).toBeDefined();
    expect(screen.getByText('1 hasn’t replied.')).toBeDefined();
  });

  it('reads the list again for someone who manages guests, since the published one has no contacts (sc-3773)', async () => {
    let list = listOf([AMAKA]);
    const { sent, source } = await live(() => list);
    const reads = () => sent.filter((one) => one.line === 'GET /api/events/ev_1/guests').length;
    const before = reads();

    list = listOf([AMAKA, guest('g_3', 'Tomás Ferreira', { email: 'tomas@example.com' })]);
    source.publish(listOf([AMAKA, guest('g_3', 'Tomás Ferreira')]));

    expect(await screen.findByText('Not yet invited · tomas@example.com')).toBeDefined();
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

  it('writes the Added date in the browser’s date order, as the reply’s (sc-3773, #44910)', async () => {
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('en-GB');
    await openNgozi();

    expect(within(column()).getByText(/^14 Sept? by Kemi Bankole$/u)).toBeDefined();
  });

  it('holds the cover card’s place and three detail rows while the guest loads, heard as Loading…', async () => {
    signedIn();
    await onGuests({
      'GET /api/events/ev_1/guests': () => json(listOf([NGOZI, AMAKA])),
      'GET /api/events/ev_1/guests/g_1': () => new Promise<Response>(() => {}),
    });
    fireEvent.click(await screen.findByRole('link', { name: /^Ngozi Eze/u }));

    const loading = await within(column()).findByRole('status');
    expect(loading.textContent).toBe('Loading…');
    expect(loading.querySelectorAll('.gs-bone-guest')).toHaveLength(1);
    expect(loading.querySelectorAll('.desk-row.is-bones')).toHaveLength(3);
    expect(cssRule('.gs-bone-guest', GUESTS_CSS)).toContain('height: 170px;');
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

  it('focuses the guest’s name once they load, however long the read takes (#45708)', async () => {
    let answer: (response: Response) => void = () => undefined;
    signedIn();
    await onGuests({
      'GET /api/events/ev_1/guests': () => json(listOf([NGOZI, AMAKA])),
      'GET /api/events/ev_1/guests/g_1': () =>
        new Promise<Response>((resolve) => {
          answer = resolve;
        }),
    });
    fireEvent.click(await screen.findByRole('link', { name: /^Ngozi Eze/u }));
    await within(column()).findByRole('status');
    await act(() => new Promise((resolve) => setTimeout(resolve, 300)));

    act(() => answer(tagged(DETAILS, '"1"')));

    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('heading', { level: 2, name: 'Ngozi Eze' }),
      ),
    );
  });

  it.each(['Save', 'Cancel'])(
    'shows a colleague’s save that landed mid-edit after %s with nothing changed (#45708)',
    async (leave) => {
      const before = config();
      __setConfig({ ...before, mercureUrl: 'http://hub.test/.well-known/mercure' });
      StubSource.made = [];
      vi.stubGlobal('EventSource', StubSource);
      const hub = () =>
        json({ token: 'tok', expiresAt: new Date(Date.now() + 3_600_000).toISOString() });
      let details = DETAILS;

      try {
        await editNgozi({
          'GET /api/events/ev_1/guests/g_1': () => tagged(details, '"1"'),
          'POST /api/events/ev_1/guests/subscriptions': hub,
          'POST /api/realtime/subscriptions': hub,
        });
        const source = StubSource.made.find((one) => one.url.includes('guests'))!;
        details = { ...DETAILS, fullName: 'Ngozi Okafor' };
        source.publish(listOf([{ ...NGOZI, fullName: 'Ngozi Okafor' }, AMAKA]));

        fireEvent.click(within(column()).getByRole('button', { name: leave }));

        expect(
          await screen.findByRole('heading', { level: 2, name: 'Ngozi Okafor' }),
        ).toBeDefined();
      } finally {
        __setConfig(before);
        vi.unstubAllGlobals();
      }
    },
  );

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

  it('shows on a 412 only the fields this host changed, holds Save, and Keep mine keeps the colleague’s other change', async () => {
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
    ).toEqual(['Email address']);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(puts(sent)).toHaveLength(1);

    fireEvent.click(within(panel).getByRole('button', { name: 'Keep mine' }));

    expect(await screen.findByText('Saved')).toBeDefined();
    expect(puts(sent)).toHaveLength(2);
    expect(ifMatches).toEqual(['"1"', '"2"']);
    expect(puts(sent)[1]?.body).toMatchObject({
      email: 'ngozi.eze@example.com',
      mobile: { countryCode: 'NG', number: '0803 555 0199' },
    });
  });

  it('after Keep mine fails, Save sends the merged form against their version, not the colleague’s old field', async () => {
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
        if (saves === 1) return problem('precondition_failed', 412);
        if (saves === 2) return problem('server_error', 500);
        return tagged({ ...theirs, email: 'ngozi.eze@example.com' }, '"3"');
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
    const panel = await screen.findByRole('alert');
    fireEvent.click(within(panel).getByRole('button', { name: 'Keep mine' }));

    expect(await screen.findByText('Not saved. Nothing was changed. Try again.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Saved')).toBeDefined();
    expect(ifMatches).toEqual(['"1"', '"2"', '"2"']);
    expect(puts(sent)[2]?.body).toMatchObject({
      email: 'ngozi.eze@example.com',
      mobile: { countryCode: 'NG', number: '0803 555 0199' },
    });
  });

  it('on a second 412 from Keep mine, the panel lists what this host changed and Keep mine sends its Yours', async () => {
    let reads = 0;
    let saves = 0;
    const first = { ...DETAILS, email: 'ngozi.eze@example.com' };
    const second = { ...DETAILS, email: 'other@example.com' };
    const sent = await editNgozi({
      'GET /api/events/ev_1/guests/g_1': () => {
        reads += 1;
        if (reads === 1) return tagged(DETAILS, '"1"');
        return reads === 2 ? tagged(first, '"2"') : tagged(second, '"3"');
      },
      'PUT /api/events/ev_1/guests/g_1': () => {
        saves += 1;
        return saves < 3
          ? problem('precondition_failed', 412)
          : tagged(
              { ...second, fullName: 'Ngozi Eze-Okafor', email: 'ngozi.eze@example.com' },
              '"4"',
            );
      },
    });

    type('Full name', 'Ngozi Eze-Okafor');
    type(EMAIL, 'ngozi.eze@example.com');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    const terms = (panel: HTMLElement) =>
      within(panel)
        .getAllByRole('term')
        .map((one) => one.textContent);
    const panel = await screen.findByRole('alert');
    expect(terms(panel)).toEqual(['Full name']);

    fireEvent.click(within(panel).getByRole('button', { name: 'Keep mine' }));
    await waitFor(() => expect(puts(sent)).toHaveLength(2));
    const again = await screen.findByRole('alert');
    await waitFor(() => expect(terms(again)).toEqual(['Full name', 'Email address']));
    expect(within(again).getByText('ngozi.eze@example.com')).toBeDefined();

    fireEvent.click(within(again).getByRole('button', { name: 'Keep mine' }));

    expect(await screen.findByText('Saved')).toBeDefined();
    expect(puts(sent)[2]?.body).toMatchObject({
      fullName: 'Ngozi Eze-Okafor',
      email: 'ngozi.eze@example.com',
    });
  });

  it('Keep mine brings back a companion their version removed, as a new one (Decided, 13 Nov)', async () => {
    let reads = 0;
    let saves = 0;
    const theirs = { ...DETAILS, companions: [] };
    const sent = await editNgozi({
      'GET /api/events/ev_1/guests/g_1': () => {
        reads += 1;
        return reads === 1 ? tagged(DETAILS, '"1"') : tagged(theirs, '"2"');
      },
      'PUT /api/events/ev_1/guests/g_1': () => {
        saves += 1;
        return saves === 1
          ? problem('precondition_failed', 412)
          : tagged(
              {
                ...theirs,
                companions: [
                  { id: 'c_2', fullName: 'Obi Eze', state: 'coming' },
                  { id: 'c_3', fullName: 'Tolu Bankole', state: 'coming' },
                ],
              },
              '"3"',
            );
      },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Add a companion' }));
    type('Companion’s full name, 2 of 2', 'Tolu Bankole');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    const panel = await screen.findByRole('alert');
    expect(
      within(panel)
        .getAllByRole('term')
        .map((one) => one.textContent),
    ).toEqual(['Companions']);
    expect(puts(sent)[0]?.body).toMatchObject({
      companions: [
        { id: 'c_1', fullName: 'Obi Eze' },
        { id: null, fullName: 'Tolu Bankole' },
      ],
    });

    fireEvent.click(within(panel).getByRole('button', { name: 'Keep mine' }));

    expect(await screen.findByText('Saved')).toBeDefined();
    expect(puts(sent)[1]?.body).toMatchObject({
      companions: [
        { id: null, fullName: 'Obi Eze' },
        { id: null, fullName: 'Tolu Bankole' },
      ],
    });
  });

  it('sends nothing on a 412 when their version already holds every change, and shows it', async () => {
    let reads = 0;
    const theirs = { ...DETAILS, email: 'ngozi.eze@example.com' };
    const sent = await editNgozi({
      'GET /api/events/ev_1/guests/g_1': () => {
        reads += 1;
        return reads === 1 ? tagged(DETAILS, '"1"') : tagged(theirs, '"2"');
      },
      'PUT /api/events/ev_1/guests/g_1': () => problem('precondition_failed', 412),
    });

    type(EMAIL, 'ngozi.eze@example.com');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('ngozi.eze@example.com')).toBeDefined();
    expect(
      screen.queryByText('Someone else changed this guest. Here is their version.'),
    ).toBeNull();
    expect(screen.queryByRole('button', { name: 'Keep mine' })).toBeNull();
    expect(puts(sent)).toHaveLength(1);
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

    expect(await screen.findByText('This guest is not on this list')).toBeDefined();
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
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('heading', { level: 2, name: 'Ngozi Eze' }),
      ),
    );

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
    const input = cssRule('.gs-companion .desk-box input', GUESTS_CSS);

    expect(input).toContain('overflow: hidden;');
    expect(input).toContain('text-overflow: ellipsis;');
    expect(input).toContain('white-space: nowrap;');
  });
});

describe('a guest’s column at 320 (sc-3773)', () => {
  it('shrinks below its widest field row, so the phone row never pushes the form past the screen', () => {
    expect(cssRule('.gs-column', GUESTS_CSS)).toContain('min-width: 0;');
  });
});
describe('the Guests top at 320 (sc-3773, ux #44604)', () => {
  it('wraps the title only at spaces, with Add guest dropping to its own row', () => {
    expect(cssRule('.gs-top', GUESTS_CSS)).toContain('flex-wrap: wrap;');
    expect(cssRule('.gs-title', GUESTS_CSS)).toContain('flex: 1 1 auto;');
    expect(cssRule('.gs-title', GUESTS_CSS)).toContain('overflow-wrap: break-word;');
    expect(cssRule('.gs-title', GUESTS_CSS)).not.toContain('min-width: 0;');
  });

  it('wraps the crumbs whole at word breaks rather than truncating them', () => {
    expect(cssRule('.gs .ev-crumb ol', GUESTS_CSS)).toContain('flex-wrap: wrap;');
    expect(cssRule('.gs .ev-crumb-part', GUESTS_CSS)).toContain('min-width: auto;');
    expect(cssRule('.gs .ev-crumb-part', GUESTS_CSS)).toContain('overflow-wrap: break-word;');
    expect(cssRule('.gs .ev-crumb-name', GUESTS_CSS)).toContain('white-space: normal;');
  });

  it('keeps the switcher’s name to one line in the phone’s bar, ellipsised', () => {
    const name = cssRule(
      '.shell-sidebar .sw-opener-name',
      stylesheet(import.meta.dirname, '../../../components/desk.css'),
    );

    expect(name).toContain('text-overflow: ellipsis;');
    expect(name).toContain('white-space: nowrap;');
  });
});

describe('Not yet invited, and Mark as invited (sc-3788)', () => {
  const BISI = guest('g_4', 'Bisi Adewale', {
    companions: [{ id: 'c_4', fullName: 'Tunde Adewale', state: 'notYetInvited' }],
  });
  const BISI_DETAILS = { ...BISI, added: { at: '2026-09-14T10:00:00+00:00', by: 'Kemi Bankole' } };
  const MARKED = {
    ...BISI_DETAILS,
    invitation: { at: '2026-11-13T10:00:00+01:00', how: 'whatsapp', by: 'Folake Adeyemi' },
    companions: [{ id: 'c_4', fullName: 'Tunde Adewale', state: 'held' }],
  };

  async function openBisi(
    answers: Record<string, Answer> = {},
    event: Record<string, unknown> = {},
    permissions: string[] = OWNER_PERMISSIONS,
  ) {
    signedIn();
    const sent = await onGuests(
      {
        'GET /api/events/ev_1': () => json({ event: { ...EVENT, ...event, permissions } }),
        'GET /api/events/ev_1/guests': () => json(listOf([BISI])),
        'GET /api/events/ev_1/guests/g_4': () => tagged(BISI_DETAILS, '"1"'),
        ...answers,
      },
      permissions,
    );
    fireEvent.click(await screen.findByRole('link', { name: /^Bisi Adewale/u }));
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('heading', { level: 2, name: 'Bisi Adewale' }),
      ),
    );

    return sent;
  }

  function invitation(): HTMLElement {
    return screen.getByRole('region', { name: 'Invitation' });
  }

  function listed(): (string | null)[] {
    return within(screen.getByRole('region', { name: 'Guests' }))
      .getAllByRole('listitem')
      .map((row) => row.textContent);
  }

  it('lists a guest nobody has invited, and their companion, as Not yet invited', async () => {
    await openBisi();

    expect(listed()).toContain('Bisi AdewaleNot yet invited');
    expect(listed()).toContain('Tunde AdewaleNot yet invited');
    expect(
      screen.getByText('Copying their link does not mark them. Mark them once you have sent it.'),
    ).toBeDefined();
  });

  it('asks how, sends nothing with nothing chosen, then records the way chosen', async () => {
    const sent = await openBisi({
      'PUT /api/events/ev_1/guests/g_4/invitation': () => tagged(MARKED, '"1"'),
    });

    fireEvent.click(within(invitation()).getByRole('button', { name: /^Mark as invited/u }));
    const ways = within(invitation()).getByRole('group', { name: 'How did you invite them?' });
    expect(
      within(ways)
        .getAllByRole('radio')
        .map((one) => [one.closest('label')?.textContent, (one as HTMLInputElement).checked]),
    ).toEqual([
      ['WhatsApp', false],
      ['Text message', false],
      ['Email', false],
      ['In person', false],
      ['Other', false],
    ]);
    await waitFor(() => expect(document.activeElement).toBe(within(ways).getAllByRole('radio')[0]));

    fireEvent.click(within(invitation()).getByRole('button', { name: 'Mark as invited' }));
    expect(within(invitation()).getByText('Choose how you invited them.')).toBeDefined();
    expect(sent.filter(({ line }) => line.includes('/guests/g_4/invitation'))).toEqual([]);

    fireEvent.click(within(ways).getByRole('radio', { name: 'WhatsApp' }));
    fireEvent.click(within(invitation()).getByRole('button', { name: 'Mark as invited' }));

    expect(
      await within(invitation()).findByText(/^Invited by Folake Adeyemi, WhatsApp, Nov 13$/u),
    ).toBeDefined();
    expect(sent.filter(({ line }) => line.includes('/guests/g_4/invitation'))).toEqual([
      { line: 'PUT /api/events/ev_1/guests/g_4/invitation', body: { how: 'whatsapp' } },
    ]);
    expect(screen.queryByRole('group', { name: 'How did you invite them?' })).toBeNull();
    expect(listed()).toContain('Bisi AdewaleNo reply');
    expect(listed()).toContain('Tunde AdewaleHeld');
  });

  it('says a failed mark was not saved and keeps the choices open', async () => {
    await openBisi({
      'PUT /api/events/ev_1/guests/g_4/invitation': () => problem('internal_error', 500),
    });

    fireEvent.click(within(invitation()).getByRole('button', { name: /^Mark as invited/u }));
    fireEvent.click(screen.getByRole('radio', { name: 'In person' }));
    fireEvent.click(within(invitation()).getByRole('button', { name: 'Mark as invited' }));

    expect(
      await screen.findByText('Not saved. They are still Not yet invited. Try again.'),
    ).toBeDefined();
    expect(screen.getByRole('group', { name: 'How did you invite them?' })).toBeDefined();
  });

  it('offers Mark as invited after copying the link of a guest nobody has invited', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: () => Promise.resolve() },
    });
    await openBisi({
      'GET /api/events/ev_1/guests/g_4/link': () => json({ url: 'https://app.soirely.test/i/x' }),
    });

    fireEvent.click(screen.getByRole('button', { name: /^Copy invitation link/u }));
    await screen.findByText('Link copied');
    const offers = within(invitation()).getAllByRole('button', { name: /^Mark as invited/u });
    fireEvent.click(offers.find((one) => one.classList.contains('is-green'))!);

    expect(screen.getByRole('group', { name: 'How did you invite them?' })).toBeDefined();
  });

  it('undoes a mark made by hand, and says so', async () => {
    const sent = await openBisi({
      'GET /api/events/ev_1/guests/g_4': () => tagged(MARKED, '"1"'),
      'DELETE /api/events/ev_1/guests/g_4/invitation': () => tagged(BISI_DETAILS, '"1"'),
    });

    fireEvent.click(within(invitation()).getByRole('button', { name: 'Mark as not invited' }));

    expect(await screen.findByText('Marked as not invited.')).toBeDefined();
    expect(sent.filter(({ line }) => line.includes('/guests/g_4/invitation'))).toEqual([
      { line: 'DELETE /api/events/ev_1/guests/g_4/invitation', body: null },
    ]);
    expect(within(invitation()).queryByText(/^Invited by/u)).toBeNull();
  });

  it('says they stay invited when they replied before the undo landed', async () => {
    await openBisi({
      'GET /api/events/ev_1/guests/g_4': () => tagged(MARKED, '"1"'),
      'DELETE /api/events/ev_1/guests/g_4/invitation': () =>
        problem('guest_replied', 409, { reply: 'coming', repliedAt: '2026-11-13T11:00:00+01:00' }),
    });

    fireEvent.click(within(invitation()).getByRole('button', { name: 'Mark as not invited' }));

    expect(
      await screen.findByText(
        'Not changed. Bisi Adewale replied Coming on Nov 13, so they stay invited.',
      ),
    ).toBeDefined();
  });

  it('offers no undo for Soirely’s message', async () => {
    await openBisi({
      'GET /api/events/ev_1/guests/g_4': () =>
        tagged(
          {
            ...MARKED,
            invitation: { at: '2026-11-13T10:00:00+01:00', how: 'soirelyMessage', by: null },
          },
          '"1"',
        ),
    });

    expect(within(invitation()).getByText(/^Invited by Soirely’s message, Nov 13$/u)).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Mark as not invited' })).toBeNull();
  });

  it('offers no Mark as invited on a Draft', async () => {
    await openBisi({}, { status: 'draft', phase: 'draft', madeLiveAt: null });

    expect(screen.getByText("Guests can't be invited until this event is live.")).toBeDefined();
    expect(screen.queryByRole('button', { name: /^Mark as invited/u })).toBeNull();
  });

  it('offers no Mark as invited on a Paused event, and says why', async () => {
    await openBisi(
      {},
      { status: 'paused', phase: 'paused', pausedAt: '2026-11-01T10:00:00+00:00' },
    );

    expect(screen.getByText('Guests can’t be invited while this event is paused.')).toBeDefined();
    expect(screen.queryByRole('button', { name: /^Mark as invited/u })).toBeNull();
  });

  it('shows the marks, with no way to change them, to someone who cannot add guests', async () => {
    await openBisi(
      { 'GET /api/events/ev_1/guests/g_4': () => tagged(MARKED, '"1"') },
      {},
      OWNER_PERMISSIONS.filter((one) => one !== 'guests.manage'),
    );

    expect(within(invitation()).getByText(/^Invited by Folake Adeyemi, WhatsApp/u)).toBeDefined();
    expect(
      within(invitation()).getByText(
        'You can see names, replies and who is invited. Marking guests as invited needs a host or organiser role.',
      ),
    ).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Mark as not invited' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Mark as invited/u })).toBeNull();
  });
});

import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterAll, afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { connection, forgetEventsTab, serverClock } from '@soirely/domain';

import { api } from '../../../api.ts';
import { __setConfig, config } from '../../../config.ts';
import { __setSessionState, type Session, switchOrganisation } from '../../../session.ts';
import { OWNER_PERMISSIONS, membership } from '../../../test-memberships.ts';
import { breaksAnywhere } from '../../../test-wrapping.ts';
import { routes } from '../../index.tsx';

const IRE = membership({ id: 'org_1', name: 'Ìrè Events' });

const READER = membership({
  ...IRE,
  role: { id: 'role_5', seededAs: 'read_only', name: null },
  permissions: OWNER_PERMISSIONS.filter((permission) => permission.endsWith('.read')),
});

// Every key the API's event serialisation writes, as the sc-1486 contract states it.
function event(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ev_1',
    organisationId: 'org_1',
    name: 'Adaeze and Tunde',
    type: 'wedding',
    status: 'draft',
    startsAt: '2026-11-14T16:00:00+01:00',
    endsAt: '2026-11-15T02:00:00+01:00',
    timeZone: 'Africa/Lagos',
    dayCount: 2,
    currency: 'NGN',
    cover: null,
    venue: null,
    arrivalNote: null,
    hosts: ['Funmi Adeyemi'],
    madeLiveAt: null,
    pausedAt: null,
    phase: 'draft',
    concludedAt: null,
    createdAt: '2026-10-21T09:00:00+00:00',
    permissions: holding,
    ...overrides,
  };
}

/** As the API answers: an organisation-wide role reads its own permissions on every event. */
let holding: string[] = OWNER_PERMISSIONS;

function signedIn(organisation = IRE, organisations = [organisation]): void {
  holding = organisation.permissions;
  const session: Session = {
    name: 'Folake Adeyemi',
    email: 'folake@ire.events',
    verified: true,
    complete: true,
    awaiting: null,
    providers: [],
    userId: 'u1',
    needsOrganisation: false,
    hasPassword: true,
    organisation,
    organisations,
    organisationCountry: null,
    timezone: null,
    waitingFor: null,
  };

  __setSessionState({ status: 'signedIn', session });
}

type Answer = (body: unknown, url: URL) => Response | Promise<Response>;

/** Tagged as the API tags an event, which the event's page reads with its version. */
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ETag: '"1"' } });
}

function problem(status: number, code: string, extra: Record<string, unknown> = {}): Response {
  return json(
    { type: `https://soirely.com/errors/${code}`, title: 'No.', status, ...extra },
    status,
  );
}

function answering(answers: Record<string, Answer>) {
  const sent: { line: string; body: unknown }[] = [];

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = new URL(String(input));
    const line = `${init?.method ?? 'GET'} ${url.pathname}`;
    const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : null;
    sent.push({ line, body });

    return (
      (await answers[line]?.(body, url)) ??
      (url.pathname.endsWith('/headcount') ? json({ headcount: headcountOf() }) : json({}))
    );
  });

  return sent;
}

/** sc-99's headcount, nobody on the list unless told. */
function headcountOf(counts: Record<string, number> = {}) {
  return {
    counts: {
      onList: 0,
      notYetInvited: 0,
      invited: 0,
      accepted: 0,
      maybe: 0,
      awaitingReply: 0,
      held: 0,
      declined: 0,
      heldBy: { hostNoReply: 0, hostMaybe: 0, hostNotComing: 0 },
      ...counts,
    },
    byGroup: [],
    byDietaryNeed: { addsUp: false, needs: [] },
  };
}

/** The list's two requests: every unfinished event, and the Finished a page at a time of `pastTotal`. */
function listed(
  unfinished: Record<string, unknown>[],
  past: Record<string, unknown>[] = [],
  pastTotal = past.length,
): Answer {
  return (_body, url) => {
    const page = Number(url.searchParams.get('page') ?? '1');
    const perPage = Number(url.searchParams.get('itemsPerPage') ?? '50');
    const finished = url.searchParams.get('finished') === 'true';
    const events = (finished ? past : unfinished)
      .slice((page - 1) * perPage, page * perPage)
      .map((one) => ({ milestones: [], ...one }));

    return json({ events, total: finished ? pastTotal : unfinished.length });
  };
}

function at(path: string): void {
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />);
}

/** The words of a field's clocks-skip notice, without its aria-hidden mark. */
function gapLine(id: string): string {
  return document.querySelector(`#${id} p`)?.textContent ?? '';
}

function spaced(text: string | null): string {
  return (text ?? '').replace(/\s/g, ' ');
}

/** The open tab's rows, under its card. */
function listedRows(): HTMLElement[] {
  return [...screen.getByRole('tabpanel').querySelectorAll<HTMLElement>('.ev-rows > li')];
}

function rowNames(): string[] {
  return listedRows().map((row) => row.querySelector('.desk-row-name')?.textContent ?? '');
}

afterEach(() => {
  vi.restoreAllMocks();
  forgetEventsTab();
});

describe('Events', () => {
  it('draws the soonest draft as the card with its step, and each other as one link with its days, place and how soon (sc-30413)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-13T12:00:00Z'));
    serverClock.observe(new Date().toUTCString());
    signedIn();
    answering({
      'GET /api/orgs/org_1/events': listed([
        event({
          id: 'ev_2',
          name: 'Board dinner',
          type: 'corporate',
          startsAt: '2026-12-01T19:00:00+00:00',
          endsAt: '2026-12-01T23:00:00+00:00',
          timeZone: 'Europe/London',
        }),
        event(),
      ]),
    });
    at('/app/events');

    fireEvent.click(await screen.findByRole('tab', { name: 'Drafts 2' }));
    const card = screen.getByRole('region', { name: 'Adaeze and Tunde' });

    expect(spaced(card.textContent)).toBe(
      'Draftin 32 daysAdaeze and TundeSaturday, Nov 14 to Sunday, Nov 15 · Venue to be confirmedSat14Sun15Guests can’t be invited until this event is live.Make live',
    );
    expect(within(card).getByRole('link').getAttribute('href')).toBe('/app/events/ev_1');

    const rows = listedRows();
    expect(rows.map((row) => spaced(row.textContent))).toEqual([
      'Board dinnerTuesday, Dec 1 · Venue to be confirmedin 49 days',
    ]);
    expect(within(rows[0]!).getAllByRole('link')).toHaveLength(1);
    expect(within(rows[0]!).getByRole('link').getAttribute('href')).toBe('/app/events/ev_2');
    expect(within(rows[0]!).queryByRole('img')).toBeNull();
    expect(screen.getByRole('link', { name: 'New event' }).getAttribute('href')).toBe(
      '/app/events/new',
    );
    vi.useRealTimers();
    serverClock.observe(new Date().toUTCString());
  });

  it('shows the first-run card, with Create an event, to an organisation with no events', async () => {
    signedIn();
    answering({ 'GET /api/orgs/org_1/events': listed([]) });
    at('/app/events');

    const card = (await screen.findByRole('heading', { name: 'Set up your first event' }))
      .parentElement!;

    expect(within(card).getByRole('link', { name: 'Create an event' }).getAttribute('href')).toBe(
      '/app/events/new',
    );
    expect(document.querySelectorAll('.ev-steps > li')).toHaveLength(3);
    expect(screen.queryByRole('tablist')).toBeNull();
  });

  it('shows no button without Create events, and says who can create one', async () => {
    signedIn(READER);
    answering({ 'GET /api/orgs/org_1/events': listed([]) });
    at('/app/events');

    await screen.findByRole('heading', { name: 'Set up your first event' });

    expect(
      screen.getByText(
        'Events your organisation creates will show here. Ask an owner if you need to create one.',
      ),
    ).toBeDefined();
    expect(screen.queryByRole('link', { name: 'Create an event' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'New event' })).toBeNull();
  });

  it('says the list did not load, with no rows, and loads it again on Try again', async () => {
    signedIn();
    let calls = 0;
    answering({
      'GET /api/orgs/org_1/events': (body, url) =>
        ++calls <= 2 ? problem(500, 'internal_error') : listed([event()])(body, url),
    });
    at('/app/events');

    expect((await screen.findByRole('alert')).textContent).toContain(
      'The events did not load. Try again in a moment.',
    );
    expect(within(screen.getByRole('main')).queryAllByRole('listitem')).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    fireEvent.click(await screen.findByRole('tab', { name: /Drafts/ }));

    expect(await screen.findByRole('link', { name: /Adaeze and Tunde/ })).toBeDefined();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it.each([
    ['the list', [event()], 'Events'],
    ['the first-run card', [], 'Set up your first event'],
  ])(
    'takes focus to the heading above %s once Try again loads it (sc-11369)',
    async (_what, events, heading) => {
      signedIn();
      let calls = 0;
      answering({
        'GET /api/orgs/org_1/events': (body, url) =>
          ++calls <= 2 ? problem(500, 'internal_error') : listed(events)(body, url),
      });
      at('/app/events');

      fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));
      expect(document.activeElement).toBe(document.body);

      const title = await screen.findByRole('heading', { name: heading });
      await waitFor(() => expect(document.activeElement).toBe(title));
    },
  );

  it('takes focus to the line that says the events did not load when Try again fails again (sc-11369)', async () => {
    signedIn();
    answering({ 'GET /api/orgs/org_1/events': () => problem(500, 'internal_error') });
    at('/app/events');

    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));

    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByText('The events did not load. Try again in a moment.'),
      ),
    );
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it("counts the organisation's events on the dashboard", async () => {
    signedIn();
    answering({
      'GET /api/orgs/org_1/events': listed([event()], [event({ id: 'ev_2' })]),
    });
    at('/app/guests');

    expect(await screen.findByText('2 events')).toBeDefined();
  });
});

describe('Events Home (sc-3594)', () => {
  const NOW = new Date('2026-11-01T12:00:00Z');

  function live(name: string, overrides: Record<string, unknown> = {}) {
    return event({ id: name, name, status: 'live', phase: 'live', ...overrides });
  }

  function starts(title: string, at: string) {
    return { at, title, note: null, owner: 'event', area: 'events', action: null };
  }

  function finished(count: number) {
    return Array.from({ length: count }, (_, index) =>
      event({
        id: `past_${index}`,
        name: `Past ${String(index).padStart(2, '0')}`,
        status: 'ended',
        phase: 'finished',
        startsAt: '2026-09-01T10:00:00+01:00',
        endsAt: '2026-09-01T12:00:00+01:00',
        concludedAt: new Date(
          Date.parse('2026-10-30T10:00:00Z') - index * 86_400_000,
        ).toISOString(),
      }),
    );
  }

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(NOW);
    serverClock.observe(NOW.toUTCString());
  });

  afterEach(() => {
    vi.useRealTimers();
    serverClock.observe(new Date().toUTCString());
  });

  it('draws a Happening now event as Upcoming’s card, its day of its days and Next up, and the rest as rows (sc-30413)', async () => {
    signedIn();
    answering({
      'GET /api/orgs/org_1/events': listed([
        live('Tonight', {
          phase: 'happening_now',
          startsAt: '2026-11-01T09:00:00+01:00',
          endsAt: '2026-11-03T02:00:00+01:00',
          timeZone: 'Europe/Madrid',
          milestones: [
            starts('Tonight starts', '2026-11-01T09:00:00+01:00'),
            starts('Tonight ends', '2026-11-03T02:00:00+01:00'),
          ],
        }),
        live('Later', { milestones: [starts('Later starts', '2026-11-14T16:00:00+01:00')] }),
      ]),
    });
    at('/app/events');

    const card = await screen.findByRole('region', { name: 'Tonight' });
    expect(spaced(card.textContent)).toBe(
      'Happening nowDay 1 of 3TonightSunday, Nov 1 to Tuesday, Nov 3 · Venue to be confirmedToday1Mon2Tue3Next up: Tonight endsTue, Nov 3, 02:00 · in 2 days',
    );
    expect(within(card).getAllByRole('link')).toHaveLength(1);
    expect(within(card).queryByRole('button')).toBeNull();
    expect(listedRows().map((row) => spaced(row.textContent))).toEqual([
      'LaterSaturday, Nov 14 to Sunday, Nov 15 · Venue to be confirmedin 13 days',
    ]);

    fireEvent.click(screen.getByRole('tab', { name: 'Past 0' }));
    expect(screen.queryByRole('region', { name: 'Tonight' })).toBeNull();
  });

  it("gives each counted event with invited guests its guest line, each figure its own link to that event's Guests (sc-3786)", async () => {
    signedIn();
    answering({
      'GET /api/orgs/org_1/events': listed([
        live('Wedding', {
          id: 'ev_wed',
          name: 'Adaeze & Tunde’s wedding',
          guests: { invited: 142, coming: 96, notReplied: 25 },
        }),
        live('Party', {
          startsAt: '2026-11-20T16:00:00+01:00',
          endsAt: '2026-11-20T22:00:00+01:00',
          guests: { invited: 3, coming: 0, notReplied: 3 },
        }),
        live('Nobody yet', {
          startsAt: '2026-11-21T16:00:00+01:00',
          endsAt: '2026-11-21T22:00:00+01:00',
          guests: { invited: 0, coming: 0, notReplied: 0 },
        }),
        live('Unread', {
          startsAt: '2026-11-22T16:00:00+01:00',
          endsAt: '2026-11-22T22:00:00+01:00',
          guests: null,
        }),
      ]),
    });
    at('/app/events');

    const card = await screen.findByRole('region', { name: 'Adaeze & Tunde’s wedding' });
    expect(within(card).getAllByRole('link')).toHaveLength(1);
    const coming = screen.getByRole('link', {
      name: '96 coming, opens the guests coming to Adaeze & Tunde’s wedding',
    });
    const notReplied = screen.getByRole('link', {
      name: '25 haven’t replied, opens the guests of Adaeze & Tunde’s wedding with no reply',
    });
    expect(coming.getAttribute('href')).toBe('/app/events/ev_wed/guests?filter=coming');
    expect(notReplied.getAttribute('href')).toBe('/app/events/ev_wed/guests?filter=noReply');
    expect(card.contains(coming)).toBe(false);

    const [party, nobody, unread] = listedRows();
    expect(
      within(party!)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual([expect.stringContaining('Party'), '0 coming', '3 haven’t replied']);
    expect(within(nobody!).getAllByRole('link')).toHaveLength(1);
    expect(within(unread!).getAllByRole('link')).toHaveLength(1);
  });

  it("changes an event's guest line in place when a reply lands, from one token for the listed events (sc-3786)", async () => {
    const before = config();
    const made: { url: string; onmessage: ((message: { data: string }) => void) | null }[] = [];
    class StubSource {
      static readonly CLOSED = 2;
      readyState = 0;
      onopen: (() => void) | null = null;
      onmessage: ((message: { data: string }) => void) | null = null;
      onerror: (() => void) | null = null;
      readonly url: string;

      constructor(url: string | URL) {
        this.url = String(url);
        made.push(this);
      }

      close(): void {
        this.readyState = StubSource.CLOSED;
      }
    }
    __setConfig({ ...before, mercureUrl: 'http://hub.test/.well-known/mercure' });
    vi.stubGlobal('EventSource', StubSource);
    onTestFinished(() => {
      __setConfig(before);
      vi.unstubAllGlobals();
    });
    signedIn();
    const hub = () =>
      json({ token: 'tok', expiresAt: new Date(Date.now() + 3_600_000).toISOString() });
    const headcounts = () => made.filter((one) => one.url.includes('headcount'));
    let figures = { invited: 142, coming: 96, notReplied: 25 };
    const sent = answering({
      'GET /api/orgs/org_1/events': (body, url) =>
        listed([
          live('Wedding', { id: 'ev_wed', guests: figures }),
          live('Unread', { guests: null }),
        ])(body, url),
      'POST /api/orgs/org_1/events/headcounts/subscriptions': hub,
      'POST /api/realtime/subscriptions': hub,
    });
    at('/app/events');

    await screen.findByRole('link', { name: /^96 coming,/u });
    await waitFor(() => expect(headcounts()).toHaveLength(1));
    expect(headcounts()[0]!.url).toContain('topic=events%2Fev_wed%2Fheadcount');
    expect(headcounts()[0]!.url).not.toContain('Unread');
    expect(
      sent.find((one) => one.line === 'POST /api/orgs/org_1/events/headcounts/subscriptions')?.body,
    ).toEqual({ events: ['ev_wed'] });

    figures = { invited: 142, coming: 97, notReplied: 24 };
    act(() => headcounts()[0]!.onmessage?.({ data: JSON.stringify({ headcount: {} }) }));

    expect(
      await screen.findByRole('link', { name: /^97 coming,/u }, { timeout: 3_000 }),
    ).toBeDefined();
    expect(screen.getByRole('link', { name: /^24 haven’t replied,/u })).toBeDefined();
  });

  it('says how soon each event starts, in days or today, and nothing once it has started, for a draft past its start or a finished event (sc-30413)', async () => {
    signedIn();
    answering({
      'GET /api/orgs/org_1/events': listed(
        [
          live('Soon', { startsAt: '2026-11-01T16:00:00Z', endsAt: '2026-11-01T20:00:00Z' }),
          live('Later', { startsAt: '2026-11-04T16:00:00Z', endsAt: '2026-11-04T20:00:00Z' }),
          event({ id: 'early', name: 'Early draft', startsAt: '2026-11-08T10:00:00Z' }),
          event({
            id: 'late',
            name: 'Late draft',
            startsAt: '2026-11-01T10:00:00Z',
            endsAt: '2026-11-01T14:00:00Z',
          }),
        ],
        finished(1),
      ),
    });
    at('/app/events');

    const soon = () =>
      [...screen.getByRole('tabpanel').querySelectorAll('.desk-glass, .ev-soon')].map(
        (one) => one.textContent,
      );
    await screen.findByRole('region', { name: 'Soon' });
    expect(soon()).toEqual(['Live', 'today', 'in 3 days']);

    fireEvent.click(screen.getByRole('tab', { name: 'Drafts 2' }));
    expect(soon()).toEqual(['Draft', 'in 7 days']);

    fireEvent.click(screen.getByRole('tab', { name: 'Past 1' }));
    expect(soon()).toEqual([]);
  });

  it('counts a Happening now event that started before today from its first day', async () => {
    signedIn();
    answering({
      'GET /api/orgs/org_1/events': listed([
        live('Weekend', {
          phase: 'happening_now',
          startsAt: '2026-10-31T09:00:00+01:00',
          endsAt: '2026-11-02T02:00:00+01:00',
          timeZone: 'Europe/Madrid',
          milestones: [starts('Weekend ends', '2026-11-02T02:00:00+01:00')],
        }),
      ]),
    });
    at('/app/events');

    const card = await screen.findByRole('region', { name: 'Weekend' });
    expect(
      [...card.querySelectorAll('.desk-glass, .ev-tile')].map((one) => spaced(one.textContent)),
    ).toEqual(['Happening now', 'Day 2 of 3', 'Sat31', 'Today1', 'Mon2']);
  });

  it('leaves Next up off the card with no milestone ahead', async () => {
    signedIn();
    answering({ 'GET /api/orgs/org_1/events': listed([live('Later')]) });
    at('/app/events');

    const card = await screen.findByRole('region', { name: 'Later' });

    expect(card.textContent).not.toContain('Next up');
    expect(listedRows()).toHaveLength(0);
  });

  it('counts each tab, Upcoming with the Paused, and moves between them by arrow keys', async () => {
    signedIn();
    answering({
      'GET /api/orgs/org_1/events': listed(
        [
          live('Later'),
          live('Paused', {
            status: 'paused',
            phase: 'paused',
            startsAt: '2026-11-10T16:00:00+01:00',
          }),
          event({ id: 'draft', name: 'Draft' }),
        ],
        finished(3),
        3,
      ),
    });
    at('/app/events');

    const upcoming = await screen.findByRole('tab', { name: 'Upcoming 2' });
    expect(upcoming.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByRole('tab', { name: 'Drafts 1' }).getAttribute('tabindex')).toBe('-1');
    expect(screen.getByRole('region', { name: 'Paused' })).toBeDefined();
    expect(rowNames()).toEqual(['Later']);

    fireEvent.keyDown(upcoming, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(screen.getByRole('tab', { name: 'Drafts 1' }));
    expect(screen.getByRole('tab', { name: 'Drafts 1' }).getAttribute('aria-selected')).toBe(
      'true',
    );

    fireEvent.keyDown(document.activeElement!, { key: 'End' });
    expect(screen.getByRole('tab', { name: 'Past 3' }).getAttribute('aria-selected')).toBe('true');

    fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(upcoming);
  });

  it('sums up what is happening, upcoming and in draft, and the footer counts the open tab, with no tiles (sc-30413)', async () => {
    signedIn();
    answering({
      'GET /api/orgs/org_1/events': listed(
        [
          live('Tonight', {
            phase: 'happening_now',
            startsAt: '2026-11-01T09:00:00+01:00',
            endsAt: '2026-11-01T23:00:00+01:00',
          }),
          live('Later'),
          live('Paused', { status: 'paused', phase: 'paused' }),
          event({ id: 'draft', name: 'Draft' }),
          event({ id: 'ended', name: 'Ended draft', endsAt: '2026-10-09T23:30:00+01:00' }),
        ],
        finished(14),
        14,
      ),
    });
    at('/app/events');

    expect(await screen.findByText('1 happening now · 2 upcoming · 2 drafts')).toBeDefined();
    expect(document.querySelector('.events-tile, .ev-tile-number')).toBeNull();
    expect(screen.getByRole('tab', { name: 'Upcoming 3' })).toBeDefined();
    expect(screen.getByText('3 events · Sorted by date')).toBeDefined();

    fireEvent.click(screen.getByRole('tab', { name: 'Drafts 2' }));
    expect(screen.getByText('2 events · Sorted by date')).toBeDefined();

    fireEvent.click(screen.getByRole('tab', { name: 'Past 14' }));
    expect(screen.getByText('14 events · Sorted by date')).toBeDefined();
  });

  it.each([
    ['a paused event', 'Upcoming', 'Resume', live('Paused', { status: 'paused', phase: 'paused' })],
    ['a draft', 'Drafts', 'Make live', event()],
    [
      'a draft past its end',
      'Drafts',
      'Change dates',
      event({ endsAt: '2026-10-09T23:30:00+01:00' }),
    ],
  ])(
    'offers %s its card step only with Manage events (sc-30413)',
    async (_what, tab, label, one) => {
      for (const [organisation, offered] of [
        [READER, false],
        [IRE, true],
      ] as const) {
        signedIn(organisation);
        answering({
          'GET /api/orgs/org_1/events': listed([{ ...one, permissions: organisation.permissions }]),
        });
        at('/app/events');
        fireEvent.click(await screen.findByRole('tab', { name: new RegExp(`^${tab}`) }));

        expect(screen.queryByRole('button', { name: label }) != null).toBe(offered);
        cleanup();
      }
    },
  );

  it('draws Past as rows, with no card', async () => {
    signedIn();
    answering({ 'GET /api/orgs/org_1/events': listed([live('Later')], finished(2), 2) });
    at('/app/events');
    fireEvent.click(await screen.findByRole('tab', { name: 'Past 2' }));

    expect(screen.queryByRole('region')).toBeNull();
    expect(rowNames()).toEqual(['Past 00', 'Past 01']);
  });

  it('leaves out each part of the summary at 0, the whole line with only past events, and the footer on an empty tab', async () => {
    signedIn();
    answering({ 'GET /api/orgs/org_1/events': listed([], finished(1), 1) });
    at('/app/events');

    await screen.findByRole('tab', { name: 'Upcoming 0' });

    expect(document.querySelector('.ev-top + .desk-line')).toBeNull();
    expect(screen.queryByText(/Sorted by date/)).toBeNull();

    fireEvent.click(screen.getByRole('tab', { name: 'Past 1' }));
    expect(screen.getByText('1 event · Sorted by date')).toBeDefined();
  });

  it.each([
    [
      'Upcoming',
      'Nothing coming up',
      'Events you make live show here, with the next thing each one needs.',
    ],
    [
      'Drafts',
      'No drafts',
      'New events stay drafts, visible only to your team, until you make them live.',
    ],
    [
      'Past',
      'Nothing finished yet',
      'Finished events stay here, so you can look back or start the next one from them.',
    ],
  ])('says %s is empty in its own words', async (tab, title, line) => {
    signedIn();
    answering({
      'GET /api/orgs/org_1/events': listed(
        tab === 'Upcoming' ? [event()] : [live('Later')],
        tab === 'Past' ? [] : finished(1),
      ),
    });
    at('/app/events');

    fireEvent.click(await screen.findByRole('tab', { name: new RegExp(`^${tab}`) }));

    expect(
      within(screen.getByRole('tabpanel')).getByRole('heading', { name: title }),
    ).toBeDefined();
    expect(screen.getByText(line)).toBeDefined();
  });

  it('counts every Finished event from the first page, and Show more loads ten more until there are none', async () => {
    signedIn();
    const sent = answering({ 'GET /api/orgs/org_1/events': listed([], finished(12), 12) });
    at('/app/events');

    fireEvent.click(await screen.findByRole('tab', { name: 'Past 12' }));
    expect(within(screen.getByRole('tabpanel')).getAllByRole('listitem')).toHaveLength(10);

    fireEvent.click(screen.getByRole('button', { name: 'Show more' }));

    await waitFor(() =>
      expect(within(screen.getByRole('tabpanel')).getAllByRole('listitem')).toHaveLength(12),
    );
    expect(screen.getByRole('tab', { name: 'Past 12' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull();
    expect(within(screen.getByRole('tabpanel')).getByRole('status').textContent).toBe(
      '2 more finished events shown.',
    );
    expect(sent.filter(({ line }) => line === 'GET /api/orgs/org_1/events')).toHaveLength(5);
  });

  it('reaches every Finished event, counted once, when one finishes between the first page and Show more', async () => {
    const tonight = live('Tonight', {
      startsAt: '2026-11-01T09:00:00Z',
      endsAt: '2026-11-01T12:00:30Z',
    });
    const past = finished(25);
    const ended = { ...tonight, status: 'ended', phase: 'finished', concludedAt: tonight.endsAt };
    let served: Record<string, unknown>[] = past;
    signedIn();
    answering({
      'GET /api/orgs/org_1/events': (body, url) =>
        listed([tonight], served, served.length)(body, url),
    });
    at('/app/events');
    fireEvent.click(await screen.findByRole('tab', { name: 'Past 25' }));

    served = [ended, ...past];
    await act(() => vi.advanceTimersByTimeAsync(30_000));
    expect(screen.getByRole('tab', { name: 'Past 26' })).toBeDefined();

    const items = () => within(screen.getByRole('tabpanel')).getAllByRole('listitem');
    fireEvent.click(screen.getByRole('button', { name: 'Show more' }));
    await waitFor(() => expect(items()).toHaveLength(20));
    fireEvent.click(screen.getByRole('button', { name: 'Show more' }));
    await waitFor(() => expect(items()).toHaveLength(26));

    expect(screen.getByRole('tab', { name: 'Past 26' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull();
  });

  it('offers no Show more with ten or fewer, and says when a call-off happened', async () => {
    signedIn();
    answering({
      'GET /api/orgs/org_1/events': listed(
        [],
        [
          event({
            name: 'Called off',
            status: 'ended',
            phase: 'finished',
            startsAt: '2026-12-01T10:00:00+01:00',
            concludedAt: '2026-09-30T10:00:00+01:00',
          }),
        ],
      ),
    });
    at('/app/events');

    fireEvent.click(await screen.findByRole('tab', { name: 'Past 1' }));

    expect(
      spaced(within(screen.getByRole('tabpanel')).getByRole('listitem').textContent),
    ).toContain('Called off on Sep 30');
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull();
  });

  it('marks an event Happening now at its start and moves it to Past at its end, with no reload', async () => {
    signedIn();
    const sent = answering({
      'GET /api/orgs/org_1/events': listed([
        live('Party', { startsAt: '2026-11-01T12:00:30Z', endsAt: '2026-11-01T12:01:00Z' }),
      ]),
    });
    at('/app/events');
    await screen.findByRole('tab', { name: 'Upcoming 1' });

    await act(() => vi.advanceTimersByTimeAsync(30_000));
    expect(
      within(screen.getByRole('region', { name: 'Party' })).getByText('Happening now'),
    ).toBeDefined();
    expect(screen.getByRole('tab', { name: 'Upcoming 1' })).toBeDefined();

    await act(() => vi.advanceTimersByTimeAsync(30_000));
    expect(screen.queryByRole('region', { name: 'Party' })).toBeNull();
    expect(screen.getByRole('tab', { name: 'Past 1' })).toBeDefined();
    expect(sent.filter(({ line }) => line === 'GET /api/orgs/org_1/events')).toHaveLength(4);
  });

  it('keeps the tab chosen when the person comes back, and opens on Upcoming after Switch organisation', async () => {
    const other = membership({ id: 'org_2', name: 'Other' });
    signedIn(IRE, [IRE, other]);
    answering({
      'GET /api/orgs/org_1/events': listed([event()]),
      'GET /api/orgs/org_2/events': listed([event({ organisationId: 'org_2' })]),
    });
    at('/app/events');
    fireEvent.click(await screen.findByRole('tab', { name: 'Drafts 1' }));
    cleanup();

    at('/app/events');
    expect(
      (await screen.findByRole('tab', { name: 'Drafts 1' })).getAttribute('aria-selected'),
    ).toBe('true');
    cleanup();

    switchOrganisation('org_2');
    at('/app/events');
    expect(
      (await screen.findByRole('tab', { name: 'Upcoming 0' })).getAttribute('aria-selected'),
    ).toBe('true');
    cleanup();

    switchOrganisation('org_1');
    at('/app/events');
    expect(
      (await screen.findByRole('tab', { name: 'Upcoming 0' })).getAttribute('aria-selected'),
    ).toBe('true');
  });
});

describe('New event', () => {
  function fill(id: string, value: string): void {
    fireEvent.change(document.getElementById(id)!, { target: { value } });
  }

  function create(): void {
    fireEvent.click(screen.getByRole('button', { name: 'Create event' }));
  }

  async function form(): Promise<void> {
    at('/app/events/new');
    await screen.findByRole('heading', { level: 1, name: 'New event' });
  }

  function errorUnder(id: string): string {
    const input = document.getElementById(id)!;
    const ids = (input.getAttribute('aria-describedby') ?? '').split(' ');

    return ids.map((one) => document.getElementById(one)?.textContent ?? '').join(' ');
  }

  it('names a 100-character organisation in a hint that can break inside the word (sc-486)', async () => {
    const name = 'A'.repeat(100);
    signedIn(membership({ ...IRE, name }));
    answering({});
    await form();

    const shown = within(screen.getByRole('main')).getAllByText(new RegExp(name, 'u'));

    expect(shown.filter((element) => !breaksAnywhere(element))).toEqual([]);
  });

  it('asks for the fields in order, the zone and currency from the organisation', async () => {
    signedIn();
    answering({});
    await form();

    const fields = [...document.querySelectorAll('form input, form select')].map(
      (field) => field.id,
    );

    expect(fields).toEqual([
      'event-name',
      'event-type',
      'cover-file',
      'event-start-date',
      'event-start-time',
      'event-end-date',
      'event-end-time',
      'event-venue-name',
      'event-venue-address',
      'event-time-zone',
      'event-currency',
    ]);
    expect(screen.getByLabelText<HTMLSelectElement>('Time zone').value).toBe('Africa/Lagos');
    expect(screen.getByLabelText<HTMLSelectElement>('Currency').value).toBe('NGN');
    expect(
      screen.getByText('An event can run past midnight. Choose the day it ends.'),
    ).toBeDefined();
  });

  it('starts Type on nothing chosen, then offers the fourteen in order, Other last (sc-3588)', async () => {
    signedIn();
    answering({});
    await form();

    const type = screen.getByLabelText<HTMLSelectElement>('Type');
    expect(type.value).toBe('');
    expect(type.selectedOptions[0]?.textContent).toBe('Choose what kind of event');
    expect([...type.options].slice(1).map((option) => option.textContent)).toEqual([
      'Wedding',
      'Birthday',
      'Anniversary',
      'Engagement',
      'Baby shower',
      'Graduation',
      'Memorial',
      'Religious celebration',
      'Cultural celebration',
      'Party',
      'Gala or fundraiser',
      'Conference',
      'Corporate event',
      'Other',
    ]);
  });

  it('counts the name as it is typed', async () => {
    signedIn();
    answering({});
    await form();

    expect(screen.getByText('0 of 120 characters')).toBeDefined();
    fill('event-name', '  Ìrè gala ');
    fill('event-type', 'party');
    expect(screen.getByText('8 of 120 characters')).toBeDefined();
  });

  it('fills the end date from the start date, and keeps one already chosen until it is cleared', async () => {
    signedIn();
    answering({});
    await form();

    fill('event-start-date', '0002-11-14');
    fill('event-start-date', '0020-11-14');
    fill('event-start-date', '2026-11-14');
    expect((document.getElementById('event-end-date') as HTMLInputElement).value).toBe(
      '2026-11-14',
    );

    fill('event-end-date', '2026-11-15');
    fill('event-start-date', '2026-11-13');
    expect((document.getElementById('event-end-date') as HTMLInputElement).value).toBe(
      '2026-11-15',
    );

    fill('event-end-date', '');
    fill('event-start-date', '2026-11-12');
    expect((document.getElementById('event-end-date') as HTMLInputElement).value).toBe(
      '2026-11-12',
    );
  });

  it('moves a set end with the start, keeping its length, and says so (sc-22144)', async () => {
    signedIn();
    answering({});
    await form();

    fill('event-start-date', '2026-11-14');
    fill('event-start-time', '16:00');
    fill('event-end-date', '2026-11-15');
    fill('event-end-time', '02:00');
    fill('event-start-time', '17:30');

    expect([
      (document.getElementById('event-end-date') as HTMLInputElement).value,
      (document.getElementById('event-end-time') as HTMLInputElement).value,
    ]).toEqual(['2026-11-15', '03:30']);
    expect(screen.getByRole('status').textContent).toBe(
      'Ends moved with the start, to Sun, Nov 15, 03:30.',
    );
  });

  it('keeps the length through a start cleared and typed again (sc-22144)', async () => {
    signedIn();
    answering({});
    await form();

    fill('event-start-date', '2026-11-14');
    fill('event-start-time', '16:00');
    fill('event-end-date', '2026-11-15');
    fill('event-end-time', '02:00');
    fill('event-start-date', '');
    fill('event-start-date', '2026-11-21');

    expect([
      (document.getElementById('event-end-date') as HTMLInputElement).value,
      (document.getElementById('event-end-time') as HTMLInputElement).value,
    ]).toEqual(['2026-11-22', '02:00']);
  });

  it('stops saying the end moved once Create event is pressed (sc-22144)', async () => {
    signedIn();
    answering({});
    await form();

    fill('event-start-date', '2026-11-14');
    fill('event-start-time', '16:00');
    fill('event-end-date', '2026-11-15');
    fill('event-end-time', '02:00');
    fill('event-type', 'party');
    fill('event-start-time', '17:30');
    create();
    expect(screen.getByRole('status').textContent).toBe(
      '1 field needs fixing, so nothing was sent.',
    );

    fill('event-name', 'Launch night');
    create();

    expect(screen.getByRole('status').textContent).toBe('');
  });

  it('sends nothing for a blank name, says so beside it and moves focus to it', async () => {
    signedIn();
    const sent = answering({});
    await form();

    fill('event-name', '   ');
    fill('event-type', 'party');
    fill('event-start-date', '2026-11-14');
    fill('event-start-time', '16:00');
    fill('event-end-time', '23:00');
    create();

    const name = document.getElementById('event-name')!;
    await waitFor(() => expect(document.activeElement).toBe(name));
    expect(name.getAttribute('aria-invalid')).toBe('true');
    expect(name.className).toContain('input-wrong');
    expect(errorUnder('event-name')).toContain('Give the event a name.');
    expect(screen.getByRole('status').textContent).toBe(
      '1 field needs fixing, so nothing was sent.',
    );
    expect(sent.filter(({ line }) => line.startsWith('POST'))).toEqual([]);
  });

  it('shows every problem at once and moves focus to the first', async () => {
    signedIn();
    const sent = answering({});
    await form();

    fill('event-name', 'Gala');
    create();

    const type = document.getElementById('event-type')!;
    await waitFor(() => expect(document.activeElement).toBe(type));
    expect(type.getAttribute('aria-invalid')).toBe('true');
    expect(errorUnder('event-type')).toContain('Choose what kind of event it is.');
    expect(errorUnder('event-start-date')).toContain('Choose when the event starts.');
    expect(errorUnder('event-end-date')).toContain('Choose when the event ends.');
    expect(screen.getByRole('status').textContent).toBe(
      '3 fields need fixing, so nothing was sent.',
    );
    expect(sent.filter(({ line }) => line.startsWith('POST'))).toEqual([]);
  });

  it('starts on no currency for an organisation holding one no longer in use, and sends nothing until one is chosen', async () => {
    signedIn(
      membership({ ...IRE, countryCode: 'SL', currency: 'SLL', timezone: 'Africa/Freetown' }),
    );
    const sent = answering({});
    await form();

    const currency = screen.getByLabelText<HTMLSelectElement>('Currency');
    expect(currency.value).toBe('');
    expect(currency.selectedOptions[0]?.textContent).toBe('Choose a currency');
    expect([...currency.options].map((option) => option.value)).not.toContain('SLL');

    fill('event-name', 'Gala');
    fill('event-type', 'party');
    fill('event-start-date', '2026-11-14');
    fill('event-start-time', '16:00');
    fill('event-end-time', '23:00');
    create();

    await waitFor(() => expect(document.activeElement).toBe(currency));
    expect(errorUnder('event-currency')).toContain('Choose a currency.');
    expect(screen.getByRole('status').textContent).toBe(
      '1 field needs fixing, so nothing was sent.',
    );
    expect(sent.filter(({ line }) => line.startsWith('POST'))).toEqual([]);
  });

  it('refuses an end before the start under Ends, and accepts an end equal to it', async () => {
    signedIn();
    const sent = answering({
      'POST /api/orgs/org_1/events': () => json({ event: event() }, 201),
      'GET /api/events/ev_1': () => json({ event: event() }),
    });
    await form();

    fill('event-name', 'Gala');
    fill('event-type', 'party');
    fill('event-start-date', '2026-11-14');
    fill('event-start-time', '16:00');
    fill('event-end-time', '15:30');
    create();

    const end = document.getElementById('event-end-date')!;
    await waitFor(() => expect(document.activeElement).toBe(end));
    expect(errorUnder('event-end-time')).toContain(
      'The end is before the start. Choose a later end.',
    );

    fill('event-end-time', '16:00');
    create();

    await waitFor(() =>
      expect(sent.find(({ line }) => line.startsWith('POST'))?.body).toEqual({
        name: 'Gala',
        type: 'party',
        startsAt: '2026-11-14T16:00',
        endsAt: '2026-11-14T16:00',
        timeZone: 'Africa/Lagos',
        currency: 'NGN',
        hosts: [],
      }),
    );
  });

  it('creates the event with the chosen zone and currency and opens its page', async () => {
    signedIn();
    const sent = answering({
      'POST /api/orgs/org_1/events': () => json({ event: event() }, 201),
      'GET /api/events/ev_1': () => json({ event: event() }),
    });
    await form();

    fill('event-name', '  Adaeze and Tunde ');
    fill('event-type', 'party');
    fill('event-start-date', '2026-11-14');
    fill('event-start-time', '16:00');
    fill('event-end-date', '2026-11-15');
    fill('event-end-time', '02:00');
    fill('event-time-zone', 'Europe/London');
    fill('event-currency', 'GBP');
    create();

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Adaeze and Tunde' }),
    ).toBeDefined();
    expect(sent.find(({ line }) => line.startsWith('POST'))).toEqual({
      line: 'POST /api/orgs/org_1/events',
      body: {
        name: 'Adaeze and Tunde',
        type: 'party',
        startsAt: '2026-11-14T16:00',
        endsAt: '2026-11-15T02:00',
        timeZone: 'Europe/London',
        currency: 'GBP',
        hosts: [],
      },
    });
  });

  it('asks before leaving with what was typed, and leaves when told to (sc-22147)', async () => {
    signedIn();
    answering({ 'GET /api/orgs/org_1/events': listed([]) });
    await form();

    fill('event-name', 'Owambe');
    fireEvent.click(document.querySelector('.event-back')!);

    const dialog = await screen.findByRole('alertdialog', { name: 'Leave without saving?' });
    expect(within(dialog).getByText('What you typed for this event will be lost.')).toBeDefined();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Leave without saving' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Events' })).toBeDefined();
  });

  it('keeps everything as it was typed when editing goes on (sc-22147)', async () => {
    signedIn();
    answering({});
    await form();

    fill('event-name', 'Owambe');
    fill('event-type', 'wedding');
    fill('event-currency', 'GBP');
    fireEvent.click(
      within(document.querySelector<HTMLElement>('.shell-sidebar')!).getByRole('link', {
        name: 'Events',
      }),
    );
    fireEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Keep editing' }),
    );

    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(screen.getByRole('heading', { level: 1, name: 'New event' })).toBeDefined();
    expect(screen.getByLabelText<HTMLInputElement>('Event name').value).toBe('Owambe');
    expect(screen.getByLabelText<HTMLSelectElement>('Type').value).toBe('wedding');
    expect(screen.getByLabelText<HTMLSelectElement>('Currency').value).toBe('GBP');
  });

  it('leaves at once when nothing was typed (sc-22147)', async () => {
    signedIn();
    answering({ 'GET /api/orgs/org_1/events': listed([]) });
    await form();

    fireEvent.click(document.querySelector('.event-back')!);

    expect(await screen.findByRole('heading', { level: 1, name: 'Events' })).toBeDefined();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('has the browser ask on reload only once something is typed (sc-22147)', async () => {
    signedIn();
    answering({});
    await form();

    const untouched = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(untouched);
    expect(untouched.defaultPrevented).toBe(false);

    fill('event-name', 'Owambe');
    const typed = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(typed);
    expect(typed.defaultPrevented).toBe(true);
  });

  it("shows the server's refusals under the same fields, focus on the first", async () => {
    signedIn();
    answering({
      'POST /api/orgs/org_1/events': () =>
        problem(422, 'validation_failed', {
          violations: [
            {
              propertyPath: 'endsAt',
              message: 'The end is before the start. Choose a later end.',
              code: 'end_before_start',
            },
            {
              propertyPath: 'name',
              message: 'Shorten the name to 120 characters or fewer.',
              code: 'too_long',
            },
          ],
        }),
    });
    await form();

    fill('event-name', 'Gala');
    fill('event-type', 'party');
    fill('event-start-date', '2026-11-14');
    fill('event-start-time', '16:00');
    fill('event-end-time', '18:00');
    create();

    const name = document.getElementById('event-name')!;
    await waitFor(() => expect(document.activeElement).toBe(name));
    expect(errorUnder('event-name')).toContain('Shorten the name to 120 characters or fewer.');
    expect(errorUnder('event-end-date')).toContain(
      'The end is before the start. Choose a later end.',
    );
    expect(screen.queryByText('Not created. Nothing was saved. Try again.')).toBeNull();
  });

  it('says it was not created when saving fails, keeping everything typed', async () => {
    signedIn();
    answering({
      'POST /api/orgs/org_1/events': () => {
        throw new TypeError('Failed to fetch');
      },
    });
    await form();

    fill('event-name', 'Gala');
    fill('event-type', 'party');
    fill('event-start-date', '2026-11-14');
    fill('event-start-time', '16:00');
    fill('event-end-time', '18:00');
    fill('event-currency', 'EUR');
    create();

    expect((await screen.findByRole('alert')).textContent).toContain(
      'Not created. Nothing was saved. Try again.',
    );
    expect((document.getElementById('event-name') as HTMLInputElement).value).toBe('Gala');
    expect((document.getElementById('event-end-time') as HTMLInputElement).value).toBe('18:00');
    expect(screen.getByLabelText<HTMLSelectElement>('Currency').value).toBe('EUR');
  });

  describe('Hosted by (sc-22143)', () => {
    function hosts(): HTMLElement {
      return screen.getByRole('region', { name: 'Hosted by' });
    }

    function fillWhen(): void {
      fill('event-type', 'party');
      fill('event-start-date', '2026-11-14');
      fill('event-start-time', '16:00');
      fill('event-end-time', '18:00');
    }

    it('sits after Type and before When with one empty Host 1 that can be removed', async () => {
      signedIn();
      answering({});
      await form();

      expect(within(hosts()).getByLabelText('Host 1')).toBeDefined();
      expect(within(hosts()).queryAllByRole('textbox')).toHaveLength(1);
      expect(within(hosts()).getByRole('button', { name: 'Remove Host 1' })).toBeDefined();
      expect(
        within(hosts()).getByText(
          'Guests read these names on their invitation and their page, in this order. Write them the way you want guests to see them.',
        ),
      ).toBeDefined();

      fireEvent.click(within(hosts()).getByRole('button', { name: 'Remove Host 1' }));

      expect(
        within(hosts()).getByText(
          'No hosts yet. The event can be made live once it has at least one.',
        ),
      ).toBeDefined();
    });

    it('creates the event with its hosts, cleaned and in their order, in one request', async () => {
      signedIn();
      const sent = answering({
        'POST /api/orgs/org_1/events': () => json({ event: event() }, 201),
        'GET /api/events/ev_1': () => json({ event: event() }),
      });
      await form();

      fill('event-name', 'Gala');
      fillWhen();
      fill('event-host-0', '  Funmi\nAdeyemi ');
      fireEvent.click(within(hosts()).getByRole('button', { name: 'Add a host' }));
      fill('event-host-1', 'Tayo Adeyemi');
      create();

      await screen.findByRole('heading', { level: 1, name: 'Adaeze and Tunde' });
      const posts = sent.filter(({ line }) => line === 'POST /api/orgs/org_1/events');
      expect(posts).toHaveLength(1);
      expect(posts[0]?.body).toMatchObject({ hosts: ['Funmi Adeyemi', 'Tayo Adeyemi'] });
    });

    it('refuses an empty row once there are two, with every message at once, focus on the first in order', async () => {
      signedIn();
      const sent = answering({});
      await form();

      fillWhen();
      fireEvent.click(within(hosts()).getByRole('button', { name: 'Add a host' }));
      fill('event-host-1', 'é'.repeat(61));
      create();

      const name = document.getElementById('event-name')!;
      await waitFor(() => expect(document.activeElement).toBe(name));
      expect(errorUnder('event-host-0')).toContain('Enter a name or remove this host.');
      expect(errorUnder('event-host-1')).toContain(
        "A host's name can be at most 60 characters. This one has 61.",
      );
      expect(sent.map(({ line }) => line)).not.toContain('POST /api/orgs/org_1/events');

      fill('event-name', 'Gala');
      create();

      await waitFor(() =>
        expect(document.activeElement).toBe(document.getElementById('event-host-0')),
      );
      expect(sent.map(({ line }) => line)).not.toContain('POST /api/orgs/org_1/events');
    });

    it("shows the server's refusal under the row it names, creating nothing", async () => {
      signedIn();
      answering({
        'POST /api/orgs/org_1/events': () =>
          problem(422, 'validation_failed', {
            violations: [
              { propertyPath: 'hosts[1]', message: 'Refused by the server.', code: 'invalid' },
            ],
          }),
      });
      await form();

      fill('event-name', 'Gala');
      fillWhen();
      fill('event-host-0', 'Funmi Adeyemi');
      fireEvent.click(within(hosts()).getByRole('button', { name: 'Add a host' }));
      fill('event-host-1', 'Tayo Adeyemi');
      create();

      const second = document.getElementById('event-host-1')!;
      await waitFor(() => expect(document.activeElement).toBe(second));
      expect(errorUnder('event-host-1')).toContain('Refused by the server.');
      expect((second as HTMLTextAreaElement).value).toBe('Tayo Adeyemi');
    });
  });

  it('is not offered to a role without Create events', async () => {
    signedIn(READER);
    answering({});
    at('/app/events/new');

    expect(await screen.findByText('You do not have access to this')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Create event' })).toBeNull();
  });
});

describe('A time the clocks skip, in New event (sc-10638)', () => {
  const START_SKIPPED =
    'There is no 02:30 on Sun, Mar 28 in Europe/Paris: the clocks go forward that night. It will be saved as 03:30.';

  function fill(id: string, value: string): void {
    fireEvent.change(document.getElementById(id)!, { target: { value } });
  }

  function described(element: string | Element): string {
    const owner = typeof element === 'string' ? document.getElementById(element)! : element;
    const ids = (owner.getAttribute('aria-describedby') ?? '').split(' ');

    return ids.map((one) => document.getElementById(one)?.textContent ?? '').join(' ');
  }

  async function form(zone = 'Europe/Paris'): Promise<void> {
    signedIn(membership({ ...IRE, timezone: zone }));
    at('/app/events/new');
    await screen.findByRole('heading', { level: 1, name: 'New event' });
  }

  it('says so under Starts after a typed time and a typed date, and goes once out of the gap', async () => {
    answering({});
    await form();

    const region = document.getElementById('event-start-gap')!;
    const starts = region.closest('fieldset')!;
    expect(region.getAttribute('aria-live')).toBe('polite');
    expect(region.textContent).toBe('');
    expect(starts.hasAttribute('aria-describedby')).toBe(false);

    fill('event-start-time', '02:30');
    expect(screen.queryByText(START_SKIPPED)).toBeNull();
    fill('event-start-date', '2027-03-28');

    expect(gapLine('event-start-gap')).toBe(START_SKIPPED);
    expect(document.getElementById('event-start-gap')).toBe(region);
    expect(described(starts)).toContain(START_SKIPPED);
    expect(described('event-start-date')).toContain(START_SKIPPED);
    expect(described('event-start-time')).toContain(START_SKIPPED);
    expect(document.getElementById('event-start-time')!.getAttribute('aria-invalid')).toBe('false');

    fill('event-start-date', '2027-03-27');
    expect(gapLine('event-start-gap')).toBe('');
    expect(starts.hasAttribute('aria-describedby')).toBe(false);
  });

  it('shows it under Starts and Ends at once, keeping the Ends hint', async () => {
    answering({});
    await form();

    const ends = document.getElementById('event-end-gap')!.closest('fieldset')!;
    expect(ends.hasAttribute('aria-describedby')).toBe(false);

    fill('event-start-date', '2027-03-28');
    fill('event-start-time', '02:00');
    fill('event-end-time', '02:45');

    expect(gapLine('event-start-gap')).toContain('It will be saved as 03:00.');
    expect(gapLine('event-end-gap')).toContain('It will be saved as 03:45.');
    expect(described(ends)).toContain('It will be saved as 03:45.');
    expect(described('event-end-time')).toContain(
      'An event can run past midnight. Choose the day it ends.',
    );

    fill('event-end-time', '04:00');
    expect(gapLine('event-end-gap')).toBe('');
    expect(ends.hasAttribute('aria-describedby')).toBe(false);
  });

  it("writes the night in the browser's regional order, as the event's page does", async () => {
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('en-GB');
    answering({});
    await form();

    fill('event-start-date', '2027-03-28');
    fill('event-start-time', '02:30');

    expect(gapLine('event-start-gap')).toBe(
      'There is no 02:30 on Sun 28 Mar in Europe/Paris: the clocks go forward that night. It will be saved as 03:30.',
    );
  });

  it('names a gap that is not an hour long', async () => {
    answering({});
    await form('Australia/Lord_Howe');

    fill('event-start-date', '2027-10-03');
    fill('event-start-time', '02:15');

    expect(gapLine('event-start-gap')).toBe(
      'There is no 02:15 on Sun, Oct 3 in Australia/Lord_Howe: the clocks go forward that night. It will be saved as 02:45.',
    );
  });

  it('names the day too when the saved time falls on the next one', async () => {
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('en-GB');
    answering({});
    await form('America/Scoresbysund');

    fill('event-start-date', '2027-03-27');
    fill('event-start-time', '23:30');

    expect(gapLine('event-start-gap')).toBe(
      'There is no 23:30 on Sat 27 Mar in America/Scoresbysund: the clocks go forward that night. It will be saved as 00:30 on Sun 28 Mar.',
    );
  });

  it('says nothing in the hour the clocks repeat, nor without a zone', async () => {
    answering({});
    await form();

    fill('event-start-date', '2027-10-31');
    fill('event-start-time', '02:30');
    expect(gapLine('event-start-gap')).toBe('');

    fill('event-start-date', '2027-03-28');
    fill('event-time-zone', '');
    expect(gapLine('event-start-gap')).toBe('');
  });

  it('does not stop the save, and sends the time as typed', async () => {
    const sent = answering({
      'POST /api/orgs/org_1/events': () => json({ event: event() }, 201),
      'GET /api/events/ev_1': () => json({ event: event() }),
    });
    await form();

    fill('event-name', 'Gala');
    fill('event-type', 'party');
    fill('event-start-date', '2027-03-28');
    fill('event-start-time', '02:30');
    fill('event-end-time', '05:00');
    fireEvent.click(screen.getByRole('button', { name: 'Create event' }));

    await waitFor(() =>
      expect(sent.find(({ line }) => line.startsWith('POST'))?.body).toMatchObject({
        startsAt: '2027-03-28T02:30',
        endsAt: '2027-03-28T05:00',
        timeZone: 'Europe/Paris',
      }),
    );
  });

  it('refuses a start the gap moves past the end, keeping the notice under Starts', async () => {
    const sent = answering({});
    await form();

    fill('event-name', 'Gala');
    fill('event-type', 'party');
    fill('event-start-date', '2027-03-28');
    fill('event-start-time', '02:30');
    fill('event-end-time', '03:15');
    fireEvent.click(screen.getByRole('button', { name: 'Create event' }));

    await waitFor(() =>
      expect(described('event-end-time')).toContain(
        'The end is before the start. Choose a later end.',
      ),
    );
    expect(gapLine('event-start-gap')).toBe(START_SKIPPED);
    expect(sent.filter(({ line }) => line.startsWith('POST'))).toEqual([]);
  });
});

describe("Inside an event, the navigation menu is the event's (sc-22103)", () => {
  const AREAS = [
    'Overview',
    'Guests',
    'Menu',
    'Seating',
    'Messages',
    'Schedule',
    'Staff',
    'People',
    'Budget',
    'Reports',
  ];

  function eventNav() {
    return within(screen.getByRole('navigation', { name: 'Event' }));
  }

  function current(): string | null {
    return document.querySelector('[aria-current="page"]')?.textContent ?? null;
  }

  it('holds ‹ Events and the nine areas in place of the app’s entries, with Settings and the person kept', async () => {
    signedIn();
    answering({ 'GET /api/events/ev_1': () => json({ event: event() }) });
    at('/app/events/ev_1');
    await screen.findByRole('heading', { level: 1, name: 'Adaeze and Tunde' });

    expect(
      eventNav()
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Events', ...AREAS]);
    expect(current()).toBe('Overview');
    expect(screen.queryByRole('link', { name: 'Today' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Calendar' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Settings' })).toBeDefined();
    expect(screen.getByRole('link', { name: /^Folake Adeyemi/ })).toBeDefined();
  });

  it('opens an area that is not built as a panel saying it is coming, with nothing to press, and marks it current', async () => {
    signedIn();
    answering({ 'GET /api/events/ev_1': () => json({ event: event() }) });
    at('/app/events/ev_1');
    await screen.findByRole('heading', { level: 1, name: 'Adaeze and Tunde' });

    fireEvent.click(eventNav().getByRole('link', { name: 'Menu' }));

    const panel = (await screen.findByRole('heading', { level: 2, name: 'Menu' })).closest(
      'section',
    )!;
    expect(within(panel).getByText('The menu for this event is coming.')).toBeDefined();
    expect(within(panel).queryAllByRole('button')).toHaveLength(0);
    expect(within(panel).queryAllByRole('link')).toHaveLength(0);
    expect(screen.getByRole('heading', { level: 1, name: 'Adaeze and Tunde' })).toBeDefined();
    expect(current()).toBe('Menu');
  });

  it.each([
    ['/app/events/ev_1/guests', 'Guests'],
    ['/app/events/ev_1/dates', 'Overview'],
  ])('marks the area of %s as current', async (path, area) => {
    signedIn();
    answering({ 'GET /api/events/ev_1': () => json({ event: event({ milestones: [] }) }) });
    at(path);
    await screen.findByRole('navigation', { name: 'Event' });

    expect(current()).toBe(area);
  });

  it.each(['/app/events/ev_1', '/app/events/ev_1/guests', '/app/events/ev_1/menu'])(
    'heads the menu on %s with the event’s card: its name, its phase and how soon (sc-30413)',
    async (path) => {
      signedIn();
      answering({
        'GET /api/events/ev_1': () =>
          json({
            event: event({
              status: 'live',
              phase: 'live',
              madeLiveAt: '2026-10-21T10:00:00+00:00',
              startsAt: '2030-06-01T16:00:00+01:00',
              endsAt: '2030-06-02T02:00:00+01:00',
              milestones: [],
            }),
          }),
      });
      at(path);

      const nav = within(await screen.findByRole('navigation', { name: 'Event' }));
      const card = (await nav.findByText('Adaeze and Tunde')).closest('.ev-side-card')!;
      expect(card.textContent).toMatch(/^Adaeze and TundeLive · \S/u);
    },
  );

  it('returns to the page on Overview by Back, however many areas were chosen on the way', async () => {
    signedIn();
    answering({ 'GET /api/events/ev_1': () => json({ event: event() }) });
    const router = createMemoryRouter(routes, {
      initialEntries: ['/app/events', '/app/events/ev_1'],
      initialIndex: 1,
    });
    render(<RouterProvider router={router} />);
    await screen.findByRole('heading', { level: 1, name: 'Adaeze and Tunde' });

    fireEvent.click(eventNav().getByRole('link', { name: 'Menu' }));
    await screen.findByRole('heading', { level: 2, name: 'Menu' });
    fireEvent.click(eventNav().getByRole('link', { name: 'Staff' }));
    await screen.findByRole('heading', { level: 2, name: 'Staff' });
    fireEvent.click(eventNav().getByRole('link', { name: 'Reports' }));
    await screen.findByRole('heading', { level: 2, name: 'Reports' });

    await act(() => router.navigate(-1));

    await waitFor(() => expect(router.state.location.pathname).toBe('/app/events/ev_1'));
    expect(current()).toBe('Overview');

    await act(() => router.navigate(-1));
    await waitFor(() => expect(router.state.location.pathname).toBe('/app/events'));
  });

  it('leaves for Events on the tab that holds the event, with the app’s navigation back', async () => {
    signedIn();
    answering({
      'GET /api/events/ev_1': () => json({ event: event() }),
      'GET /api/orgs/org_1/events': listed([event()]),
    });
    at('/app/events/ev_1');
    await screen.findByRole('heading', { level: 1, name: 'Adaeze and Tunde' });

    fireEvent.click(eventNav().getByRole('link', { name: 'Events' }));

    expect(
      (await screen.findByRole('tab', { name: 'Drafts 1' })).getAttribute('aria-selected'),
    ).toBe('true');
    expect(screen.queryByRole('navigation', { name: 'Event' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Events' }).getAttribute('aria-current')).toBe('page');
  });
});

describe("An event's Overview (sc-22103)", () => {
  const PAST = { startsAt: '2020-11-14T16:00:00+01:00', endsAt: '2020-11-15T02:00:00+01:00' };

  it('opens on Details, Coming up, and Name and cover, beside Just for you and Manage (sc-30413)', async () => {
    signedIn();
    answering({ 'GET /api/events/ev_1': () => json({ event: event() }) });
    at('/app/events/ev_1');
    await screen.findByRole('heading', { level: 1, name: 'Adaeze and Tunde' });

    expect(screen.queryByRole('list', { name: 'Overview' })).toBeNull();
    expect(
      screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent),
    ).toEqual(['Details', 'Coming up', 'Name and cover', 'Guests', 'Just for you', 'Manage']);
    for (const label of ['On track', 'Replies', 'Needs you', 'Team on this event'])
      expect(screen.queryByRole('region', { name: label })).toBeNull();
    expect(await screen.findByText('No guests invited yet')).toBeDefined();
    expect(screen.queryByText('Invited')).toBeNull();
    expect(
      within(screen.getByRole('navigation', { name: 'Breadcrumb' }))
        .getAllByRole('listitem')
        .map((part) => part.textContent),
    ).toEqual(['Events', 'Adaeze and Tunde']);
  });

  it("counts the event's guests as rows, each opening the guests it counts, then those not yet invited (sc-3786)", async () => {
    signedIn();
    answering({
      'GET /api/events/ev_1': () => json({ event: event() }),
      'GET /api/events/ev_1/headcount': () =>
        json({
          headcount: headcountOf({
            onList: 156,
            notYetInvited: 14,
            invited: 142,
            accepted: 96,
            maybe: 10,
            awaitingReply: 21,
            held: 6,
            declined: 9,
          }),
        }),
    });
    at('/app/events/ev_1');

    const guests = await screen.findByRole('region', { name: 'Guests' });
    await within(guests).findByText(
      '96 coming of 142 invited. Each number opens the guests it counts.',
    );
    expect(
      within(guests)
        .getAllByRole('link')
        .map((link) => [
          link.getAttribute('aria-label') ?? link.textContent,
          link.getAttribute('href'),
        ]),
    ).toEqual([
      ['Open the guest list', '/app/events/ev_1/guests'],
      [
        '142 invited, opens the guest list showing invited guests',
        '/app/events/ev_1/guests?filter=invited',
      ],
      ['96 Coming, opens Coming', '/app/events/ev_1/guests?filter=coming'],
      ['9 Not coming, opens Not coming', '/app/events/ev_1/guests?filter=notComing'],
      ['10 Not sure yet, opens Not sure yet', '/app/events/ev_1/guests?filter=maybe'],
      ['21 No reply, opens No reply', '/app/events/ev_1/guests?filter=noReply'],
      ['6 Held, opens Held', '/app/events/ev_1/guests?filter=held'],
      [
        '14 not yet invited, opens the guest list showing guests not yet invited',
        '/app/events/ev_1/guests?filter=notYetInvited',
      ],
    ]);
    const notYet = within(guests).getByRole('link', { name: /14 not yet invited/ });
    expect(notYet.querySelector('.gs-mark')?.className).toBe('gs-mark is-not-yet is-16');
  });

  it('shows no guest numbers without guests.read, and says when they did not load (sc-3786)', async () => {
    signedIn();
    answering({
      'GET /api/events/ev_1': () =>
        json({ event: event({ permissions: holding.filter((one) => one !== 'guests.read') }) }),
    });
    at('/app/events/ev_1');
    await screen.findByRole('heading', { level: 1, name: 'Adaeze and Tunde' });
    expect(screen.queryByRole('region', { name: 'Guests' })).toBeNull();

    cleanup();
    let reads = 0;
    answering({
      'GET /api/events/ev_1': () => json({ event: event() }),
      'GET /api/events/ev_1/headcount': () =>
        (reads += 1) === 1 ? problem(500, 'internal') : json({ headcount: headcountOf() }),
    });
    at('/app/events/ev_1');

    const refused = await screen.findByText('Guest numbers did not load.');
    expect(refused.closest('[role=alert]')).not.toBeNull();
    fireEvent.click(
      within(screen.getByRole('region', { name: 'Guests' })).getByRole('button', {
        name: 'Try again',
      }),
    );
    expect(await screen.findByText('No guests invited yet')).toBeDefined();
  });

  it('reads each part as its value over its label', async () => {
    signedIn();
    answering({ 'GET /api/events/ev_1': () => json({ event: event() }) });
    at('/app/events/ev_1');

    const details = await screen.findByRole('region', { name: 'Details' });
    expect(
      within(details)
        .getAllByRole('button')
        .map((row) => spaced(row.textContent)),
    ).toEqual([
      expect.stringMatching(/Dates · 2 days · Africa\/Lagos$/u),
      'Replies stay open until the event startsReply by',
      'Venue to be confirmedVenue',
      'Funmi AdeyemiHosted by',
      'WeddingType',
      expect.stringMatching(/^NGN · .+Currency$/u),
    ]);
    expect(
      within(screen.getByRole('region', { name: 'Name and cover' }))
        .getAllByRole('button')
        .map((row) => spaced(row.textContent)),
    ).toEqual(['Adaeze and TundeEvent name', 'Default coverCover']);
  });

  it('reads Reply by as the day and the time replies close, in the event’s zone (sc-3780)', async () => {
    signedIn();
    answering({
      'GET /api/events/ev_1': () =>
        json({
          event: event({
            replyBy: '2030-11-10',
            repliesCloseAt: '2030-11-10T23:59:59+01:00',
            repliesClosedOn: null,
          }),
        }),
    });
    at('/app/events/ev_1');

    const details = await screen.findByRole('region', { name: 'Details' });
    expect(within(details).getByText('Sun, Nov 10, 2030')).toBeDefined();
    expect(
      within(details).getByText(/^Reply by · Replies close at 23:59, Africa\/Lagos time$/u),
    ).toBeDefined();
  });

  it('says there are no hosts yet in Hosted by', async () => {
    signedIn();
    answering({ 'GET /api/events/ev_1': () => json({ event: event({ hosts: [] }) }) });
    at('/app/events/ev_1');

    const details = await screen.findByRole('region', { name: 'Details' });
    expect(within(details).getByText('No hosts yet')).toBeDefined();
    expect(
      within(details).getByText('Hosted by · The event can be made live once it has at least one.'),
    ).toBeDefined();
  });

  it('gives a Read-only member rows that open nothing, no primary, and no Manage', async () => {
    signedIn(READER);
    answering({ 'GET /api/events/ev_1': () => json({ event: event() }) });
    at('/app/events/ev_1');

    const details = await screen.findByRole('region', { name: 'Details' });
    expect(within(details).queryAllByRole('button')).toEqual([]);
    expect(within(details).queryAllByRole('link')).toEqual([]);
    expect(screen.queryByRole('button', { name: 'Make live' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Manage' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Just for you' })).toBeDefined();
  });

  it('lists in Manage each step that changes the whole event, over what it does', async () => {
    signedIn();
    answering({
      'GET /api/events/ev_1': () =>
        json({
          event: event({
            startsAt: '2030-11-14T16:00:00+01:00',
            endsAt: '2030-11-15T02:00:00+01:00',
            status: 'live',
            phase: 'live',
            madeLiveAt: '2026-10-26T15:00:00+00:00',
          }),
        }),
    });
    at('/app/events/ev_1');

    const manage = await screen.findByRole('region', { name: 'Manage' });
    expect(
      within(manage)
        .getAllByRole('button')
        .map((step) => [step.textContent, step.getAttribute('aria-describedby') != null]),
    ).toEqual([
      ['Duplicate', true],
      ['Pause', true],
      ['Call off…', true],
      ['Delete event…', true],
    ]);
    expect(within(manage).getByRole('button', { name: 'Call off…' }).className).toContain('is-red');
  });

  it('offers Duplicate as the card’s step on a Finished event, opening its question, and keeps it in Manage (sc-30413)', async () => {
    signedIn();
    answering({
      'GET /api/events/ev_1': () =>
        json({ event: event({ ...PAST, status: 'ended', phase: 'finished' }) }),
    });
    at('/app/events/ev_1');

    const heading = await screen.findByRole('heading', { level: 1, name: 'Adaeze and Tunde' });
    const duplicate = within(heading.closest('section')!).getByRole('button', {
      name: 'Duplicate',
    });
    expect(duplicate.className).toContain('desk-step');
    expect(
      within(screen.getByRole('region', { name: 'Manage' })).getByRole('button', {
        name: 'Duplicate',
      }),
    ).toBeDefined();

    fireEvent.click(duplicate);
    const dialog = await screen.findByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(duplicate));
  });

  it('offers no step on the card to a role that cannot take it (sc-30413)', async () => {
    signedIn(READER);
    answering({
      'GET /api/events/ev_1': () =>
        json({ event: event({ ...PAST, status: 'ended', phase: 'finished' }) }),
    });
    at('/app/events/ev_1');

    const heading = await screen.findByRole('heading', { level: 1, name: 'Adaeze and Tunde' });
    expect(within(heading.closest('section')!).queryByRole('button')).toBeNull();
  });

  it('locks the dates of a Finished event, saying why', async () => {
    signedIn();
    answering({
      'GET /api/events/ev_1': () =>
        json({ event: event({ ...PAST, status: 'ended', phase: 'finished' }) }),
    });
    at('/app/events/ev_1');

    const details = await screen.findByRole('region', { name: 'Details' });
    expect(within(details).queryByRole('button', { name: /^.*Dates/u })).toBeNull();
    expect(
      within(details).getByText(
        "Dates · This event is over, so its start, end and time zone can't be changed.",
      ),
    ).toBeDefined();
  });

  it('says a called-off event’s dates are locked because it was called off (sc-45141)', async () => {
    signedIn();
    answering({
      'GET /api/events/ev_1': () =>
        json({
          event: event({
            ...PAST,
            status: 'ended',
            phase: 'finished',
            concludedAt: new Date(Date.parse(PAST.startsAt) - 86_400_000).toISOString(),
          }),
        }),
    });
    at('/app/events/ev_1');

    const details = await screen.findByRole('region', { name: 'Details' });
    expect(
      within(details).getByText(
        "Dates · This event was called off, so its start, end and time zone can't be changed.",
      ),
    ).toBeDefined();
  });

  it('offers Change dates as the card’s step on a Draft past its end, opening Dates in place (sc-30413)', async () => {
    signedIn();
    answering({ 'GET /api/events/ev_1': () => json({ event: event(PAST) }) });
    at('/app/events/ev_1');

    const heading = await screen.findByRole('heading', { level: 1, name: 'Adaeze and Tunde' });
    const card = heading.closest('section')!;
    expect(within(card).queryByRole('link', { name: 'Change dates' })).toBeNull();

    fireEvent.click(within(card).getByRole('button', { name: 'Change dates' }));
    const details = screen.getByRole('region', { name: 'Details' });
    expect(await within(details).findByRole('group', { name: 'Starts' })).toBeDefined();
  });

  it('keeps the Top above an area, with the area in a panel under it', async () => {
    const ahead = { startsAt: '2030-11-14T16:00:00+01:00', endsAt: '2030-11-15T02:00:00+01:00' };
    signedIn();
    answering({ 'GET /api/events/ev_1': () => json({ event: event(ahead) }) });
    at('/app/events/ev_1/menu');

    await screen.findByRole('heading', { level: 1, name: 'Adaeze and Tunde' });
    expect(screen.getByRole('heading', { level: 2, name: 'Menu' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Make live' })).toBeDefined();
    expect(screen.queryByRole('region', { name: 'Details' })).toBeNull();
  });
});

describe("A request one test leaves unanswered, in the next test's 20 s (sc-28117)", () => {
  afterAll(() => {
    vi.useRealTimers();
  });

  it('ends holding the read of the page', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['setTimeout', 'clearTimeout'] });
    signedIn();
    const held = vi.fn(() => new Promise<Response>(() => {}));
    answering({ 'GET /api/events/ev_1': held });
    at('/app/events/ev_1');

    await waitFor(() => expect(held).toHaveBeenCalledOnce());
  });

  it('shows the event, lets 20 s pass, and the next answer brings no second read', async () => {
    const ahead = { startsAt: '2030-11-14T16:00:00+01:00', endsAt: '2030-11-15T02:00:00+01:00' };
    signedIn();
    const sent = answering({
      'GET /api/events/ev_1': () => json({ event: event(ahead) }),
      'POST /api/events/ev_1/make-live': () =>
        json({ event: event({ ...ahead, status: 'live', phase: 'live' }) }),
    });
    at('/app/events/ev_1');
    await screen.findByRole('heading', { level: 1, name: 'Adaeze and Tunde' });

    await act(() => vi.advanceTimersByTimeAsync(20_000));
    fireEvent.click(screen.getByRole('button', { name: 'Make live' }));
    const dialog = await screen.findByRole('dialog', { name: 'Make Adaeze and Tunde live?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Make live' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('✓ Live'));

    expect(sent.filter(({ line }) => line === 'GET /api/events/ev_1')).toHaveLength(1);
  });
});

describe("An event's page", () => {
  it("opens on its cover card: the name, Draft, its days in the event's zone and a tile for each (sc-30413)", async () => {
    signedIn();
    answering({ 'GET /api/events/ev_1': () => json({ event: event() }) });
    at('/app/events/ev_1');

    const heading = await screen.findByRole('heading', { level: 1, name: 'Adaeze and Tunde' });
    const card = heading.closest('section')!;

    expect(card.className).toContain('ev-card');
    expect(within(card).getByText('Draft', { selector: '.desk-glass' })).toBeDefined();
    expect(spaced(card.querySelector('.desk-on-card')?.textContent ?? null)).toBe(
      'Saturday, Nov 14 to Sunday, Nov 15 · Venue to be confirmed',
    );
    expect(within(card).getByRole('list', { name: 'Its days' }).children).toHaveLength(2);
  });

  it('writes the day once, with no tiles, for an event that starts and ends on one day', async () => {
    signedIn();
    answering({
      'GET /api/events/ev_1': () => json({ event: event({ endsAt: '2026-11-14T23:00:00+01:00' }) }),
    });
    at('/app/events/ev_1');

    const heading = await screen.findByRole('heading', { level: 1, name: 'Adaeze and Tunde' });
    const card = heading.closest('section')!;

    expect(spaced(card.querySelector('.desk-on-card')?.textContent ?? null)).toBe(
      'Saturday, Nov 14 · Venue to be confirmed',
    );
    expect(within(card).queryByRole('list', { name: 'Its days' })).toBeNull();
  });

  it('opens Guests', async () => {
    signedIn();
    answering({ 'GET /api/events/ev_1': () => json({ event: event() }) });
    at('/app/events/ev_1');

    await screen.findByRole('heading', { level: 1, name: 'Adaeze and Tunde' });
    fireEvent.click(
      within(screen.getByRole('navigation', { name: 'Event' })).getByRole('link', {
        name: 'Guests',
      }),
    );

    expect(await screen.findByRole('heading', { level: 1, name: 'Guests' })).toBeDefined();
  });

  it.each([
    ['the event', '/app/events/ev_1', 'Adaeze and Tunde'],
    ['its Guests', '/app/events/ev_1/guests', 'Guests'],
  ])(
    'takes focus to the heading of %s once Try again loads it (sc-11369)',
    async (_what, path, heading) => {
      signedIn();
      let calls = 0;
      answering({
        'GET /api/events/ev_1': () =>
          ++calls === 1 ? problem(500, 'internal_error') : json({ event: event() }),
      });
      at(path);

      fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));

      const title = await screen.findByRole('heading', { level: 1, name: heading });
      await waitFor(() => expect(document.activeElement).toBe(title));
    },
  );

  it.each([
    ['the event', '/app/events/ev_1'],
    ['its Guests', '/app/events/ev_1/guests'],
    ['Edit details', '/app/events/ev_1/edit'],
  ])(
    'takes focus to "This event is not available" when Try again on %s finds the event gone (sc-11369)',
    async (_what, path) => {
      signedIn();
      let calls = 0;
      answering({
        'GET /api/events/ev_1': () =>
          ++calls === 1 ? problem(500, 'internal_error') : problem(404, 'not_found'),
      });
      at(path);

      fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));

      const gone = await screen.findByRole('heading', { name: 'This event is not available' });
      await waitFor(() => expect(document.activeElement).toBe(gone));
    },
  );

  it('takes focus to the line that says the event did not load when Try again fails again (sc-11369)', async () => {
    signedIn();
    answering({ 'GET /api/events/ev_1': () => problem(500, 'internal_error') });
    at('/app/events/ev_1');

    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));

    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByText('The event did not load. Try again in a moment.'),
      ),
    );
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it("says the same for an event that does not exist and another organisation's", async () => {
    signedIn();
    answering({
      'GET /api/events/missing': () => problem(404, 'not_found'),
      'GET /api/events/elsewhere': () =>
        json({ event: event({ id: 'elsewhere', organisationId: 'org_2', name: 'Not yours' }) }),
    });

    at('/app/events/missing');
    const missing = await screen.findByRole('heading', { name: 'This event is not available' });
    const missingPage = missing.closest('.event-page')!.innerHTML;

    cleanup();
    at('/app/events/elsewhere');
    const elsewhere = await screen.findByRole('heading', { name: 'This event is not available' });

    expect(elsewhere.closest('.event-page')!.innerHTML).toBe(missingPage);
    expect(screen.queryByText('Not yours')).toBeNull();
  });
});

describe("An event's venue (sc-3589)", () => {
  /** Every request with its body, and the event's resource answered with an ETag. */
  function serving(answers: Record<string, Answer>, served = event()) {
    const sent: { line: string; body: unknown }[] = [];

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = new URL(String(input));
      const line = `${init?.method ?? 'GET'} ${url.pathname}`;
      const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : null;
      sent.push({ line: `${line}${url.search}`, body });

      const answer = await answers[line]?.(body, new URL(String(input)));
      if (answer != null) return answer;

      return new Response(JSON.stringify({ event: served }), {
        status: 200,
        headers: { ETag: '"1"' },
      });
    });

    return sent;
  }

  function patched(sent: { line: string; body: unknown }[]): unknown {
    return sent.find(({ line }) => line === 'PATCH /api/events/ev_1')?.body;
  }

  it('shows the venue on the page, the address opening OpenStreetMap at its coordinates', async () => {
    signedIn();
    serving(
      {},
      event({
        venue: {
          name: 'The Civic Centre',
          address: {
            ...TYPED,
            formatted: 'Ozumba Mbadiwe Avenue, Lagos',
            latitude: 6.4316,
            longitude: 3.4246,
          },
        },
      }),
    );
    at('/app/events/ev_1');
    await screen.findByRole('heading', { level: 1, name: 'Adaeze and Tunde' });

    const card = screen.getByRole('heading', { level: 1 }).closest('section')!;
    const details = screen.getByRole('region', { name: 'Details' });
    expect(within(card).getByText(/The Civic Centre$/u)).toBeDefined();
    expect(within(details).getByText('The Civic Centre')).toBeDefined();
    expect(within(details).getByText('Venue · Ozumba Mbadiwe Avenue, Lagos')).toBeDefined();
    expect(within(details).getByRole('link', { name: 'Open in maps' }).getAttribute('href')).toBe(
      'https://www.openstreetmap.org/?mlat=6.4316&mlon=3.4246#map=17/6.4316/3.4246',
    );
    expect(screen.queryByText('Venue to be confirmed')).toBeNull();
  });

  it('shows a typed address with no maps link', async () => {
    signedIn();
    serving(
      {},
      event({ venue: { name: null, address: { ...TYPED, formatted: '12 Bode Thomas Street' } } }),
    );
    at('/app/events/ev_1');

    const details = await screen.findByRole('region', { name: 'Details' });
    expect(within(details).getByText('12 Bode Thomas Street')).toBeDefined();
    expect(screen.queryByRole('link', { name: 'Open in maps' })).toBeNull();
  });

  it('says Venue to be confirmed, its row opening the venue in place only for events.manage', async () => {
    signedIn();
    serving({});
    at('/app/events/ev_1');
    const details = await screen.findByRole('region', { name: 'Details' });
    expect(within(details).getByText('Venue to be confirmed')).toBeDefined();

    fireEvent.click(within(details).getByRole('button', { name: /Venue to be confirmed/ }));
    expect(await within(details).findByLabelText(/Venue name/)).toBeDefined();

    cleanup();
    signedIn(READER);
    serving({});
    at('/app/events/ev_1');
    const readOnly = await screen.findByRole('region', { name: 'Details' });
    expect(within(readOnly).getByText('Venue to be confirmed')).toBeDefined();
    expect(within(readOnly).queryByRole('button', { name: /Venue to be confirmed/ })).toBeNull();
  });

  it('refuses an arrival note past 500 characters in the venue edited in place, and sends nothing', async () => {
    signedIn();
    const sent = serving({});
    at('/app/events/ev_1');
    const details = await screen.findByRole('region', { name: 'Details' });

    fireEvent.click(within(details).getByRole('button', { name: /Venue to be confirmed/ }));
    fireEvent.change(await within(details).findByLabelText(/Arrival note/u), {
      target: { value: 'a'.repeat(501) },
    });
    fireEvent.click(within(details).getByRole('button', { name: 'Save' }));

    expect(
      await within(details).findByText('Shorten the arrival note to 500 characters or fewer.'),
    ).toBeDefined();
    await waitFor(() =>
      expect(document.activeElement).toBe(within(details).getByLabelText(/Arrival note/u)),
    );
    expect(patched(sent)).toBeUndefined();
  });

  describe('a save the role no longer allows, edited in place (sc-49861)', () => {
    const ROLE = 'Nothing was changed. Your role does not include the permission this needs.';

    async function typedNote(answers: Record<string, Answer>) {
      signedIn();
      const sent = serving(answers);
      at('/app/events/ev_1');
      const details = await screen.findByRole('region', { name: 'Details' });

      fireEvent.click(within(details).getByRole('button', { name: /Venue to be confirmed/ }));
      fireEvent.change(await within(details).findByLabelText(/Arrival note/u), {
        target: { value: 'Doors close at 23:00.' },
      });
      fireEvent.click(within(details).getByRole('button', { name: 'Save' }));

      return { sent, details };
    }

    it('says the role refused it where Not saved sits, keeps the note typed and the edit open, and offers no retry', async () => {
      const { sent, details } = await typedNote({
        'PATCH /api/events/ev_1': () => problem(403, 'permission_required'),
      });

      expect((await within(details).findByRole('alert')).textContent).toContain(ROLE);
      expect(within(details).queryByText(/Try again/u)).toBeNull();
      expect(within(details).getByLabelText<HTMLTextAreaElement>(/Arrival note/u).value).toBe(
        'Doors close at 23:00.',
      );

      fireEvent.click(within(details).getByRole('button', { name: 'Save' }));
      await waitFor(() =>
        expect(sent.filter(({ line }) => line === 'PATCH /api/events/ev_1')).toHaveLength(2),
      );
      expect(within(details).getByText(ROLE)).toBeDefined();
      expect(screen.getByRole('group', { name: 'Venue' })).toBeDefined();
      expect(within(details).queryByText(/Try again/u)).toBeNull();
    });

    it('keeps Not saved for a save that failed for another reason', async () => {
      const { details } = await typedNote({
        'PATCH /api/events/ev_1': () => problem(500, 'internal_error'),
      });

      expect(
        await within(details).findByText('Not saved. Your changes are still here. Try again.'),
      ).toBeDefined();
      expect(within(details).queryByText(ROLE)).toBeNull();
    });
  });

  it('shows the arrival note with its line breaks under Venue to be confirmed', async () => {
    signedIn();
    serving({}, event({ arrivalNote: 'Side gate on Marylebone Road.\n\nDoors at 17:30.' }));
    at('/app/events/ev_1');
    const details = await screen.findByRole('region', { name: 'Details' });

    const row = within(details).getByText('Venue to be confirmed').closest('.ev-part')!;
    expect(row.querySelector('.ev-note')?.textContent).toBe(
      'Side gate on Marylebone Road.\n\nDoors at 17:30.',
    );
  });
});

describe("An event's venue in New event (sc-3589)", () => {
  const CIVIC = {
    id: 'node:7',
    text: 'The Civic Centre',
    secondaryText: 'Ozumba Mbadiwe Avenue, Lagos, Nigeria',
  };

  function resolved(timeZone: string | null) {
    return {
      formatted: 'The Civic Centre, Ozumba Mbadiwe Avenue, Lagos, Nigeria',
      line1: 'Ozumba Mbadiwe Avenue',
      line2: null,
      city: 'Lagos',
      region: null,
      postal_code: null,
      country_code: timeZone === 'Europe/Lisbon' ? 'PT' : 'NG',
      latitude: 6.4316,
      longitude: 3.4246,
      time_zone: timeZone,
    };
  }

  function serving(answers: Record<string, Answer>) {
    const sent: { line: string; body: unknown }[] = [];

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = new URL(String(input));
      const line = `${init?.method ?? 'GET'} ${url.pathname}`;
      const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : null;
      sent.push({ line: `${line}${url.search}`, body });

      const answer = await answers[line]?.(body, new URL(String(input)));
      if (answer != null) return answer;
      if (line === 'POST /api/orgs/org_1/events') return json({ event: event() }, 201);

      return new Response(JSON.stringify({ event: event() }), {
        status: 200,
        headers: { ETag: '"1"' },
      });
    });

    return sent;
  }

  function address(): HTMLInputElement {
    return screen.getByRole('combobox', { name: 'Address' });
  }

  async function creating(): Promise<void> {
    at('/app/events/new');
    await screen.findByRole('heading', { level: 1, name: 'New event' });
    fireEvent.change(document.getElementById('event-name')!, { target: { value: 'Owambe' } });
    fireEvent.change(document.getElementById('event-type')!, { target: { value: 'wedding' } });
    for (const [id, value] of [
      ['event-start-date', '2026-11-14'],
      ['event-start-time', '16:00'],
      ['event-end-time', '23:00'],
    ] as const)
      fireEvent.change(document.getElementById(id)!, { target: { value } });
  }

  function created(sent: { line: string; body: unknown }[]): Record<string, unknown> | undefined {
    return sent.find(({ line }) => line === 'POST /api/orgs/org_1/events')?.body as
      Record<string, unknown> | undefined;
  }

  async function create(sent: { line: string; body: unknown }[]): Promise<Record<string, unknown>> {
    fireEvent.click(screen.getByRole('button', { name: 'Create event' }));
    await waitFor(() => expect(created(sent)).toBeDefined());

    return created(sent)!;
  }

  it('sits after Ends, with its hint', async () => {
    signedIn();
    serving({});
    at('/app/events/new');
    await screen.findByRole('heading', { level: 1, name: 'New event' });

    const headings = screen.getAllByRole('heading', { level: 2 }).map((one) => one.textContent);
    expect(headings).toEqual([
      'About the event',
      'Hosted by',
      'Cover',
      'When',
      'Venue',
      'Time zone and currency',
    ]);
    expect(screen.getByLabelText(/Venue name/u)).toBeDefined();
    expect(address().getAttribute('aria-expanded')).toBe('false');
    expect(document.getElementById('event-venue-address-hint')?.textContent).toBe(
      'Type at least 3 characters to see suggestions. You can also type any address.',
    );
  });

  it('suggests from three characters, picks by keyboard, and sends the suggestion it came from', async () => {
    signedIn();
    const sent = serving({
      'GET /api/addresses/suggest': () =>
        json({ success: true, data: [{ ...CIVIC, secondary_text: CIVIC.secondaryText }] }),
      'GET /api/addresses/node%3A7': () => json({ success: true, data: resolved('Africa/Lagos') }),
    });
    await creating();

    fireEvent.change(address(), { target: { value: 'Ci' } });
    fireEvent.change(address(), { target: { value: 'Civic' } });
    const option = await screen.findByRole('option', { name: /The Civic Centre/u });

    expect(sent.filter(({ line }) => line.startsWith('GET /api/addresses/suggest'))).toEqual([
      { line: 'GET /api/addresses/suggest?q=Civic', body: null },
    ]);
    expect(address().getAttribute('aria-expanded')).toBe('true');
    fireEvent.keyDown(address(), { key: 'ArrowDown' });
    expect(address().getAttribute('aria-activedescendant')).toBe(option.id);
    fireEvent.keyDown(address(), { key: 'Enter' });

    await waitFor(() =>
      expect(address().value).toBe('The Civic Centre, Ozumba Mbadiwe Avenue, Lagos, Nigeria'),
    );
    expect(screen.queryByRole('option', { name: /The Civic Centre/u })).toBeNull();
    expect(screen.queryByText(/This venue is in/u)).toBeNull();

    expect((await create(sent)).venue).toEqual({
      name: null,
      address: 'The Civic Centre, Ozumba Mbadiwe Avenue, Lagos, Nigeria',
      addressId: 'node:7',
    });
  });

  it('saves a typed address as typed, with a name', async () => {
    signedIn();
    const sent = serving({ 'GET /api/addresses/suggest': () => json({ success: true, data: [] }) });
    await creating();

    fireEvent.change(screen.getByLabelText(/Venue name/u), { target: { value: ' Hall 2 ' } });
    fireEvent.change(address(), { target: { value: '12 Bode Thomas Street' } });

    expect((await create(sent)).venue).toEqual({
      name: 'Hall 2',
      address: '12 Bode Thomas Street',
    });
    expect(screen.queryByText(/Suggestions aren't available/u)).toBeNull();
  });

  it('says suggestions are unavailable only when the lookup failed, and still saves the address', async () => {
    signedIn();
    const sent = serving({
      'GET /api/addresses/suggest': () => problem(503, 'service_unavailable'),
    });
    await creating();

    fireEvent.change(address(), { target: { value: '12 Bode Thomas Street' } });

    expect(
      await screen.findByText(
        "Suggestions aren't available right now. Type the address in full and it will be saved as you typed it.",
      ),
    ).toBeDefined();
    expect(address().getAttribute('aria-describedby')).toContain('event-venue-lookup-down');

    expect((await create(sent)).venue).toEqual({ name: null, address: '12 Bode Thomas Street' });
  });

  describe("the address's time zone", () => {
    async function picked(): Promise<{ line: string; body: unknown }[]> {
      signedIn();
      const sent = serving({
        'GET /api/addresses/suggest': () =>
          json({ success: true, data: [{ ...CIVIC, secondary_text: null }] }),
        'GET /api/addresses/node%3A7': () =>
          json({ success: true, data: resolved('Europe/Lisbon') }),
      });
      await creating();

      fireEvent.change(address(), { target: { value: 'Civic' } });
      fireEvent.click(await screen.findByRole('option', { name: /The Civic Centre/u }));
      await screen.findByText('This venue is in Europe/Lisbon. Use it?');

      return sent;
    }

    it('changes the zone when accepted, keeping the times as typed', async () => {
      const sent = await picked();

      fireEvent.click(screen.getByRole('button', { name: 'Use Europe/Lisbon' }));

      expect((screen.getByLabelText('Time zone') as HTMLSelectElement).value).toBe('Europe/Lisbon');
      expect(screen.queryByText(/This venue is in/u)).toBeNull();
      expect(screen.getByText('Time zone set to Europe/Lisbon.')).toBeDefined();

      expect(await create(sent)).toMatchObject({
        timeZone: 'Europe/Lisbon',
        startsAt: '2026-11-14T16:00',
        endsAt: '2026-11-14T23:00',
      });
    });

    it('keeps the zone when declined', async () => {
      const sent = await picked();

      fireEvent.click(screen.getByRole('button', { name: 'Keep Africa/Lagos' }));

      expect((screen.getByLabelText('Time zone') as HTMLSelectElement).value).toBe('Africa/Lagos');
      expect(screen.queryByText(/This venue is in/u)).toBeNull();

      expect(await create(sent)).toMatchObject({ timeZone: 'Africa/Lagos' });
    });
  });

  it('refuses a venue name past 120 characters beside it, and sends nothing', async () => {
    signedIn();
    const sent = serving({});
    await creating();

    fireEvent.change(screen.getByLabelText(/Venue name/u), { target: { value: 'a'.repeat(121) } });
    fireEvent.click(screen.getByRole('button', { name: 'Create event' }));

    expect(
      await screen.findByText('Shorten the venue name to 120 characters or fewer.'),
    ).toBeDefined();
    await waitFor(() => expect(document.activeElement?.id).toBe('event-venue-name'));
    expect(created(sent)).toBeUndefined();
  });
});

describe('Change dates opens Dates in place, and Edit details is gone (sc-48602)', () => {
  const PAST = { startsAt: '2020-11-14T16:00:00+01:00', endsAt: '2020-11-15T02:00:00+01:00' };
  let router: ReturnType<typeof createMemoryRouter>;

  function from(...entries: string[]): void {
    router = createMemoryRouter(routes, { initialEntries: entries });
    render(<RouterProvider router={router} />);
  }

  function lit(): string[] {
    return [...document.querySelectorAll('.ev-detail.is-lit')].map((row) => row.textContent ?? '');
  }

  async function datesOpened(): Promise<void> {
    const starts = await screen.findByRole('group', { name: 'Starts' });

    expect(router.state.location.pathname).toBe('/app/events/ev_1');
    await waitFor(() =>
      expect(document.activeElement).toBe(within(starts).getByLabelText('Starts, Date')),
    );
  }

  it("opens from an Events card's step, and Back returns to Events", async () => {
    signedIn();
    answering({
      'GET /api/orgs/org_1/events': listed([event(PAST)]),
      'GET /api/events/ev_1': () => json({ event: event(PAST) }),
    });
    from('/app/events');
    fireEvent.click(await screen.findByRole('tab', { name: /^Drafts/u }));
    fireEvent.click(screen.getByRole('button', { name: 'Change dates' }));

    await datesOpened();
    await act(() => router.navigate(-1));
    expect(router.state.location.pathname).toBe('/app/events');
  });

  it('opens from the row atop the event’s other areas, and Back returns to the area', async () => {
    signedIn();
    answering({ 'GET /api/events/ev_1': () => json({ event: event(PAST) }) });
    from('/app/events/ev_1/menu');
    fireEvent.click(await screen.findByRole('link', { name: 'Change dates' }));

    await datesOpened();
    await act(() => router.navigate(-1));
    expect(router.state.location.pathname).toBe('/app/events/ev_1/menu');
  });

  it('opens from Make live’s refusal when the end passed meanwhile, on the event’s own page', async () => {
    const ahead = { startsAt: '2030-11-14T16:00:00+01:00', endsAt: '2030-11-15T02:00:00+01:00' };
    let served = event(ahead);
    signedIn();
    answering({
      'GET /api/events/ev_1': () => json({ event: served }),
      'POST /api/events/ev_1/make-live': () => {
        served = event(PAST);

        return problem(409, 'event_concluded');
      },
    });
    from('/app/events/ev_1');
    fireEvent.click(await screen.findByRole('button', { name: 'Make live' }));
    const dialog = await screen.findByRole('dialog', { name: 'Make Adaeze and Tunde live?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Make live' }));
    const refused = await screen.findByRole('alertdialog', { name: /^Not made live\./u });
    fireEvent.click(within(refused).getByRole('link', { name: 'Change dates' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    await datesOpened();
  });

  it('takes focus to Starts from Make live’s refusal when Dates is already open', async () => {
    const ahead = { startsAt: '2030-11-14T16:00:00+01:00', endsAt: '2030-11-15T02:00:00+01:00' };
    signedIn();
    answering({
      'GET /api/events/ev_1': () => json({ event: event(ahead) }),
      'POST /api/events/ev_1/make-live': () => problem(409, 'event_concluded'),
    });
    from('/app/events/ev_1');
    const details = await screen.findByRole('region', { name: 'Details' });
    fireEvent.click(within(details).getByRole('button', { name: /^.*Dates/u }));
    await screen.findByRole('group', { name: 'Starts' });
    fireEvent.click(screen.getByRole('button', { name: 'Make live' }));
    const dialog = await screen.findByRole('dialog', { name: 'Make Adaeze and Tunde live?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Make live' }));
    const refused = await screen.findByRole('alertdialog', { name: /^Not made live\./u });
    fireEvent.click(within(refused).getByRole('link', { name: 'Change dates' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    await datesOpened();
    expect(lit()).toHaveLength(1);
  });

  it('opens from Make live’s refusal on the event’s Guests, and Back returns to Guests', async () => {
    const ahead = { startsAt: '2030-11-14T16:00:00+01:00', endsAt: '2030-11-15T02:00:00+01:00' };
    let served = event(ahead);
    signedIn();
    answering({
      'GET /api/events/ev_1': () => json({ event: served }),
      'POST /api/events/ev_1/make-live': () => {
        served = event(PAST);

        return problem(409, 'event_concluded');
      },
      'GET /api/events/ev_1/guests': () =>
        json({
          guests: [],
          counts: { people: 0, guests: 0, companions: 0 },
          groups: [],
          ungrouped: { people: 0, guests: 0, companions: 0 },
        }),
    });
    from('/app/events/ev_1/guests');
    fireEvent.click(await screen.findByRole('button', { name: 'Make live' }));
    const dialog = await screen.findByRole('dialog', { name: 'Make Adaeze and Tunde live?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Make live' }));
    const refused = await screen.findByRole('alertdialog', { name: /^Not made live\./u });
    fireEvent.click(within(refused).getByRole('link', { name: 'Change dates' }));

    await datesOpened();
    await act(() => router.navigate(-1));
    expect(router.state.location.pathname).toBe('/app/events/ev_1/guests');
  });

  it('shows /edit#starts of an event that is not there as its page shows it', async () => {
    signedIn();
    answering({ 'GET /api/events/ev_1': () => problem(404, 'not_found') });
    from('/app/events/ev_1/edit#starts');

    expect(
      await screen.findByRole('heading', { name: 'This event is not available' }),
    ).toBeDefined();
    expect(router.state.location.pathname).toBe('/app/events/ev_1');
    expect(screen.queryByRole('group', { name: 'Starts' })).toBeNull();
  });

  it.each([
    ['#starts', 'Dates'],
    ['#venue', 'Venue'],
    ['#hosts', 'Hosted by'],
    ['#cover', 'Cover'],
  ])('opens /edit%s on the event’s page with %s open, and Back skips /edit', async (hash, part) => {
    signedIn();
    answering({ 'GET /api/events/ev_1': () => json({ event: event() }) });
    from('/app/events', `/app/events/ev_1/edit${hash}`);

    await waitFor(() => expect(lit()).toHaveLength(1));
    expect(lit()[0]).toContain(part);
    expect(router.state.location.pathname).toBe('/app/events/ev_1');
    expect(router.state.location.hash).toBe('');
    await act(() => router.navigate(-1));
    expect(router.state.location.pathname).toBe('/app/events');
  });

  it.each(['', '#name', '#ends', '#xyz'])(
    'opens /edit%s on the event’s page with no part open',
    async (hash) => {
      signedIn();
      answering({ 'GET /api/events/ev_1': () => json({ event: event() }) });
      from(`/app/events/ev_1/edit${hash}`);

      await screen.findByRole('heading', { level: 1, name: 'Adaeze and Tunde' });
      expect(router.state.location.pathname).toBe('/app/events/ev_1');
      expect(lit()).toEqual([]);
    },
  );

  it('opens no part for #starts on a finished event, whose Dates is locked', async () => {
    signedIn();
    answering({
      'GET /api/events/ev_1': () =>
        json({ event: event({ ...PAST, status: 'ended', phase: 'finished' }) }),
    });
    from('/app/events/ev_1/edit#starts');

    await screen.findByRole('heading', { level: 1, name: 'Adaeze and Tunde' });
    expect(lit()).toEqual([]);
    expect(screen.queryByRole('group', { name: 'Starts' })).toBeNull();
  });

  it.each(['#starts', '#venue', '#hosts', '#cover'])(
    'opens no part for /edit%s without events.manage, and offers no Change dates',
    async (hash) => {
      signedIn(READER);
      answering({
        'GET /api/events/ev_1': () =>
          json({ event: { ...event(PAST), permissions: READER.permissions } }),
      });
      from(`/app/events/ev_1/edit${hash}`);

      await screen.findByRole('heading', { level: 1, name: 'Adaeze and Tunde' });
      expect(lit()).toEqual([]);
      expect(screen.queryByRole('button', { name: 'Change dates' })).toBeNull();
    },
  );
});

describe('Make live (sc-3584)', () => {
  const AHEAD = { startsAt: '2030-11-14T16:00:00+01:00', endsAt: '2030-11-15T02:00:00+01:00' };

  function live(overrides: Record<string, unknown> = {}) {
    return event({
      ...AHEAD,
      status: 'live',
      phase: 'live',
      madeLiveAt: '2026-10-26T15:00:00+00:00',
      ...overrides,
    });
  }

  function tagged(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { ETag: '"2"' } });
  }

  async function onTheDraft(answers: Record<string, Answer> = {}) {
    const sent = answering({
      'GET /api/events/ev_1': () => json({ event: event(AHEAD) }),
      ...answers,
    });
    at('/app/events/ev_1');
    await screen.findByRole('heading', { level: 1, name: 'Adaeze and Tunde' });

    return sent;
  }

  async function confirming(answers: Record<string, Answer> = {}) {
    const sent = await onTheDraft(answers);
    fireEvent.click(screen.getByRole('button', { name: 'Make live' }));

    return {
      sent,
      dialog: await screen.findByRole('dialog', { name: 'Make Adaeze and Tunde live?' }),
    };
  }

  it("shows a Draft's Guests line with Make live beside it to somebody with events.manage", async () => {
    signedIn();
    await onTheDraft();

    expect(screen.getByText('Guests can’t be invited until this event is live.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Make live' })).toBeDefined();
    expect(screen.getByText('Draft')).toBeDefined();
  });

  it('shows the line and no Make live without events.manage', async () => {
    signedIn(READER);
    await onTheDraft();

    expect(screen.getByText('Guests can’t be invited until this event is live.')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Make live' })).toBeNull();
  });

  it('asks first, and Not yet changes nothing and returns focus to Make live', async () => {
    signedIn();
    const { sent, dialog } = await confirming();

    expect(within(dialog).getByText('Guests can be invited, and they can see it.')).toBeDefined();
    expect(within(dialog).getByText("It can't go back to being a draft.")).toBeDefined();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Not yet' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Make live' })),
    );
    expect(sent.map(({ line }) => line)).not.toContain('POST /api/events/ev_1/make-live');
  });

  it('makes it live: the pill reads Live, Live is announced, and Make live is gone', async () => {
    signedIn();
    const { sent, dialog } = await confirming({
      'POST /api/events/ev_1/make-live': () => tagged({ event: live() }),
    });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Make live' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByText('Live')).toBeDefined();
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('✓ Live'));
    expect(screen.queryByRole('button', { name: 'Make live' })).toBeNull();
    expect(screen.queryByText('Guests can’t be invited until this event is live.')).toBeNull();
    expect(sent.filter(({ line }) => line === 'POST /api/events/ev_1/make-live')).toHaveLength(1);
  });

  it('says somebody else changed it, and shows what it is now, on a 409 from another tab', async () => {
    signedIn();
    let reads = 0;
    const { dialog } = await confirming({
      'GET /api/events/ev_1': () => json({ event: (reads += 1) === 1 ? event(AHEAD) : live() }),
      'POST /api/events/ev_1/make-live': () => problem(409, 'event_state_invalid'),
    });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Make live' }));

    const changed = await screen.findByRole('alertdialog', {
      name: 'Somebody else changed this event while you had it open.',
    });
    expect(
      within(changed).getByText("It's live now. The page shows what it is now."),
    ).toBeDefined();
    fireEvent.click(within(changed).getByRole('button', { name: 'Close' }));
    expect(screen.getByText('Live')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Make live' })).toBeNull();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it("names the plan and its limit when the plan's limit is reached, and it stays a Draft", async () => {
    signedIn();
    const { dialog } = await confirming({
      'POST /api/events/ev_1/make-live': () =>
        problem(403, 'plan_limit', { plan: 'Free', limit: 3 }),
    });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Make live' }));

    const refused = await screen.findByRole('alertdialog', {
      name: 'Not made live. Your Free plan allows 3 events to be live or paused at a time.',
    });
    expect(
      within(refused).getByText(
        'This event stays a draft. Finish or call off another event, or change plan.',
      ),
    ).toBeDefined();
    fireEvent.click(within(refused).getByRole('button', { name: 'Close' }));
    expect(screen.getByText('Draft')).toBeDefined();
  });

  it('says so before the tap when the end has passed, pointing to its dates', async () => {
    signedIn();
    answering({
      'GET /api/events/ev_1': () =>
        json({
          event: event({
            startsAt: '2020-11-14T16:00:00+01:00',
            endsAt: '2020-11-15T02:00:00+01:00',
          }),
        }),
    });
    at('/app/events/ev_1');
    await screen.findByRole('heading', { level: 1, name: 'Adaeze and Tunde' });

    expect(
      screen.getByText(
        'This event’s end has passed, so it cannot be made live. Change its dates first.',
      ),
    ).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Make live' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Change dates' })).toBeDefined();
  });

  it('shows Live in the list', async () => {
    signedIn();
    answering({ 'GET /api/orgs/org_1/events': listed([live()]) });
    at('/app/events');

    const card = await screen.findByRole('region', { name: 'Adaeze and Tunde' });
    expect(within(card).getByText('Live')).toBeDefined();
  });
});

describe('The phase, End now and Call off (sc-3585)', () => {
  const AHEAD = { startsAt: '2030-11-14T16:00:00+01:00', endsAt: '2030-11-15T02:00:00+01:00' };
  const HAPPENING = { startsAt: '2020-11-14T16:00:00+01:00', endsAt: '2030-11-15T02:00:00+01:00' };

  function live(overrides: Record<string, unknown> = {}) {
    return event({ ...AHEAD, status: 'live', phase: 'live', ...overrides });
  }

  function tagged(body: unknown, headers: Record<string, string> = {}): Response {
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { ETag: '"2"', ...headers },
    });
  }

  async function onThePage(served: unknown, answers: Record<string, Answer> = {}) {
    const sent = answering({ 'GET /api/events/ev_1': () => json({ event: served }), ...answers });
    at('/app/events/ev_1');
    await screen.findByRole('heading', { level: 1, name: 'Adaeze and Tunde' });

    return sent;
  }

  function clockAt(device: string): void {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(new Date(device));
  }

  async function servedWithDate(served: unknown, date: string): Promise<void> {
    answering({ 'GET /api/events/ev_1': () => tagged({ event: served }, { Date: date }) });
    at('/app/events/ev_1');
    await screen.findByRole('heading', { level: 1, name: 'Adaeze and Tunde' });
    await act(() => vi.advanceTimersByTimeAsync(15_000));
  }

  afterEach(() => {
    vi.useRealTimers();
    serverClock.observe(new Date().toUTCString());
  });

  it.each([
    ['happening_now', 'Happening now'],
    ['paused', 'Paused'],
  ])('shows the server phase %s as %s on the list', async (phase, word) => {
    signedIn();
    answering({ 'GET /api/orgs/org_1/events': listed([live({ phase })]) });
    at('/app/events');

    const card = await screen.findByRole('region', { name: 'Adaeze and Tunde' });
    expect(within(card).getByText(word)).toBeDefined();
  });

  it('lists the server phase finished under Past', async () => {
    signedIn();
    answering({ 'GET /api/orgs/org_1/events': listed([], [live({ phase: 'finished' })]) });
    at('/app/events');
    fireEvent.click(await screen.findByRole('tab', { name: 'Past 1' }));

    expect(rowNames()).toEqual(['Adaeze and Tunde']);
  });

  it("shows the server's phase on load, whatever the device clock says", async () => {
    signedIn();
    await onThePage(live({ ...HAPPENING, phase: 'live' }));

    expect(screen.getByText('Live', { selector: '.desk-glass' })).toBeDefined();
    expect(screen.queryByText('Happening now')).toBeNull();
  });

  it('turns Live to Happening now at the start without a reload, says so, and Call off becomes End now', async () => {
    clockAt('2030-11-14T14:59:50Z');
    signedIn();
    const sent = await onThePage(live());
    expect(screen.getByRole('button', { name: 'Call off…' })).toBeDefined();

    await act(() => vi.advanceTimersByTimeAsync(15_000));

    expect(screen.getByText('Happening now', { selector: '.desk-glass' })).toBeDefined();
    expect(document.querySelector('p.visually-hidden[aria-live="polite"]')?.textContent).toBe(
      'Happening now',
    );
    expect(screen.getByRole('button', { name: 'End now…' })).toBeDefined();
    expect(sent.filter(({ line }) => line === 'GET /api/events/ev_1')).toHaveLength(1);
  });

  it('reads the phase again at once when the tab comes back', async () => {
    clockAt('2030-11-14T14:59:55Z');
    signedIn();
    await onThePage(live());

    vi.setSystemTime(new Date('2030-11-14T15:00:01Z'));
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(screen.getByText('Happening now', { selector: '.desk-glass' })).toBeDefined();
  });

  it('still shows Live five minutes before the start on a device ten minutes fast', async () => {
    clockAt('2030-11-14T15:05:00Z');
    signedIn();
    await servedWithDate(live(), 'Thu, 14 Nov 2030 14:55:00 GMT');

    expect(screen.getByText('Live', { selector: '.desk-glass' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Call off…' })).toBeDefined();
  });

  it("still offers Make live five minutes before a Draft's end on a device ten minutes fast", async () => {
    clockAt('2030-11-15T01:05:00Z');
    signedIn();
    await servedWithDate(event(AHEAD), 'Fri, 15 Nov 2030 00:55:00 GMT');

    expect(screen.getByRole('button', { name: 'Make live' })).toBeDefined();
  });

  it("says a Draft's end has passed five minutes after it on a device ten minutes slow", async () => {
    clockAt('2030-11-15T00:55:00Z');
    signedIn();
    await servedWithDate(event(AHEAD), 'Fri, 15 Nov 2030 01:05:00 GMT');

    expect(
      screen.getByText(
        'This event’s end has passed, so it cannot be made live. Change its dates first.',
      ),
    ).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Make live' })).toBeNull();
  });

  it('asks before calling it off, and Keep it on changes nothing', async () => {
    signedIn();
    const sent = await onThePage(live());

    fireEvent.click(screen.getByRole('button', { name: 'Call off…' }));
    const dialog = await screen.findByRole('dialog', { name: 'Call off Adaeze and Tunde?' });

    expect(
      within(dialog).getByText("It won't go ahead. Guests following their link will be told."),
    ).toBeDefined();
    expect(within(dialog).getByText("You can't undo this.")).toBeDefined();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Keep it on' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Call off…' })),
    );
    expect(sent.map(({ line }) => line)).not.toContain('POST /api/events/ev_1/end');
  });

  it('calls it off: Finished, with the called-off notice, and no button left', async () => {
    signedIn();
    const sent = await onThePage(live(), {
      'POST /api/events/ev_1/end': () =>
        tagged({
          event: live({
            status: 'ended',
            phase: 'finished',
            concludedAt: '2030-10-13T10:00:00+01:00',
          }),
        }),
    });

    fireEvent.click(screen.getByRole('button', { name: 'Call off…' }));
    const dialog = await screen.findByRole('dialog', { name: 'Call off Adaeze and Tunde?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Call off' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByText('Called off', { selector: '.desk-glass' })).toBeDefined();
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Finished'));
    expect(screen.getAllByText(/^Called off on .*Oct 13, 2030, before it started\./)).toHaveLength(
      1,
    );
    expect(screen.queryByRole('button', { name: 'Call off…' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'End now…' })).toBeNull();
    expect(sent.filter(({ line }) => line === 'POST /api/events/ev_1/end')).toHaveLength(1);
  });

  it('ends it early once it is happening', async () => {
    signedIn();
    await onThePage(live({ ...HAPPENING, phase: 'happening_now' }), {
      'POST /api/events/ev_1/end': () =>
        tagged({
          event: live({
            ...HAPPENING,
            status: 'ended',
            phase: 'finished',
            concludedAt: '2026-10-26T18:00:00+01:00',
          }),
        }),
    });

    fireEvent.click(screen.getByRole('button', { name: 'End now…' }));
    const dialog = await screen.findByRole('dialog', { name: 'End Adaeze and Tunde now?' });
    expect(within(dialog).getByText('It will be over for everybody.')).toBeDefined();
    fireEvent.click(within(dialog).getByRole('button', { name: 'End now' }));

    await waitFor(() =>
      expect(screen.getByText('Finished', { selector: '.desk-glass' })).toBeDefined(),
    );
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Finished'));
    expect(document.activeElement).toBe(
      screen.getByRole('heading', { level: 1, name: 'Adaeze and Tunde' }),
    );
    expect(screen.queryByText(/Called off on/)).toBeNull();
  });

  it('says Calling off… while it sends, and Not called off when the API fails (sc-22103)', async () => {
    signedIn();
    let fail: (response: Response) => void = () => {};
    await onThePage(live(), {
      'POST /api/events/ev_1/end': () =>
        new Promise<Response>((resolve) => {
          fail = resolve;
        }),
    });

    fireEvent.click(screen.getByRole('button', { name: 'Call off…' }));
    const dialog = await screen.findByRole('dialog', { name: 'Call off Adaeze and Tunde?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Call off' }));

    await waitFor(() =>
      expect(within(dialog).getByRole('status').textContent).toBe('Calling off…'),
    );
    expect(within(dialog).getByRole('button', { name: 'Calling off…' })).toBeDefined();

    fail(problem(500, 'internal'));

    expect(await within(dialog).findByText('Not called off. Try again in a moment.')).toBeDefined();
    expect(within(dialog).getByRole('button', { name: 'Call off' })).toBeDefined();
    expect(screen.getByText('Live', { selector: '.desk-glass' })).toBeDefined();
  });

  it('says the event is already over when the API refuses it event_concluded', async () => {
    signedIn();
    let reads = 0;
    await onThePage(live(), {
      'GET /api/events/ev_1': () =>
        json({ event: (reads += 1) === 1 ? live() : live({ phase: 'finished' }) }),
      'POST /api/events/ev_1/end': () => problem(409, 'event_concluded'),
    });

    fireEvent.click(screen.getByRole('button', { name: 'Call off…' }));
    fireEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Call off' }),
    );

    const refused = await screen.findByRole('alertdialog', { name: 'Not ended.' });
    expect(within(refused).getByText('This event is already over.')).toBeDefined();
    fireEvent.click(within(refused).getByRole('button', { name: 'Close' }));
    expect(screen.getByText('Finished', { selector: '.desk-glass' })).toBeDefined();
  });

  it('says it was called off, not that it is over, when the call-off is refused on a called-off event (sc-17382)', async () => {
    signedIn();
    const calledOff = live({
      status: 'ended',
      phase: 'finished',
      concludedAt: '2026-10-28T09:00:00+00:00',
    });
    let reads = 0;
    await onThePage(live(), {
      'GET /api/events/ev_1': () => json({ event: (reads += 1) === 1 ? live() : calledOff }),
      'POST /api/events/ev_1/end': () => problem(409, 'event_state_invalid'),
    });

    fireEvent.click(screen.getByRole('button', { name: 'Call off…' }));
    fireEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Call off' }),
    );

    const refused = await screen.findByRole('alertdialog', {
      name: 'Somebody else changed this event while you had it open.',
    });
    expect(
      within(refused).getByText("It's been called off. The page shows what it is now."),
    ).toBeDefined();
    expect(within(refused).queryByText('This event is already over.')).toBeNull();
  });

  it.each([
    ['without events.manage', READER, live({ permissions: READER.permissions })],
    ['on a Draft', IRE, event(AHEAD)],
    ['once it is Finished', IRE, live({ phase: 'finished' })],
  ])('offers neither End now nor Call off %s', async (_, who, served) => {
    signedIn(who);
    await onThePage(served);

    expect(screen.queryByRole('button', { name: 'Call off…' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'End now…' })).toBeNull();
  });
});

describe('Pause and Resume (sc-3586)', () => {
  const AHEAD = { startsAt: '2030-11-14T16:00:00+01:00', endsAt: '2030-11-15T02:00:00+01:00' };

  function live(overrides: Record<string, unknown> = {}) {
    return event({ ...AHEAD, status: 'live', phase: 'live', ...overrides });
  }

  function paused(overrides: Record<string, unknown> = {}) {
    return live({
      status: 'paused',
      phase: 'paused',
      pausedAt: '2026-10-27T09:00:00+00:00',
      ...overrides,
    });
  }

  function tagged(body: unknown): Response {
    return new Response(JSON.stringify(body), { status: 200, headers: { ETag: '"2"' } });
  }

  async function onThePage(served: unknown, answers: Record<string, Answer> = {}) {
    const sent = answering({ 'GET /api/events/ev_1': () => json({ event: served }), ...answers });
    at('/app/events/ev_1');
    await screen.findByRole('heading', { level: 1, name: 'Adaeze and Tunde' });

    return sent;
  }

  it.each([
    ['live', live()],
    ['happening now', live({ phase: 'happening_now' })],
  ])('asks before pausing an event %s, and Keep it live changes nothing', async (_, served) => {
    signedIn();
    const sent = await onThePage(served);

    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    const dialog = await screen.findByRole('dialog', { name: 'Pause Adaeze and Tunde?' });
    expect(
      within(dialog).getByText("Guests can't reply or change anything until you resume it."),
    ).toBeDefined();
    expect(
      within(dialog).getByText('Nothing is lost. Check-in and service keep working.'),
    ).toBeDefined();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Keep it live' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(sent.some(({ line }) => line.startsWith('POST'))).toBe(false);
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Pause' })),
    );
  });

  it('pauses it: the pill reads Paused, the line and Resume show, and it is announced', async () => {
    signedIn();
    const sent = await onThePage(live(), {
      'POST /api/events/ev_1/pause': () => tagged({ event: paused() }),
    });

    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    fireEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Pause' }),
    );

    await waitFor(() =>
      expect(screen.getByText('Paused', { selector: '.desk-glass' })).toBeDefined(),
    );
    expect(sent.filter(({ line }) => line === 'POST /api/events/ev_1/pause')).toHaveLength(1);
    expect(
      screen.getByText('Paused. Guests can’t reply or change anything until you resume it.'),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: 'Resume' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Pause' })).toBeNull();
    await waitFor(() =>
      expect(screen.getByRole('status').textContent).toBe('Adaeze and Tunde is paused.'),
    );
  });

  it('resumes without asking, and the phase follows the clock', async () => {
    signedIn();
    const sent = await onThePage(paused(), {
      'POST /api/events/ev_1/resume': () =>
        tagged({ event: live({ phase: 'happening_now', pausedAt: null }) }),
    });

    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));

    await waitFor(() =>
      expect(screen.getByText('Happening now', { selector: '.desk-glass' })).toBeDefined(),
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(sent.filter(({ line }) => line === 'POST /api/events/ev_1/resume')).toHaveLength(1);
    expect(screen.queryByText(/^Paused\. Guests/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Pause' })).toBeDefined();
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1 })),
    );
  });

  it.each([
    [
      'somebody else changed it when the resume is refused and it is live now',
      () => live(),
      'Somebody else changed this event while you had it open.',
      "It's live now. The page shows what it is now.",
    ],
    [
      'it is already over when the resume is refused because its end has passed',
      () => paused({ phase: 'finished', pausedAt: null }),
      'This event is already over.',
      "It's finished now. The page shows what it is now.",
    ],
    [
      'somebody else changed it when the resume is refused and it was called off (sc-17382)',
      () =>
        paused({
          status: 'ended',
          phase: 'finished',
          pausedAt: null,
          concludedAt: '2026-10-28T09:00:00+00:00',
        }),
      'Somebody else changed this event while you had it open.',
      "It's been called off. The page shows what it is now.",
    ],
  ])('says %s, and focus is on the title', async (_, reloaded, said, now) => {
    signedIn();
    let reads = 0;
    await onThePage(paused(), {
      'GET /api/events/ev_1': () => json({ event: (reads += 1) === 1 ? paused() : reloaded() }),
      'POST /api/events/ev_1/resume': () => problem(409, 'event_state_invalid'),
    });

    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));

    const refused = await screen.findByRole('alert');
    expect(within(refused).getByText(said)).toBeDefined();
    expect(within(refused).getByText(now)).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Resume' })).toBeNull();
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1 })),
    );
  });

  it('says somebody else changed it when the pause is refused event_state_invalid', async () => {
    signedIn();
    let reads = 0;
    await onThePage(live(), {
      'GET /api/events/ev_1': () => json({ event: (reads += 1) === 1 ? live() : paused() }),
      'POST /api/events/ev_1/pause': () => problem(409, 'event_state_invalid'),
    });

    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    fireEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Pause' }),
    );

    const refused = await screen.findByRole('alertdialog', {
      name: 'Somebody else changed this event while you had it open.',
    });
    expect(
      within(refused).getByText("It's paused now. The page shows what it is now."),
    ).toBeDefined();
  });

  it('says it was called off, not that it is over, when the pause is refused on a called-off event (sc-17382)', async () => {
    signedIn();
    const calledOff = live({
      status: 'ended',
      phase: 'finished',
      concludedAt: '2026-10-28T09:00:00+00:00',
    });
    let reads = 0;
    await onThePage(live(), {
      'GET /api/events/ev_1': () => json({ event: (reads += 1) === 1 ? live() : calledOff }),
      'POST /api/events/ev_1/pause': () => problem(409, 'event_state_invalid'),
    });

    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    fireEvent.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Pause' }),
    );

    const refused = await screen.findByRole('alertdialog', {
      name: 'Somebody else changed this event while you had it open.',
    });
    expect(
      within(refused).getByText("It's been called off. The page shows what it is now."),
    ).toBeDefined();
    expect(
      within(refused).queryByText("It's finished now. The page shows what it is now."),
    ).toBeNull();
  });

  it('keeps Resume and says so when the resume fails', async () => {
    signedIn();
    await onThePage(paused(), { 'POST /api/events/ev_1/resume': () => problem(500, 'internal') });

    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));

    expect(await screen.findByText('Not resumed. Try again in a moment.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Resume' })).toBeDefined();
  });

  it.each([
    ['without events.manage', READER, live({ permissions: READER.permissions })],
    ['on a Draft', IRE, event(AHEAD)],
    ['once it is Finished', IRE, live({ phase: 'finished' })],
    ['while it is Paused', IRE, paused()],
  ])('offers no Pause %s', async (_, who, served) => {
    signedIn(who);
    await onThePage(served);

    expect(screen.queryByRole('button', { name: 'Pause' })).toBeNull();
  });

  it('shows the paused line without Resume to somebody without events.manage', async () => {
    signedIn(READER);
    await onThePage(paused());

    expect(screen.getByText(/^Paused\. Guests/)).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Resume' })).toBeNull();
  });

  it('shows a pause run past its end as Finished, with no Resume', async () => {
    signedIn();
    await onThePage(paused({ phase: 'finished', pausedAt: null }));

    expect(screen.getByText('Finished', { selector: '.desk-glass' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Resume' })).toBeNull();
    expect(screen.queryByText(/^Paused\. Guests/)).toBeNull();
  });
});

describe('An older copy never replaces the change the page made (sc-28121)', () => {
  const AHEAD = { startsAt: '2030-11-14T16:00:00+01:00', endsAt: '2030-11-15T02:00:00+01:00' };
  const HAPPENING = { startsAt: '2020-11-14T16:00:00+01:00', endsAt: '2030-11-15T02:00:00+01:00' };
  const draft = event(AHEAD);
  const live = event({ ...AHEAD, status: 'live', phase: 'live' });
  const happening = event({ ...HAPPENING, status: 'live', phase: 'happening_now' });
  const paused = event({
    ...AHEAD,
    status: 'paused',
    phase: 'paused',
    pausedAt: '2026-10-27T09:00:00+00:00',
  });
  const ended = { status: 'ended', phase: 'finished', concludedAt: '2030-10-13T10:00:00+01:00' };

  function tagged(body: unknown, tag: string): Response {
    return new Response(JSON.stringify(body), { status: 200, headers: { ETag: tag } });
  }

  /** The page shows `before` at version 1 and falls stale; every read after the first is held until `release` answers it. */
  async function staleOn(before: unknown, change: string, after: unknown) {
    const held: ((answer: Response) => void)[] = [];
    let reads = 0;
    answering({
      'GET /api/events/ev_1': () =>
        (reads += 1) === 1
          ? tagged({ event: before }, '"1"')
          : new Promise<Response>((resolve) => held.push(resolve)),
      [change]: () => tagged({ event: after }, '"2-zstd"'),
    });
    at('/app/events/ev_1');
    await screen.findByRole('heading', { level: 1, name: 'Adaeze and Tunde' });
    act(() => connection.deviceOffline());

    return {
      release: async (answer: Response) => {
        await waitFor(() => expect(held).toHaveLength(1));
        await act(async () => held[0]!(answer));
      },
    };
  }

  function confirm(opener: string, button: string): void {
    fireEvent.click(screen.getByRole('button', { name: opener }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: button }));
  }

  it.each([
    {
      change: 'Make live',
      line: 'POST /api/events/ev_1/make-live',
      before: draft,
      after: live,
      press: () => confirm('Make live', 'Make live'),
      shown: 'Live',
      gone: 'Make live',
    },
    {
      change: 'Pause',
      line: 'POST /api/events/ev_1/pause',
      before: live,
      after: paused,
      press: () => confirm('Pause', 'Pause'),
      shown: 'Paused',
      gone: 'Pause',
    },
    {
      change: 'Resume',
      line: 'POST /api/events/ev_1/resume',
      before: paused,
      after: live,
      press: () => fireEvent.click(screen.getByRole('button', { name: 'Resume' })),
      shown: 'Live',
      gone: 'Resume',
    },
    {
      change: 'Call off',
      line: 'POST /api/events/ev_1/end',
      before: live,
      after: { ...live, ...ended },
      press: () => confirm('Call off…', 'Call off'),
      shown: 'Called off',
      gone: 'Call off…',
    },
    {
      change: 'End now',
      line: 'POST /api/events/ev_1/end',
      before: happening,
      after: { ...happening, ...ended },
      press: () => confirm('End now…', 'End now'),
      shown: 'Finished',
      gone: 'End now…',
    },
  ])(
    'keeps $change when the read it sets off answers the copy from before it',
    async ({ line, before, after, press, shown, gone }) => {
      signedIn();
      const { release } = await staleOn(before, line, after);

      press();
      await waitFor(() =>
        expect(screen.getByText(shown, { selector: '.desk-glass' })).toBeDefined(),
      );
      expect(document.querySelector('.offline-band')).not.toBeNull();
      await release(tagged({ event: before }, '"1"'));

      expect(screen.getByText(shown, { selector: '.desk-glass' })).toBeDefined();
      expect(screen.queryByRole('button', { name: gone })).toBeNull();
      await waitFor(() => expect(document.querySelector('.offline-band')).toBeNull());
    },
  );

  it('keeps the change when the read answers the version shown', async () => {
    signedIn();
    const { release } = await staleOn(draft, 'POST /api/events/ev_1/make-live', live);

    confirm('Make live', 'Make live');
    await waitFor(() =>
      expect(screen.getByText('Live', { selector: '.desk-glass' })).toBeDefined(),
    );
    await release(tagged({ event: live }, '"2"'));

    expect(screen.getByText('Live', { selector: '.desk-glass' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Make live' })).toBeNull();
  });

  it('shows the phase the clock moved on when the read answers the version shown', async () => {
    signedIn();
    const startsLive = { ...happening, phase: 'live' };
    const { release } = await staleOn(draft, 'POST /api/events/ev_1/make-live', startsLive);

    confirm('Make live', 'Make live');
    await waitFor(() =>
      expect(screen.getByText('Live', { selector: '.desk-glass' })).toBeDefined(),
    );
    expect(screen.queryByText('Happening now')).toBeNull();
    await release(tagged({ event: happening }, '"2"'));

    expect(await screen.findByText('Happening now')).toBeDefined();
    expect(screen.queryByText('Live', { selector: '.desk-glass' })).toBeNull();
  });

  it('shows the load error when a re-read is tagged with something that is not a version', async () => {
    signedIn();
    const { release } = await staleOn(draft, 'POST /api/events/ev_1/make-live', live);

    confirm('Make live', 'Make live');
    await waitFor(() =>
      expect(screen.getByText('Live', { selector: '.desk-glass' })).toBeDefined(),
    );
    await release(tagged({ event: live }, 'W/"2"'));

    expect(await screen.findByText('The event did not load. Try again in a moment.')).toBeDefined();
  });

  it('still shows a newer copy, such as a change somebody else made', async () => {
    signedIn();
    const { release } = await staleOn(draft, 'POST /api/events/ev_1/make-live', live);

    confirm('Make live', 'Make live');
    await waitFor(() =>
      expect(screen.getByText('Live', { selector: '.desk-glass' })).toBeDefined(),
    );
    await release(tagged({ event: { ...live, name: 'Adaeze and Tunde, at last' } }, '"3"'));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Adaeze and Tunde, at last' }),
    ).toBeDefined();
  });
});

const TYPED = {
  formatted: '',
  line1: null,
  line2: null,
  city: null,
  region: null,
  postalCode: null,
  countryCode: null,
  latitude: null,
  longitude: null,
};

describe('The cover (sc-3590)', () => {
  const PHOTO = {
    position: 30,
    description: 'Adaeze and Tunde under the arch',
    sizes: [
      { width: 640, url: 'http://store.test/c/small.webp' },
      { width: 1280, url: 'http://store.test/c/medium.webp' },
      { width: 1920, url: 'http://store.test/c/large.webp' },
    ],
  };
  let nextImage: { width: number; height: number } | null = { width: 2400, height: 1600 };

  function serving(cover: unknown, answers: Record<string, Answer> = {}) {
    const sent: { line: string; body: unknown }[] = [];
    let held = event({ cover });

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const line = `${init?.method ?? 'GET'} ${new URL(String(input)).pathname}`;
      const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : null;
      sent.push({ line, body });

      const answer = await answers[line]?.(body, new URL(String(input)));
      if (answer != null) return answer;
      if (line === 'POST /api/orgs/org_1/event-cover-uploads')
        return json(
          {
            upload: {
              url: 'http://store.test/upload/1',
              key: 'event_cover/org_1/2026/10/one.jpg',
              content_type: 'image/jpeg',
            },
          },
          201,
        );
      if (line === 'PUT /upload/1') return new Response(null, { status: 200 });
      if (line === 'POST /api/orgs/org_1/event-cover-uploads/preview')
        return json({ preview: 'data:image/webp;base64,UklGRg==' });
      if (line === 'PUT /api/events/ev_1/cover') {
        const { position, description } = body as { position: number; description: string | null };
        held = event({ cover: { ...PHOTO, position, description } });
      }
      if (line === 'DELETE /api/events/ev_1/cover') held = event({ cover: null });

      return new Response(JSON.stringify({ event: held }), { headers: { ETag: '"1"' } });
    });

    return sent;
  }

  function file(name = 'arch.jpg', type = 'image/jpeg', size = 1000): File {
    const chosen = new File(['x'], name, { type });
    Object.defineProperty(chosen, 'size', { value: size });

    return chosen;
  }

  function choose(chosen: File): void {
    fireEvent.change(document.getElementById('cover-file')!, { target: { files: [chosen] } });
  }

  beforeEach(() => {
    nextImage = { width: 2400, height: 1600 };
    URL.createObjectURL = () => 'blob:chosen';
    URL.revokeObjectURL = () => undefined;
    vi.stubGlobal(
      'Image',
      class {
        naturalWidth = 0;
        naturalHeight = 0;
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        set src(_: string) {
          queueMicrotask(() => {
            if (nextImage == null) return this.onerror?.();
            this.naturalWidth = nextImage.width;
            this.naturalHeight = nextImage.height;
            this.onload?.();
          });
        }
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows the type's default in New event, the general default before a type is chosen", async () => {
    signedIn();
    answering({});
    at('/app/events/new');
    await screen.findByRole('heading', { level: 1, name: 'New event' });

    expect(screen.getByTestId('cover-default').className).toContain('cover-default-other');

    fireEvent.change(document.getElementById('event-type')!, { target: { value: 'baby_shower' } });

    expect(screen.getByTestId('cover-default').className).toContain('cover-default-baby-shower');
    expect(screen.queryByRole('button', { name: /Change photo/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Upload a photo' })).toBeDefined();
  });

  it('shows the cover on the event page over its card and as its row’s unworded thumb, and the list draws it with no words (sc-22103, sc-30413)', async () => {
    signedIn();
    answering({
      'GET /api/events/ev_1': () =>
        json({ event: event({ cover: { ...PHOTO, description: null } }) }),
      'GET /api/orgs/org_1/events': listed([
        event({ cover: PHOTO }),
        event({ id: 'ev_2', type: 'gala' }),
      ]),
    });
    at('/app/events/ev_1');
    await screen.findByRole('heading', { level: 1, name: 'Adaeze and Tunde' });

    expect(screen.queryByRole('img')).toBeNull();
    const pageCovers = document.querySelectorAll('.event-page img');
    expect(pageCovers).toHaveLength(2);
    expect(pageCovers[0]!.closest('.ev-card')).not.toBeNull();
    expect(pageCovers[1]!.closest('.ev-lead')?.getAttribute('aria-hidden')).toBe('true');
    cleanup();

    at('/app/events');
    fireEvent.click(await screen.findByRole('tab', { name: /Drafts/ }));
    await screen.findAllByRole('link', { name: /Adaeze and Tunde/ });

    const covers = document.querySelectorAll('.ev img');
    expect(covers).toHaveLength(1);
    expect(covers[0]!.getAttribute('alt')).toBe('');
    expect(screen.queryByRole('img')).toBeNull();
  });

  it('a new event sends its staged photo once it is created', async () => {
    signedIn();
    const sent = serving(null, {
      'POST /api/orgs/org_1/events': () => json({ event: event() }, 201),
    });
    at('/app/events/new');
    await screen.findByRole('heading', { level: 1, name: 'New event' });

    choose(file());
    const dialog = await screen.findByRole('dialog', { name: 'Cover photo' });
    await waitFor(() => expect(sent.map(({ line }) => line)).toContain('PUT /upload/1'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Use this photo' }));
    await screen.findByRole('button', { name: 'Change photo' });

    fireEvent.change(document.getElementById('event-name')!, { target: { value: 'Owambe' } });
    fireEvent.change(document.getElementById('event-type')!, { target: { value: 'wedding' } });
    for (const [id, value] of [
      ['event-start-date', '2026-11-14'],
      ['event-start-time', '16:00'],
      ['event-end-time', '23:00'],
    ] as const)
      fireEvent.change(document.getElementById(id)!, { target: { value } });
    fireEvent.click(screen.getByRole('button', { name: 'Create event' }));

    await waitFor(() =>
      expect(sent.find(({ line }) => line === 'PUT /api/events/ev_1/cover')?.body).toEqual({
        uploadKey: 'event_cover/org_1/2026/10/one.jpg',
        position: 50,
        description: null,
      }),
    );
  });

  it('a new event left without saving discards the photo it staged (sc-22147)', async () => {
    signedIn();
    const sent = serving(null);
    at('/app/events/new');
    await screen.findByRole('heading', { level: 1, name: 'New event' });

    choose(file());
    const dialog = await screen.findByRole('dialog', { name: 'Cover photo' });
    await waitFor(() => expect(sent.map(({ line }) => line)).toContain('PUT /upload/1'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Use this photo' }));
    await screen.findByRole('button', { name: 'Change photo' });

    fireEvent.click(document.querySelector('.event-back')!);
    fireEvent.click(
      within(await screen.findByRole('alertdialog', { name: 'Leave without saving?' })).getByRole(
        'button',
        { name: 'Leave without saving' },
      ),
    );

    await waitFor(() =>
      expect(
        sent.find(({ line }) => line === 'DELETE /api/orgs/org_1/event-cover-uploads')?.body,
      ).toEqual({ uploadKey: 'event_cover/org_1/2026/10/one.jpg' }),
    );
  });

  it('a new event whose staged photo is refused says so on its page', async () => {
    signedIn();
    const sent = serving(null, {
      'POST /api/orgs/org_1/events': () => json({ event: event() }, 201),
      'PUT /api/events/ev_1/cover': () =>
        problem(422, 'validation_failed', {
          violations: [
            {
              propertyPath: 'file',
              message:
                'That photo is smaller than 1200 × 675 pixels, so it would look blurred. Choose a larger one.',
              code: 'validation_failed',
            },
          ],
        }),
    });
    at('/app/events/new');
    await screen.findByRole('heading', { level: 1, name: 'New event' });

    choose(file());
    const dialog = await screen.findByRole('dialog', { name: 'Cover photo' });
    await waitFor(() => expect(sent.map(({ line }) => line)).toContain('PUT /upload/1'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Use this photo' }));
    await screen.findByRole('button', { name: 'Change photo' });

    fireEvent.change(document.getElementById('event-name')!, { target: { value: 'Owambe' } });
    fireEvent.change(document.getElementById('event-type')!, { target: { value: 'wedding' } });
    for (const [id, value] of [
      ['event-start-date', '2026-11-14'],
      ['event-start-time', '16:00'],
      ['event-end-time', '23:00'],
    ] as const)
      fireEvent.change(document.getElementById(id)!, { target: { value } });
    fireEvent.click(screen.getByRole('button', { name: 'Create event' }));

    expect(
      await screen.findByText(
        'The event is saved without its photo. That photo is smaller than 1200 × 675 pixels, so it would look blurred. Choose a larger one.',
      ),
    ).toBeDefined();
    expect(screen.getByRole('heading', { level: 1, name: 'Adaeze and Tunde' })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Edit details' }));
    const opened = screen.getByRole('group', { name: 'Cover' });
    expect(within(opened).getByRole('button', { name: 'Upload a photo' })).toBeDefined();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  describe("on an event's page, edited in place (sc-48606)", () => {
    const part = () => screen.getByRole('group', { name: 'Cover' });
    const off = (name: string) =>
      within(part()).getByRole('button', { name }).getAttribute('aria-disabled') === 'true';

    function pick(chosen: File): void {
      fireEvent.change(part().querySelector('input[type="file"]')!, {
        target: { files: [chosen] },
      });
    }

    async function opened(cover: unknown, answers: Record<string, Answer> = {}) {
      signedIn();
      const sent = serving(cover, answers);
      at('/app/events/ev_1');
      const row = await screen.findByRole('button', { name: /^(Default cover|Your photo)/u });
      fireEvent.click(row);

      return { sent, row };
    }

    it('opens under Cover photo with no dialog, focus on Upload a photo, and Use this photo saves the upload, its position and description', async () => {
      const { sent, row } = await opened(null);

      expect(screen.queryByRole('dialog')).toBeNull();
      expect(
        within(part()).getByText(/Soirely’s cover, in this event’s own colours/u),
      ).toBeDefined();
      expect(within(part()).getByText(/JPEG, PNG, WebP or HEIC, up to 15 MB/u)).toBeDefined();
      await waitFor(() =>
        expect(document.activeElement).toBe(
          within(part()).getByRole('button', { name: 'Upload a photo' }),
        ),
      );
      expect(off('Save')).toBe(true);

      pick(file());
      const slider = await within(part()).findByLabelText('Photo position');
      expect(part().querySelector('.ev-preview img')?.getAttribute('src')).toBe('blob:chosen');
      fireEvent.change(slider, { target: { value: '80' } });
      expect(slider.getAttribute('aria-valuetext')).toBe('Showing the bottom of the photo');
      expect(within(part()).getByText('Showing the bottom of the photo')).toBeDefined();
      fireEvent.change(within(part()).getByLabelText(/Describe the image/u), {
        target: { value: ' The arch ' },
      });
      fireEvent.click(within(part()).getByRole('button', { name: 'Use this photo' }));

      await waitFor(() => expect(screen.queryByRole('group', { name: 'Cover' })).toBeNull());
      expect(sent.find(({ line }) => line === 'PUT /api/events/ev_1/cover')?.body).toEqual({
        uploadKey: 'event_cover/org_1/2026/10/one.jpg',
        position: 80,
        description: 'The arch',
      });
      expect(await screen.findByText('Saved')).toBeDefined();
      expect(sent.map(({ line }) => line)).not.toContain(
        'DELETE /api/orgs/org_1/event-cover-uploads',
      );
      await waitFor(() => expect(document.activeElement).toBe(row));
    });

    it('on a photo, Save waits for a change; a description is one', async () => {
      await opened(PHOTO);

      await waitFor(() =>
        expect(document.activeElement).toBe(
          within(part()).getByRole('button', { name: 'Change photo' }),
        ),
      );
      expect(off('Save')).toBe(true);
      expect((within(part()).getByLabelText(/Describe the image/u) as HTMLInputElement).value).toBe(
        PHOTO.description,
      );
      fireEvent.change(within(part()).getByLabelText(/Describe the image/u), {
        target: { value: 'The arch' },
      });
      expect(off('Save')).toBe(false);
    });

    it('Remove photo asks nothing and removes only on Save', async () => {
      const { sent } = await opened(PHOTO);

      fireEvent.click(await within(part()).findByRole('button', { name: 'Remove photo' }));
      expect(screen.queryByRole('alertdialog')).toBeNull();
      expect(part().querySelector('.ev-preview.is-photo')).toBeNull();
      expect(sent.map(({ line }) => line)).not.toContain('DELETE /api/events/ev_1/cover');

      fireEvent.click(within(part()).getByRole('button', { name: 'Save' }));
      await waitFor(() => expect(screen.queryByRole('group', { name: 'Cover' })).toBeNull());
      expect(sent.map(({ line }) => line)).toContain('DELETE /api/events/ev_1/cover');
    });

    it('Cancel after Remove photo asks first, and Discard keeps the photo', async () => {
      const { sent } = await opened(PHOTO);

      fireEvent.click(await within(part()).findByRole('button', { name: 'Remove photo' }));
      fireEvent.click(within(part()).getByRole('button', { name: 'Cancel' }));
      const ask = screen.getByRole('alertdialog', { name: 'Discard your change?' });
      fireEvent.click(within(ask).getByRole('button', { name: 'Discard' }));

      expect(screen.queryByRole('group', { name: 'Cover' })).toBeNull();
      expect(sent.map(({ line }) => line)).not.toContain('DELETE /api/events/ev_1/cover');
      expect(screen.getByRole('button', { name: /^Your photo/u })).toBeDefined();
    });

    it('Cancel during an upload asks first, and Discard drops the upload', async () => {
      const { sent } = await opened(null, {
        'POST /api/orgs/org_1/event-cover-uploads/preview': () => new Promise(() => undefined),
      });

      pick(file());
      expect((await within(part()).findByRole('status')).textContent).toBe('Uploading…');
      expect(part().querySelector('.ev-preview.is-photo')).toBeNull();
      expect(off('Save')).toBe(true);
      expect(off('Upload a photo')).toBe(false);
      fireEvent.click(within(part()).getByRole('button', { name: 'Cancel' }));
      fireEvent.click(
        within(screen.getByRole('alertdialog', { name: 'Discard your change?' })).getByRole(
          'button',
          { name: 'Discard' },
        ),
      );

      expect(screen.queryByRole('group', { name: 'Cover' })).toBeNull();
      expect(sent.map(({ line }) => line)).not.toContain('PUT /api/events/ev_1/cover');
    });

    it('refuses a file too small before it uploads, above Upload a photo', async () => {
      const { sent } = await opened(null);
      nextImage = { width: 1199, height: 900 };

      pick(file());

      expect((await within(part()).findByRole('alert')).textContent).toContain(
        'That photo is smaller than 1200 × 675 pixels',
      );
      expect(part().querySelector('.ev-preview.is-photo')).toBeNull();
      expect(sent.filter(({ line }) => line.includes('cover'))).toEqual([]);
    });

    it('an upload the server refuses is discarded, and says why above Upload a photo', async () => {
      const { sent } = await opened(null, {
        'POST /api/orgs/org_1/event-cover-uploads/preview': () => problem(500, 'server_error'),
      });

      pick(file());

      expect((await within(part()).findByRole('alert')).textContent).toContain(
        'The photo did not upload. Try again.',
      );
      expect(part().querySelector('.ev-preview.is-photo')).toBeNull();
      expect(within(part()).getByRole('button', { name: 'Upload a photo' })).toBeDefined();
      await waitFor(() =>
        expect(
          sent.find(({ line }) => line === 'DELETE /api/orgs/org_1/event-cover-uploads')?.body,
        ).toEqual({ uploadKey: 'event_cover/org_1/2026/10/one.jpg' }),
      );
    });

    it('a refused Change photo keeps the photo', async () => {
      await opened(PHOTO);

      pick(file('notes.txt', 'text/plain'));

      expect((await within(part()).findByRole('alert')).textContent).toContain(
        'That file is not a photo we can use.',
      );
      expect(part().querySelector('.ev-preview.is-photo')).not.toBeNull();
      expect(off('Save')).toBe(true);
    });

    it('a save the server refuses keeps the edit open with the photo chosen, and says why', async () => {
      await opened(null, {
        'PUT /api/events/ev_1/cover': () => problem(500, 'server_error'),
      });

      pick(file());
      await within(part()).findByLabelText('Photo position');
      fireEvent.click(within(part()).getByRole('button', { name: 'Use this photo' }));

      expect((await within(part()).findByRole('alert')).textContent).toContain(
        'The photo did not upload. Try again.',
      );
      expect(part().querySelector('.ev-preview.is-photo')).not.toBeNull();
      expect(off('Use this photo')).toBe(false);
    });

    it('a save the role no longer allows says so, with no Try again (sc-49861)', async () => {
      await opened(null, {
        'PUT /api/events/ev_1/cover': () => problem(403, 'permission_required'),
      });

      pick(file());
      await within(part()).findByLabelText('Photo position');
      fireEvent.click(within(part()).getByRole('button', { name: 'Use this photo' }));

      expect((await within(part()).findByRole('alert')).textContent).toContain(
        'Nothing was changed. Your role does not include the permission this needs.',
      );
      expect(within(part()).queryByText(/Try again/u)).toBeNull();
      expect(part().querySelector('.ev-preview.is-photo')).not.toBeNull();
    });

    it('refuses a description over 250 characters and saves nothing', async () => {
      const { sent } = await opened(PHOTO);

      fireEvent.change(await within(part()).findByLabelText(/Describe the image/u), {
        target: { value: 'x'.repeat(251) },
      });
      fireEvent.click(within(part()).getByRole('button', { name: 'Save' }));

      expect(
        await within(part()).findByText('Shorten the description to 250 characters or fewer.'),
      ).toBeDefined();
      expect(sent.map(({ line }) => line)).not.toContain('PUT /api/events/ev_1/cover');
    });
  });
});

describe('A HEIC the browser cannot show, and a cover that will not load (sc-13861)', () => {
  const PHOTO = {
    position: 30,
    description: 'Adaeze and Tunde under the arch',
    sizes: [
      { width: 640, url: 'http://store.test/c/small.webp' },
      { width: 1280, url: 'http://store.test/c/medium.webp' },
    ],
  };
  const COPY = 'data:image/webp;base64,UklGRg==';
  const PREVIEW = 'POST /api/orgs/org_1/event-cover-uploads/preview';

  function refusedWith(message: string): Answer {
    return () =>
      problem(422, 'validation_failed', {
        violations: [{ propertyPath: 'file', message, code: 'validation_failed' }],
      });
  }

  function serving(cover: unknown, answers: Record<string, Answer> = {}) {
    const sent: { line: string; body: unknown }[] = [];
    let held = event({ cover });

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const line = `${init?.method ?? 'GET'} ${new URL(String(input)).pathname}`;
      const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : null;
      sent.push({ line, body });

      const answer = await answers[line]?.(body, new URL(String(input)));
      if (answer != null) return answer;
      if (line === 'POST /api/orgs/org_1/event-cover-uploads')
        return json(
          {
            upload: {
              url: 'http://store.test/upload/1',
              key: 'event_cover/org_1/2026/10/one.heic',
              content_type: 'image/heic',
            },
          },
          201,
        );
      if (line === 'PUT /upload/1') return new Response(null, { status: 200 });
      if (line === PREVIEW) return json({ preview: COPY });
      if (line === 'DELETE /api/orgs/org_1/event-cover-uploads')
        return new Response(null, { status: 204 });
      if (line === 'PUT /api/events/ev_1/cover') {
        const { position, description } = body as { position: number; description: string | null };
        held = event({ cover: { ...PHOTO, position, description } });
      }

      return new Response(JSON.stringify({ event: held }), { headers: { ETag: '"1"' } });
    });

    return sent;
  }

  function chooseHeic(): void {
    fireEvent.change(document.getElementById('cover-file')!, {
      target: { files: [new File(['x'], 'IMG_0412.HEIC', { type: '' })] },
    });
  }

  beforeEach(() => {
    URL.createObjectURL = () => 'blob:chosen';
    URL.revokeObjectURL = () => undefined;
    vi.stubGlobal(
      'Image',
      class {
        onerror: (() => void) | null = null;
        set src(_: string) {
          queueMicrotask(() => this.onerror?.());
        }
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('a HEIC refused in New event never creates an event without its photo', async () => {
    signedIn();
    const sent = serving(null, {
      [PREVIEW]: refusedWith(
        'That photo is smaller than 1200 × 675 pixels, so it would look blurred. Choose a larger one.',
      ),
    });
    at('/app/events/new');
    await screen.findByRole('heading', { level: 1, name: 'New event' });

    chooseHeic();
    const dialog = await screen.findByRole('dialog', { name: 'Cover photo' });
    await within(dialog).findByText(/smaller than 1200 × 675/);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Use this photo' }));

    expect(screen.getByRole('dialog', { name: 'Cover photo' })).toBeDefined();
    expect(sent.map(({ line }) => line)).not.toContain('POST /api/orgs/org_1/events');
  });

  it('shows the HEIC in New event’s Cover section before the event is created', async () => {
    signedIn();
    serving(null);
    at('/app/events/new');
    await screen.findByRole('heading', { level: 1, name: 'New event' });

    chooseHeic();
    const dialog = await screen.findByRole('dialog', { name: 'Cover photo' });
    await waitFor(() => expect(dialog.querySelector('.cover-frame img')).not.toBeNull());
    fireEvent.click(within(dialog).getByRole('button', { name: 'Use this photo' }));

    const cover = await screen.findByRole('button', { name: 'Change photo' });
    expect(cover.querySelector('img')?.getAttribute('src')).toBe(COPY);
  });
});

describe('Make live asks for a missing host (sc-22143)', () => {
  const AHEAD = { startsAt: '2030-11-14T16:00:00+01:00', endsAt: '2030-11-15T02:00:00+01:00' };
  const SAVE = 'PATCH /api/events/ev_1';
  const LIVE = 'POST /api/events/ev_1/make-live';

  function tagged(body: unknown, tag: string, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { ETag: tag } });
  }

  async function asking(answers: Record<string, Answer> = {}) {
    const sent = answering({
      'GET /api/events/ev_1': () => json({ event: event({ ...AHEAD, hosts: [] }) }),
      ...answers,
    });
    at('/app/events/ev_1');
    await screen.findByRole('heading', { level: 1, name: 'Adaeze and Tunde' });
    fireEvent.click(screen.getByRole('button', { name: 'Make live' }));
    const dialog = await screen.findByRole('dialog', { name: 'Make Adaeze and Tunde live?' });

    return { sent, dialog, host: within(dialog).getByLabelText<HTMLTextAreaElement>('Host 1') };
  }

  function press(dialog: HTMLElement): void {
    fireEvent.click(within(dialog).getByRole('button', { name: 'Make live' }));
  }

  function linesOf(sent: { line: string }[]): string[] {
    return sent.map(({ line }) => line).filter((line) => line === SAVE || line === LIVE);
  }

  it('opens the confirmation with Host 1, its explainer, and the cursor in it', async () => {
    signedIn();
    const { dialog, host } = await asking();

    await waitFor(() => expect(document.activeElement).toBe(host));
    expect(host.getAttribute('enterkeyhint')).toBe('go');
    expect(
      within(dialog).getByText(
        'Guests read this name on their invitation and their page. Write it the way you want guests to see it.',
      ),
    ).toBeDefined();
    expect(screen.queryByText('Add who is hosting before guests are invited.')).toBeNull();
  });

  it('saves the typed name as the one host with the version read, then makes it live', async () => {
    signedIn();
    let held = { event: event({ ...AHEAD, hosts: [] }), tag: '"1"' };
    const hold = (next: typeof held) => {
      held = next;

      return tagged({ event: next.event }, next.tag);
    };
    const { sent, dialog, host } = await asking({
      // An earlier test's unanswered request can tell the page it lost Soirely, and it reads the event again.
      'GET /api/events/ev_1': () => tagged({ event: held.event }, held.tag),
      [SAVE]: () => hold({ event: event({ ...AHEAD, hosts: ['Funmi Adeyemi'] }), tag: '"2"' }),
      [LIVE]: () =>
        hold({
          event: event({ ...AHEAD, status: 'live', phase: 'live', hosts: ['Funmi Adeyemi'] }),
          tag: '"3"',
        }),
    });

    fireEvent.change(host, { target: { value: ' Funmi Adeyemi ' } });
    press(dialog);

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(linesOf(sent)).toEqual([SAVE, LIVE]);
    expect(sent.find(({ line }) => line === SAVE)?.body).toEqual({ hosts: ['Funmi Adeyemi'] });
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('✓ Live'));
    expect(screen.getByText('Live')).toBeDefined();
  });

  it('runs Make live from Enter in Host 1', async () => {
    signedIn();
    const { sent, host } = await asking({
      [SAVE]: () => tagged({ event: event({ ...AHEAD, hosts: ['Funmi'] }) }, '"2"'),
      [LIVE]: () => tagged({ event: event({ ...AHEAD, status: 'live', hosts: ['Funmi'] }) }, '"3"'),
    });

    fireEvent.change(host, { target: { value: 'Funmi' } });
    fireEvent.keyDown(host, { key: 'Enter' });

    await waitFor(() => expect(linesOf(sent)).toEqual([SAVE, LIVE]));
  });

  it('sends nothing with Host 1 empty, says why under it, and keeps focus there', async () => {
    signedIn();
    const { sent, dialog, host } = await asking();

    press(dialog);

    await waitFor(() => expect(document.activeElement).toBe(host));
    expect(within(dialog).getByText('Enter who is hosting to make this event live.')).toBeDefined();
    expect(host.getAttribute('aria-invalid')).toBe('true');
    expect(host.getAttribute('aria-describedby')).toBe('make-live-host-error make-live-host-help');
    expect(linesOf(sent)).toEqual([]);
    expect(screen.getByText('Draft')).toBeDefined();
  });

  it("refuses a name breaking sc-6713's rules with that rule's message", async () => {
    signedIn();
    const { sent, dialog, host } = await asking();

    fireEvent.change(host, { target: { value: 'é'.repeat(66) } });
    press(dialog);

    expect(
      await within(dialog).findByText(
        "A host's name can be at most 60 characters. This one has 66.",
      ),
    ).toBeDefined();
    expect(host.value).toBe('é'.repeat(66));
    expect(linesOf(sent)).toEqual([]);
  });

  it('keeps the host saved when going live is refused, and says why', async () => {
    signedIn();
    const { sent, dialog, host } = await asking({
      [SAVE]: () => tagged({ event: event({ ...AHEAD, hosts: ['Funmi'] }) }, '"2"'),
      [LIVE]: () => problem(403, 'plan_limit', { plan: 'Free', limit: 3 }),
    });

    fireEvent.change(host, { target: { value: 'Funmi' } });
    press(dialog);

    const refused = await screen.findByRole('alertdialog', {
      name: 'Not made live. Your Free plan allows 3 events to be live or paused at a time.',
    });
    fireEvent.click(within(refused).getByRole('button', { name: 'Close' }));
    expect(linesOf(sent)).toEqual([SAVE, LIVE]);

    fireEvent.click(screen.getByRole('button', { name: 'Make live' }));
    const again = await screen.findByRole('dialog', { name: 'Make Adaeze and Tunde live?' });
    expect(within(again).queryByLabelText('Host 1')).toBeNull();
  });

  it('retries only going live, with the version the save returned, when that alone failed', async () => {
    signedIn();
    let tries = 0;
    const { sent, dialog, host } = await asking({
      [SAVE]: () => tagged({ event: event({ ...AHEAD, hosts: ['Funmi'] }) }, '"2"'),
      [LIVE]: () => {
        if ((tries += 1) === 1) throw new TypeError('Failed to fetch');
        return tagged({ event: event({ ...AHEAD, status: 'live', hosts: ['Funmi'] }) }, '"3"');
      },
    });

    fireEvent.change(host, { target: { value: 'Funmi' } });
    press(dialog);

    expect((await within(dialog).findByRole('alert')).textContent).toContain(
      'Not made live. Try again in a moment.',
    );
    expect(within(dialog).queryByLabelText('Host 1')).toBeNull();
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(dialog).getByRole('button', { name: 'Make live' }),
      ),
    );
    press(dialog);

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(linesOf(sent)).toEqual([SAVE, LIVE, LIVE]);
  });

  describe('a 412 reads the event again', () => {
    function changedTo(latest: Record<string, unknown>) {
      let reads = 0;

      return {
        'GET /api/events/ev_1': () =>
          tagged(
            { event: event({ ...AHEAD, hosts: [], ...((reads += 1) === 1 ? {} : latest) }) },
            `"${reads}"`,
          ),
        [SAVE]: (_body: unknown) =>
          reads === 1
            ? problem(412, 'precondition_failed')
            : tagged({ event: event({ ...AHEAD, hosts: ['Funmi'] }) }, '"9"'),
        [LIVE]: () =>
          tagged({ event: event({ ...AHEAD, status: 'live', hosts: ['Funmi'] }) }, '"10"'),
      } satisfies Record<string, Answer>;
    }

    it('still with no host: keeps the name, says so above it, and sends again on the new version', async () => {
      signedIn();
      const { sent, dialog, host } = await asking(changedTo({ name: 'Adaeze and Tunde' }));

      fireEvent.change(host, { target: { value: 'Funmi' } });
      press(dialog);

      expect((await within(dialog).findByRole('alert')).textContent).toContain(
        'Not saved. Somebody else changed this event since you opened it. What you typed is still here.',
      );
      expect(within(dialog).getByLabelText<HTMLTextAreaElement>('Host 1').value).toBe('Funmi');
      await waitFor(() =>
        expect(document.activeElement).toBe(within(dialog).getByLabelText('Host 1')),
      );

      press(dialog);

      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(linesOf(sent)).toEqual([SAVE, SAVE, LIVE]);
    });

    it('now hosted: drops Host 1, lists who is hosting one per line, and never overwrites them', async () => {
      signedIn();
      const hosts = ['Dr Bello', 'Chief and Mrs Adeyemi'];
      const { sent, dialog, host } = await asking(changedTo({ hosts }));

      fireEvent.change(host, { target: { value: 'Funmi' } });
      press(dialog);

      const list = await within(dialog).findByRole('list');
      expect(
        within(list)
          .getAllByRole('listitem')
          .map((item) => item.textContent),
      ).toEqual(hosts);
      expect(within(dialog).getByText('Who is hosting now, as guests will see it:')).toBeDefined();
      expect(
        within(dialog).getByText(
          'Not saved. Somebody else changed this event since you opened it.',
        ),
      ).toBeDefined();
      expect(within(dialog).queryByLabelText('Host 1')).toBeNull();
      await waitFor(() => expect(document.activeElement).toBe(within(dialog).getByRole('group')));

      press(dialog);

      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(linesOf(sent)).toEqual([SAVE, LIVE]);
    });

    it('no longer a draft: says what it is now, with Close', async () => {
      signedIn();
      const { sent, dialog, host } = await asking(
        changedTo({ status: 'live', hosts: ['Tayo'], madeLiveAt: '2026-10-30T09:00:00+00:00' }),
      );

      fireEvent.change(host, { target: { value: 'Funmi' } });
      press(dialog);

      const changed = await screen.findByRole('alertdialog', {
        name: 'Somebody else changed this event while you had it open.',
      });
      expect(within(changed).getByRole('button', { name: 'Close' })).toBeDefined();
      expect(linesOf(sent)).toEqual([SAVE]);
    });
  });

  it('goes the way of a 412 when the host goes between opening and going live', async () => {
    signedIn();
    let reads = 0;
    answering({
      'GET /api/events/ev_1': () =>
        json({ event: event({ ...AHEAD, hosts: (reads += 1) === 1 ? ['Funmi Adeyemi'] : [] }) }),
      [LIVE]: () => problem(409, 'event_host_required'),
    });
    at('/app/events/ev_1');
    await screen.findByRole('heading', { level: 1, name: 'Adaeze and Tunde' });
    fireEvent.click(screen.getByRole('button', { name: 'Make live' }));
    const dialog = await screen.findByRole('dialog', { name: 'Make Adaeze and Tunde live?' });
    expect(within(dialog).queryByLabelText('Host 1')).toBeNull();

    press(dialog);

    expect(await within(dialog).findByLabelText('Host 1')).toBeDefined();
  });
});

describe("An event's timeline: Coming up and All dates (sc-3624)", () => {
  function milestone(at: string, title: string, owner = 'event') {
    return { at, title, note: null, owner, area: 'events', action: null };
  }

  const MADRID = {
    timeZone: 'Europe/Madrid',
    milestones: [
      milestone('2026-10-10T12:00:00+02:00', 'Save the date sent', 'automatic'),
      milestone('2026-10-17T18:00:00+02:00', 'Boda starts'),
      milestone('2026-10-18T09:00:00+02:00', 'Brunch', 'automatic'),
      milestone('2026-10-19T12:00:00+02:00', 'Balance due', 'you'),
      milestone('2026-10-20T12:00:00+02:00', 'Thank-you notes sent', 'automatic'),
      milestone('2026-10-26T02:00:00+01:00', 'Boda ends'),
    ],
  };

  function clockAt(device: string): void {
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['Date'] });
    vi.setSystemTime(new Date(device));
    serverClock.observe(new Date(device).toUTCString());
  }

  afterEach(() => {
    vi.useRealTimers();
    serverClock.observe(new Date().toUTCString());
  });

  async function comingUp(): Promise<HTMLElement> {
    await screen.findByRole('heading', { level: 1, name: 'Adaeze and Tunde' });

    return screen.getByRole('region', { name: 'Coming up' });
  }

  function rows(within_: HTMLElement): string[] {
    return within(within_)
      .getAllByRole('listitem')
      .map((row) => spaced(row.textContent));
  }

  it('shows the next four with how far away each is and its owner as a word', async () => {
    clockAt('2026-10-11T08:00:00Z');
    signedIn();
    answering({
      'GET /api/events/ev_1': () => json({ event: event() }),
      'GET /api/events/ev_1/timeline': () => json(MADRID),
    });
    at('/app/events/ev_1');

    const panel = await comingUp();

    await waitFor(() => expect(within(panel).getAllByRole('listitem')).toHaveLength(4));
    expect(rows(panel)).toEqual([
      'Sat, Oct 17, 18:00 (Europe/Madrid) · in 6 daysBoda startsEventNext up',
      'Sun, Oct 18, 09:00 (Europe/Madrid) · in 7 daysBrunchAutomatic',
      'Mon, Oct 19, 12:00 (Europe/Madrid) · in 8 daysBalance dueYou',
      'Tue, Oct 20, 12:00 (Europe/Madrid) · in 9 daysThank-you notes sentAutomatic',
    ]);
    expect(within(panel).getByRole('link', { name: 'All dates' }).getAttribute('href')).toBe(
      '/app/events/ev_1/dates',
    );
  });

  it('names the year on a row whose date is not in the current year (sc-30413)', async () => {
    clockAt('2025-12-31T22:30:00Z');
    signedIn();
    answering({
      'GET /api/events/ev_1': () => json({ event: event() }),
      'GET /api/events/ev_1/timeline': () =>
        json({
          ...MADRID,
          milestones: [
            milestone('2025-12-31T23:45:00+01:00', 'Countdown'),
            ...MADRID.milestones.slice(1, 3),
          ],
        }),
    });
    at('/app/events/ev_1');

    const panel = await comingUp();

    await waitFor(() => expect(within(panel).getAllByRole('listitem')).toHaveLength(3));
    expect(rows(panel)).toEqual([
      'Wed, Dec 31, 23:45 (Europe/Madrid) · todayCountdownEventNext up',
      'Sat, Oct 17, 2026, 18:00 (Europe/Madrid) · in 290 daysBoda startsEvent',
      'Sun, Oct 18, 2026, 09:00 (Europe/Madrid) · in 291 daysBrunchAutomatic',
    ]);
  });

  it('takes the current year in the event’s zone, not in UTC (sc-30413)', async () => {
    clockAt('2025-12-31T23:30:00Z');
    signedIn();
    answering({
      'GET /api/events/ev_1': () => json({ event: event() }),
      'GET /api/events/ev_1/timeline': () =>
        json({
          ...MADRID,
          milestones: [
            milestone('2026-01-01T10:00:00+01:00', 'New year brunch'),
            ...MADRID.milestones.slice(1, 3),
          ],
        }),
    });
    at('/app/events/ev_1');

    const panel = await comingUp();

    await waitFor(() => expect(within(panel).getAllByRole('listitem')).toHaveLength(3));
    expect(rows(panel)).toEqual([
      'Thu, Jan 1, 10:00 (Europe/Madrid) · todayNew year brunchEventNext up',
      'Sat, Oct 17, 18:00 (Europe/Madrid) · in 289 daysBoda startsEvent',
      'Sun, Oct 18, 09:00 (Europe/Madrid) · in 290 daysBrunchAutomatic',
    ]);
  });

  it('says nothing is coming up once everything has passed, and still links All dates', async () => {
    clockAt('2026-11-01T08:00:00Z');
    signedIn();
    answering({
      'GET /api/events/ev_1': () => json({ event: event() }),
      'GET /api/events/ev_1/timeline': () =>
        json({ ...MADRID, milestones: MADRID.milestones.filter((one) => one.owner !== 'you') }),
    });
    at('/app/events/ev_1');

    const panel = await comingUp();

    expect(
      await within(panel).findByText('Nothing coming up. Every date on this event has passed.'),
    ).toBeDefined();
    expect(within(panel).queryByRole('listitem')).toBeNull();
    expect(within(panel).getByRole('link', { name: 'All dates' })).toBeDefined();
  });

  it('shows no rows and no All dates link while it fails, until Try again loads it', async () => {
    clockAt('2026-10-11T08:00:00Z');
    signedIn();
    let calls = 0;
    answering({
      'GET /api/events/ev_1': () => json({ event: event() }),
      'GET /api/events/ev_1/timeline': () =>
        ++calls === 1 ? problem(500, 'internal_error') : json(MADRID),
    });
    at('/app/events/ev_1');

    const panel = await comingUp();

    expect(await within(panel).findByText('The dates did not load.')).toBeDefined();
    expect(within(panel).queryByRole('listitem')).toBeNull();
    expect(within(panel).queryByRole('link', { name: 'All dates' })).toBeNull();

    fireEvent.click(within(panel).getByRole('button', { name: 'Try again' }));

    await waitFor(() => expect(within(panel).getAllByRole('listitem')).toHaveLength(4));
    expect(within(panel).getByRole('link', { name: 'All dates' })).toBeDefined();
    expect(within(panel).queryByText('The dates did not load.')).toBeNull();
  });

  it('says Loading the dates… in Coming up from one second until the dates arrive, with All dates linked (sc-23303)', async () => {
    clockAt('2026-10-11T08:00:00Z');
    signedIn();
    let arrive = (): void => undefined;
    answering({
      'GET /api/events/ev_1': () => json({ event: event() }),
      'GET /api/events/ev_1/timeline': () =>
        new Promise<Response>((resolve) => {
          arrive = () => resolve(json(MADRID));
        }),
    });
    at('/app/events/ev_1');

    const panel = await comingUp();

    expect(within(panel).queryByRole('status')).toBeNull();
    expect(within(panel).getByRole('link', { name: 'All dates' })).toBeDefined();
    await waitFor(() =>
      expect(within(panel).getByRole('status').textContent).toBe('Loading the dates…'),
    );
    expect(panel.querySelector('[aria-busy="true"]')).not.toBeNull();
    arrive();

    await waitFor(() => expect(within(panel).getAllByRole('listitem')).toHaveLength(4));
    expect(within(panel).queryByText('Loading the dates…')).toBeNull();
  });

  it('lists every milestone in All dates under its zone, named once, Passed and Next up as words', async () => {
    clockAt('2026-10-11T08:00:00Z');
    signedIn();
    answering({
      'GET /api/events/ev_1': () => json({ event: event() }),
      'GET /api/events/ev_1/timeline': () => json(MADRID),
    });
    at('/app/events/ev_1/dates');

    const heading = await screen.findByRole('heading', { level: 2, name: 'All dates' });
    const page = heading.closest('section')!;

    expect(
      await within(page).findByText(
        "Every date on this event, earliest first. Times are in Europe/Madrid, the event's time zone.",
      ),
    ).toBeDefined();
    expect(rows(page)).toEqual([
      'Sat, Oct 10, 12:00Save the date sentAutomatic✓ Passed',
      'Sat, Oct 17, 18:00Boda startsEventNext up',
      'Sun, Oct 18, 09:00BrunchAutomatic',
      'Mon, Oct 19, 12:00Balance dueYou',
      'Tue, Oct 20, 12:00Thank-you notes sentAutomatic',
      'Mon, Oct 26, 02:00Boda endsEvent',
    ]);
    expect(within(page).getByText('Something you need to do')).toBeDefined();
  });

  it('reads the dates again on Call off, and the called-off moment is never Next up, even stamped a second ahead of the clock (sc-16709)', async () => {
    clockAt('2030-10-13T09:00:00Z');
    signedIn();
    const ahead = { startsAt: '2030-11-14T16:00:00+01:00', endsAt: '2030-11-15T02:00:00+01:00' };
    let reads = 0;
    answering({
      'GET /api/events/ev_1': () =>
        new Response(
          JSON.stringify({ event: event({ ...ahead, status: 'live', phase: 'live' }) }),
          {
            headers: { ETag: '"1"' },
          },
        ),
      'GET /api/events/ev_1/timeline': () =>
        json(
          ++reads === 1
            ? {
                timeZone: 'Africa/Lagos',
                milestones: [milestone(ahead.startsAt, 'Adaeze and Tunde starts')],
              }
            : {
                timeZone: 'Africa/Lagos',
                milestones: [milestone('2030-10-13T10:00:05+01:00', 'Adaeze and Tunde called off')],
              },
        ),
      'POST /api/events/ev_1/end': () =>
        new Response(
          JSON.stringify({
            event: event({
              ...ahead,
              status: 'ended',
              phase: 'finished',
              concludedAt: '2030-10-13T10:00:05+01:00',
            }),
          }),
          { headers: { ETag: '"2"' } },
        ),
    });
    const read = vi.spyOn(api, 'eventTimeline');
    at('/app/events/ev_1');

    const panel = await comingUp();
    await waitFor(() => expect(rows(panel)).toHaveLength(1));

    vi.setSystemTime(new Date('2030-10-13T09:00:04.200Z'));
    fireEvent.click(screen.getByRole('button', { name: 'Call off…' }));
    const dialog = await screen.findByRole('dialog', { name: 'Call off Adaeze and Tunde?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Call off' }));
    // The ended event offers nothing from the first read, so the empty text shows before the second goes out.
    await waitFor(() => expect(read).toHaveBeenCalledTimes(2));
    await act(() => read.mock.results[1]!.value as Promise<unknown>);

    expect(
      await within(panel).findByText('Nothing coming up. Every date on this event has passed.'),
    ).toBeDefined();
    expect(within(panel).queryByRole('listitem')).toBeNull();
    expect(reads).toBe(2);
  });

  it('says Loading the dates… in All dates until the dates arrive', async () => {
    clockAt('2026-10-11T08:00:00Z');
    signedIn();
    let arrive = (): void => undefined;
    answering({
      'GET /api/events/ev_1': () => json({ event: event() }),
      'GET /api/events/ev_1/timeline': () =>
        new Promise<Response>((resolve) => {
          arrive = () => resolve(json(MADRID));
        }),
    });
    at('/app/events/ev_1/dates');

    const page = (await screen.findByRole('heading', { level: 2, name: 'All dates' })).closest(
      'section',
    )!;

    expect(await within(page).findByText('Loading the dates…')).toBeDefined();
    arrive();

    await waitFor(() => expect(within(page).getAllByRole('listitem')).toHaveLength(6));
    expect(within(page).queryByText('Loading the dates…')).toBeNull();
  });

  it('marks an overdue You milestone Overdue and keeps it Next up', async () => {
    clockAt('2026-10-21T08:00:00Z');
    signedIn();
    answering({
      'GET /api/events/ev_1': () => json({ event: event() }),
      'GET /api/events/ev_1/timeline': () => json(MADRID),
    });
    at('/app/events/ev_1/dates');

    const page = (await screen.findByRole('heading', { level: 2, name: 'All dates' })).closest(
      'section',
    )!;

    await waitFor(() => expect(within(page).getAllByRole('listitem')).toHaveLength(6));
    expect(rows(page)[3]).toBe('Mon, Oct 19, 12:00Balance dueYou⚠ OverdueNext up');
    expect(rows(page)[4]).toBe('Tue, Oct 20, 12:00Thank-you notes sentAutomatic✓ Passed');
  });

  it('marks nothing Next up in All dates once the event is over', async () => {
    clockAt('2026-11-01T08:00:00Z');
    signedIn();
    answering({
      'GET /api/events/ev_1': () => json({ event: event() }),
      'GET /api/events/ev_1/timeline': () =>
        json({ ...MADRID, milestones: MADRID.milestones.filter((one) => one.owner !== 'you') }),
    });
    at('/app/events/ev_1/dates');

    const page = (await screen.findByRole('heading', { level: 2, name: 'All dates' })).closest(
      'section',
    )!;

    await waitFor(() => expect(within(page).getAllByRole('listitem')).toHaveLength(5));
    expect(within(page).queryByText('Next up')).toBeNull();
    expect(within(page).getAllByText('Passed')).toHaveLength(5);
  });

  it('shows Try again in All dates when it fails, with no rows', async () => {
    signedIn();
    answering({
      'GET /api/events/ev_1': () => json({ event: event() }),
      'GET /api/events/ev_1/timeline': () => problem(500, 'internal_error'),
    });
    at('/app/events/ev_1/dates');

    const page = (await screen.findByRole('heading', { level: 2, name: 'All dates' })).closest(
      'section',
    )!;

    expect(await within(page).findByText('The dates did not load.')).toBeDefined();
    expect(within(page).getByRole('button', { name: 'Try again' })).toBeDefined();
    expect(within(page).queryByRole('listitem')).toBeNull();
  });
});

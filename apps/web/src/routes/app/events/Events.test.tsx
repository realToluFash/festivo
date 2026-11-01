import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { EVENT_TYPES, forgetEventsTab, serverClock } from '@soirely/domain';

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
    hosts: ['Funmi Adeyemi'],
    madeLiveAt: null,
    pausedAt: null,
    phase: 'draft',
    concludedAt: null,
    createdAt: '2026-10-21T09:00:00+00:00',
    ...overrides,
  };
}

function signedIn(organisation = IRE, organisations = [organisation]): void {
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

    return (await answers[line]?.(body, url)) ?? json({});
  });

  return sent;
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

afterEach(() => {
  vi.restoreAllMocks();
  forgetEventsTab();
});

describe('Events', () => {
  it('lists each draft as one link: its type, its dates and start, Draft, placeholders and its next step (sc-22103)', async () => {
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
    const rows = within(screen.getByRole('tabpanel')).getAllByRole('listitem');

    expect(rows.map((row) => spaced(row.textContent))).toEqual([
      'Adaeze and TundeWeddingSaturday, Nov 14 to Sunday, Nov 1516:00 · Africa/Lagos · in 32 daysDraftGuests Coming soonReplies Coming soonGuests can’t be invited until this event is live.',
      'Board dinnerCorporate eventTuesday, Dec 119:00 · Europe/London · in 49 daysDraftGuests Coming soonReplies Coming soonGuests can’t be invited until this event is live.',
    ]);
    expect(within(rows[0]!).getAllByRole('link')).toHaveLength(1);
    expect(within(rows[0]!).getByRole('link').getAttribute('href')).toBe('/app/events/ev_1');
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

    expect(within(card).getAllByRole('listitem')).toHaveLength(3);
    expect(within(card).getByRole('link', { name: 'Create an event' }).getAttribute('href')).toBe(
      '/app/events/new',
    );
    expect(screen.queryByRole('table')).toBeNull();
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
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);

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
    at('/app');

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

  it('shows Happening now above the tabs as one link, with its dates, placeholders and Next up, on every tab', async () => {
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

    const now = (await screen.findByRole('heading', { name: 'Happening now' })).parentElement!;
    const card = within(now).getByRole('listitem');
    expect(spaced(card.textContent)).toBe(
      'Sunday, Nov 1 to Tuesday, Nov 3Happening nowTonightWedding09:00 · Europe/Madrid · Ends in 2 daysArrived Coming soonCourse Coming soonNext cue Coming soonNext up Tonight ends',
    );
    expect(within(card).getAllByRole('link')).toHaveLength(1);

    const upcoming = screen.getByRole('tabpanel');
    expect(spaced(within(upcoming).getByRole('listitem').textContent)).toBe(
      'LaterWeddingSaturday, Nov 14 to Sunday, Nov 1516:00 · Africa/Lagos · in 13 daysLiveGuests Coming soonReplies Coming soonNext up Later starts',
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Past 0' }));
    expect(screen.getByRole('heading', { name: 'Happening now' })).toBeDefined();
  });

  it('says how soon each event is, a minute behind the clock at most, and how soon it ends from its start (sc-25008)', async () => {
    signedIn();
    answering({
      'GET /api/orgs/org_1/events': listed([
        live('Party', {
          startsAt: '2026-11-01T12:03:30Z',
          endsAt: '2026-11-01T14:00:00Z',
          timeZone: 'Africa/Lagos',
          milestones: [],
        }),
      ]),
    });
    at('/app/events');

    const row = async () =>
      spaced(within(await screen.findByRole('tabpanel')).getByRole('link').textContent);
    expect(await row()).toContain('13:03 · Africa/Lagos · in 3 minutes');

    await act(() => vi.advanceTimersByTimeAsync(60_000));
    expect(await row()).toContain('13:03 · Africa/Lagos · in 2 minutes');

    await act(() => vi.advanceTimersByTimeAsync(150_000));
    const now = (await screen.findByRole('heading', { name: 'Happening now' })).parentElement!;
    expect(spaced(within(now).getByRole('link').textContent)).toContain(
      '13:03 · Africa/Lagos · Ends in 1 hour',
    );
  });

  it('reads the last minute as this minute, and gives a draft past its start and a finished event no phrase (sc-25008)', async () => {
    signedIn();
    answering({
      'GET /api/orgs/org_1/events': listed(
        [
          live('Soon', { startsAt: '2026-11-01T12:00:40Z', milestones: [] }),
          event({
            id: 'late',
            name: 'Late draft',
            startsAt: '2026-11-01T10:00:00Z',
            endsAt: '2026-11-01T14:00:00Z',
            milestones: [],
          }),
        ],
        finished(1),
      ),
    });
    at('/app/events');

    const rows = async () =>
      within(await screen.findByRole('tabpanel'))
        .getAllByRole('link')
        .map((link) => spaced(link.textContent));
    expect((await rows())[0]).toContain('13:00 · Africa/Lagos · this minute');

    fireEvent.click(screen.getByRole('tab', { name: 'Drafts 1' }));
    expect((await rows())[0]).toContain('11:00 · Africa/LagosDraft');

    fireEvent.click(screen.getByRole('tab', { name: 'Past 1' }));
    expect((await rows())[0]).not.toMatch(/ · (in |Ends )/);
  });

  it('reads a Happening now event that started before today as its first and last day', async () => {
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

    const now = (await screen.findByRole('heading', { name: 'Happening now' })).parentElement!;
    expect(spaced(within(now).getByRole('listitem').textContent)).toBe(
      'Saturday, Oct 31 to Monday, Nov 2Happening nowWeekendWedding09:00 · Europe/Madrid · Ends in 13 hoursArrived Coming soonCourse Coming soonNext cue Coming soonNext up Weekend ends',
    );
  });

  it('leaves Happening now out when nothing is, and Next up out with no milestone ahead', async () => {
    signedIn();
    answering({ 'GET /api/orgs/org_1/events': listed([live('Later')]) });
    at('/app/events');

    const [row] = await screen.findAllByRole('listitem');

    expect(screen.queryByRole('heading', { name: 'Happening now' })).toBeNull();
    expect(row!.textContent).not.toContain('Next up');
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
    expect(
      within(screen.getByRole('tabpanel'))
        .getAllByRole('link')
        .map((link) => link.querySelector('.events-row-name')?.textContent),
    ).toEqual(['Paused', 'Later']);

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

  it('sums up what is happening, upcoming and in draft, with the Upcoming tile and the footer counting the same (sc-22103)', async () => {
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
    const tiles = document.querySelectorAll('.events-tile');
    expect([...tiles].map((tile) => spaced(tile.textContent))).toEqual([
      'Upcoming events2',
      'Guests invited Coming soon',
      'Replies in Coming soon',
      'Need attention Coming soon',
    ]);
    expect(tiles[1]!.querySelector('a, button, [tabindex]')).toBeNull();
    expect(screen.getByText('2 events · Sorted by date')).toBeDefined();
    expect(screen.getByRole('link', { name: /^Paused/ }).textContent).toContain(
      'Paused. Guests can’t reply or change anything until you resume it.',
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Drafts 2' }));
    expect(screen.getByRole('link', { name: /^Ended draft/ }).textContent).toContain(
      'This event’s end has passed, so it cannot be made live. Change its dates first.',
    );

    fireEvent.click(screen.getByRole('tab', { name: 'Past 14' }));
    expect(screen.getByText('14 events · Sorted by date')).toBeDefined();
  });

  it('leaves out each part of the summary at 0, the whole line with only past events, and the footer on an empty tab', async () => {
    signedIn();
    answering({ 'GET /api/orgs/org_1/events': listed([], finished(1), 1) });
    at('/app/events');

    await screen.findByRole('tab', { name: 'Upcoming 0' });

    expect(document.querySelector('.events-summary')).toBeNull();
    expect(spaced(document.querySelector('.events-tile')!.textContent)).toBe('Upcoming events0');
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
    expect(document.querySelector('.events-panel [aria-live="polite"]')?.textContent).toBe(
      '2 more finished events shown.',
    );
    expect(sent.filter(({ line }) => line === 'GET /api/orgs/org_1/events')).toHaveLength(3);
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

  it('moves an event to Happening now at its start and to Past at its end, with no reload', async () => {
    signedIn();
    const sent = answering({
      'GET /api/orgs/org_1/events': listed([
        live('Party', { startsAt: '2026-11-01T12:00:30Z', endsAt: '2026-11-01T12:01:00Z' }),
      ]),
    });
    at('/app/events');
    await screen.findByRole('tab', { name: 'Upcoming 1' });

    await act(() => vi.advanceTimersByTimeAsync(30_000));
    expect(screen.getByRole('heading', { name: 'Happening now' })).toBeDefined();
    expect(screen.getByRole('tab', { name: 'Upcoming 0' })).toBeDefined();

    await act(() => vi.advanceTimersByTimeAsync(30_000));
    expect(screen.queryByRole('heading', { name: 'Happening now' })).toBeNull();
    expect(screen.getByRole('tab', { name: 'Past 1' })).toBeDefined();
    expect(sent.filter(({ line }) => line === 'GET /api/orgs/org_1/events')).toHaveLength(2);
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
    'Budget',
    'Reports',
  ];

  function eventNav() {
    return within(screen.getByRole('navigation', { name: 'Event' }));
  }

  function current(): string | null {
    return document.querySelector('[aria-current="page"]')?.textContent ?? null;
  }

  it('holds ‹ Events and the nine areas in place of the app’s entries, with Settings and Your account kept', async () => {
    signedIn();
    answering({ 'GET /api/events/ev_1': () => json({ event: event() }) });
    at('/app/events/ev_1');
    await screen.findByRole('heading', { level: 1, name: 'Adaeze and Tunde' });

    expect(
      eventNav()
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['‹ Events', ...AREAS]);
    expect(current()).toBe('Overview');
    expect(screen.queryByRole('link', { name: 'Dashboard' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Calendar' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Settings' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Your account' })).toBeDefined();
  });

  it('opens an area that is not built as a panel saying it is coming, with nothing to press, and marks it current', async () => {
    signedIn();
    answering({ 'GET /api/events/ev_1': () => json({ event: event() }) });
    at('/app/events/ev_1');
    await screen.findByRole('heading', { level: 1, name: 'Adaeze and Tunde' });

    fireEvent.click(eventNav().getByRole('link', { name: 'Seating' }));

    const panel = (await screen.findByRole('heading', { level: 2, name: 'Seating' })).closest(
      'section',
    )!;
    expect(within(panel).getByText('The seating plan for this event is coming.')).toBeDefined();
    expect(within(panel).queryAllByRole('button')).toHaveLength(0);
    expect(within(panel).queryAllByRole('link')).toHaveLength(0);
    expect(screen.getByRole('heading', { level: 1, name: 'Adaeze and Tunde' })).toBeDefined();
    expect(current()).toBe('Seating');
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

    fireEvent.click(eventNav().getByRole('link', { name: '‹ Events' }));

    expect(
      (await screen.findByRole('tab', { name: 'Drafts 1' })).getAttribute('aria-selected'),
    ).toBe('true');
    expect(screen.queryByRole('navigation', { name: 'Event' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Events' }).getAttribute('aria-current')).toBe('page');
  });
});

describe("An event's Overview (sc-22103)", () => {
  const PAST = { startsAt: '2020-11-14T16:00:00+01:00', endsAt: '2020-11-15T02:00:00+01:00' };

  it('opens on the tiles as placeholders, then Details, Coming up and Manage', async () => {
    signedIn();
    answering({ 'GET /api/events/ev_1': () => json({ event: event() }) });
    at('/app/events/ev_1');
    await screen.findByRole('heading', { level: 1, name: 'Adaeze and Tunde' });

    const tiles = screen.getByRole('list', { name: 'Overview' });
    expect(
      within(tiles)
        .getAllByRole('listitem')
        .map((tile) => spaced(tile.textContent)),
    ).toEqual([
      'Coming Coming soon',
      'Meal picks in Coming soon',
      'Seated Coming soon',
      'Budget used Coming soon',
    ]);
    expect(
      screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent),
    ).toEqual(['Details', 'Coming up', 'Manage', 'Just for you']);
    expect(screen.queryByRole('button', { name: /more/i })).toBeNull();
  });

  it('opens Edit details at each row: Starts, the venue and the hosts', async () => {
    signedIn();
    answering({ 'GET /api/events/ev_1': () => json({ event: event() }) });
    at('/app/events/ev_1');

    const details = await screen.findByRole('region', { name: 'Details' });
    expect(
      within(details)
        .getAllByRole('link')
        .map((link) => link.getAttribute('href')),
    ).toEqual([
      '/app/events/ev_1/edit',
      '/app/events/ev_1/edit#starts',
      '/app/events/ev_1/edit#venue',
      '/app/events/ev_1/edit#hosts',
    ]);
    expect(within(details).getByText('Funmi Adeyemi')).toBeDefined();

    fireEvent.click(within(details).getByRole('link', { name: /^Dates/ }));
    await screen.findByRole('heading', { level: 1, name: 'Edit details' });
    await waitFor(() => expect(document.activeElement?.id).toBe('event-start-date'));
  });

  it('says there are no hosts yet in Hosted by', async () => {
    signedIn();
    answering({ 'GET /api/events/ev_1': () => json({ event: event({ hosts: [] }) }) });
    at('/app/events/ev_1');

    const details = await screen.findByRole('region', { name: 'Details' });
    expect(
      within(details).getByText(
        'No hosts yet. The event can be made live once it has at least one.',
      ),
    ).toBeDefined();
  });

  it('gives a Read-only member rows that open nothing, no primary, and only Just for you in Manage', async () => {
    signedIn(READER);
    answering({ 'GET /api/events/ev_1': () => json({ event: event() }) });
    at('/app/events/ev_1');

    const details = await screen.findByRole('region', { name: 'Details' });
    expect(within(details).queryAllByRole('link')).toEqual([]);
    expect(screen.queryByRole('button', { name: 'Make live' })).toBeNull();
    const manage = screen.getByRole('region', { name: 'Manage' });
    expect(within(manage).queryAllByRole('button')).toEqual([]);
    expect(within(manage).getByRole('heading', { name: 'Just for you' })).toBeDefined();
  });

  it('makes Duplicate the primary on a Finished event, and does not repeat it in Manage', async () => {
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
    expect(duplicate.className).toContain('button-primary');
    expect(screen.getAllByRole('button', { name: 'Duplicate' })).toHaveLength(1);
  });

  it('makes Change dates the primary on a Draft past its end, opening Edit details at Starts', async () => {
    signedIn();
    answering({ 'GET /api/events/ev_1': () => json({ event: event(PAST) }) });
    at('/app/events/ev_1');

    const heading = await screen.findByRole('heading', { level: 1, name: 'Adaeze and Tunde' });
    const change = within(heading.closest('section')!).getByRole('link', { name: 'Change dates' });
    expect(change.className).toContain('button-primary');
    expect(change.getAttribute('href')).toBe('/app/events/ev_1/edit#starts');
  });

  it('keeps the Top above an area, with the area in a panel under it', async () => {
    signedIn();
    answering({ 'GET /api/events/ev_1': () => json({ event: event() }) });
    at('/app/events/ev_1/guests');

    await screen.findByRole('heading', { level: 1, name: 'Adaeze and Tunde' });
    expect(screen.getByRole('heading', { level: 2, name: 'Guests' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Make live' })).toBeDefined();
    expect(screen.queryByRole('region', { name: 'Details' })).toBeNull();
  });
});

describe("An event's page", () => {
  it("shows the name, Draft, and the start and end in the event's zone", async () => {
    signedIn();
    answering({ 'GET /api/events/ev_1': () => json({ event: event() }) });
    at('/app/events/ev_1');

    const heading = await screen.findByRole('heading', { level: 1, name: 'Adaeze and Tunde' });
    const card = heading.closest('section')!;

    expect(within(card).getByText('Draft')).toBeDefined();
    expect(within(card).getByText('Wedding')).toBeDefined();
    expect(spaced(within(card).getByText(/Africa\/Lagos/).textContent)).toBe(
      'Sat, Nov 14, 2026, 16:00 – Sun, Nov 15, 2026, 02:00 · Africa/Lagos',
    );
  });

  it('writes the date once for an event that starts and ends on one day', async () => {
    signedIn();
    answering({
      'GET /api/events/ev_1': () => json({ event: event({ endsAt: '2026-11-14T23:00:00+01:00' }) }),
    });
    at('/app/events/ev_1');

    const heading = await screen.findByRole('heading', { level: 1, name: 'Adaeze and Tunde' });

    expect(spaced(within(heading.closest('section')!).getByText(/Africa\/Lagos/).textContent)).toBe(
      'Sat, Nov 14, 2026, 16:00 – 23:00 · Africa/Lagos',
    );
  });

  it('opens Guests, which says the guest list is coming', async () => {
    signedIn();
    answering({ 'GET /api/events/ev_1': () => json({ event: event() }) });
    at('/app/events/ev_1');

    await screen.findByRole('heading', { level: 1, name: 'Adaeze and Tunde' });
    fireEvent.click(
      within(screen.getByRole('navigation', { name: 'Event' })).getByRole('link', {
        name: 'Guests',
      }),
    );

    expect(await screen.findByText('The guest list for this event is coming.')).toBeDefined();
  });

  it.each([
    ['the event', '/app/events/ev_1', 'Adaeze and Tunde'],
    ['its Guests', '/app/events/ev_1/guests', 'Adaeze and Tunde'],
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

describe("Editing an event's details (sc-3587)", () => {
  type Sent = { line: string; body: unknown; ifMatch: string | null };

  function tagged(body: unknown, tag: string, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { ETag: tag } });
  }

  /** The event as the API holds it, at a version, and every request sent with its If-Match. */
  function serving(answers: Record<string, Answer> = {}) {
    const sent: Sent[] = [];
    const held = { event: event(), version: 1 };

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const line = `${init?.method ?? 'GET'} ${new URL(String(input)).pathname}`;
      const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : null;
      sent.push({ line, body, ifMatch: new Headers(init?.headers).get('If-Match') });

      const answer = await answers[line]?.(body, new URL(String(input)));
      if (answer != null) return answer;

      if (line === 'PATCH /api/events/ev_1') {
        held.event = { ...held.event, ...(body as object) };
        held.version += 1;
      }

      return tagged({ event: held.event }, `"${held.version}"`);
    });

    return { sent, held };
  }

  async function editing(): Promise<void> {
    at('/app/events/ev_1/edit');
    await screen.findByRole('heading', { level: 1, name: 'Edit details' });
  }

  function value(label: string): string {
    return (screen.getByLabelText(label) as HTMLInputElement).value;
  }

  it('is offered on the event page with events.manage, and not without it', async () => {
    signedIn();
    serving();
    at('/app/events/ev_1');
    const heading = await screen.findByRole('heading', { level: 1, name: 'Adaeze and Tunde' });

    expect(heading).toBeDefined();
    fireEvent.click(screen.getByRole('link', { name: 'Edit details' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Edit details' })).toBeDefined();

    cleanup();
    signedIn(READER);
    at('/app/events/ev_1');
    await screen.findByRole('heading', { level: 1, name: 'Adaeze and Tunde' });
    expect(screen.queryByRole('link', { name: 'Edit details' })).toBeNull();
  });

  it("opens with the event's values, its times as saved in its zone", async () => {
    signedIn();
    serving();
    await editing();

    expect([
      value('Event name'),
      value('Type'),
      (document.getElementById('event-start-date') as HTMLInputElement).value,
      (document.getElementById('event-start-time') as HTMLInputElement).value,
      (document.getElementById('event-end-date') as HTMLInputElement).value,
      (document.getElementById('event-end-time') as HTMLInputElement).value,
      value('Time zone'),
      value('Currency'),
    ]).toEqual([
      'Adaeze and Tunde',
      'wedding',
      '2026-11-14',
      '16:00',
      '2026-11-15',
      '02:00',
      'Africa/Lagos',
      'NGN',
    ]);
    expect(
      screen.getByText(
        'Changing the zone keeps the times as typed. Sat 16:00 stays 16:00 in the new zone.',
      ),
    ).toBeDefined();
  });

  it('offers the fourteen types and no way back to none, and sends a new one (sc-3588)', async () => {
    signedIn();
    const { sent } = serving();
    await editing();

    const type = screen.getByLabelText<HTMLSelectElement>('Type');
    expect([...type.options].map((option) => option.value)).toEqual([...EVENT_TYPES]);

    fireEvent.change(type, { target: { value: 'anniversary' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(sent.find(({ line }) => line === 'PATCH /api/events/ev_1')?.body).toEqual({
        type: 'anniversary',
      }),
    );
  });

  it('moves the end with the start, says so, and sends both as one change of dates (sc-22144)', async () => {
    signedIn();
    const { sent } = serving();
    await editing();

    fireEvent.change(document.getElementById('event-start-time')!, { target: { value: '18:00' } });

    expect((document.getElementById('event-end-time') as HTMLInputElement).value).toBe('04:00');
    expect(document.activeElement).toBe(document.body);
    expect(screen.getByRole('status').textContent).toBe(
      'Ends moved with the start, to Sun, Nov 15, 04:00.',
    );

    fireEvent.change(document.getElementById('event-end-time')!, { target: { value: '03:00' } });
    fireEvent.change(document.getElementById('event-start-date')!, {
      target: { value: '2026-11-21' },
    });
    expect([
      (document.getElementById('event-end-date') as HTMLInputElement).value,
      (document.getElementById('event-end-time') as HTMLInputElement).value,
    ]).toEqual(['2026-11-22', '03:00']);

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(
        sent.filter(({ line }) => line === 'PATCH /api/events/ev_1').map(({ body }) => body),
      ).toEqual([{ startsAt: '2026-11-21T18:00', endsAt: '2026-11-22T03:00' }]),
    );
  });

  it('keeps the length through a start cleared and typed again (sc-22144)', async () => {
    signedIn();
    serving();
    await editing();

    fireEvent.change(document.getElementById('event-start-date')!, { target: { value: '' } });
    fireEvent.change(document.getElementById('event-start-date')!, {
      target: { value: '2026-11-21' },
    });

    expect([
      (document.getElementById('event-end-date') as HTMLInputElement).value,
      (document.getElementById('event-end-time') as HTMLInputElement).value,
    ]).toEqual(['2026-11-22', '02:00']);
  });

  it('opens an event from before types on Other', async () => {
    signedIn();
    serving({ 'GET /api/events/ev_1': () => tagged({ event: event({ type: 'other' }) }, '"1"') });
    await editing();

    expect(screen.getByLabelText<HTMLSelectElement>('Type').selectedOptions[0]?.textContent).toBe(
      'Other',
    );
  });

  it('sends nothing when nothing changed, and the page says so', async () => {
    signedIn();
    const { sent } = serving();
    await editing();

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Nothing changed, so nothing was sent.')).toBeDefined();
    await waitFor(() =>
      expect(document.activeElement?.textContent).toBe('Nothing changed, so nothing was sent.'),
    );
    expect(sent.filter(({ line }) => line.startsWith('PATCH'))).toEqual([]);
  });

  it('sends only what changed with the tag it read, then shows the new values and Saved', async () => {
    signedIn();
    const { sent } = serving();
    await editing();

    fireEvent.change(screen.getByLabelText('Event name'), { target: { value: '  Adé at 40 ' } });
    fireEvent.change(screen.getByLabelText('Time zone'), { target: { value: 'Europe/London' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Adé at 40' })).toBeDefined();
    expect(sent.find(({ line }) => line === 'PATCH /api/events/ev_1')).toEqual({
      line: 'PATCH /api/events/ev_1',
      body: { name: 'Adé at 40', timeZone: 'Europe/London' },
      ifMatch: '"1"',
    });
    await waitFor(() => expect(document.activeElement?.textContent).toBe('Saved'));
  });

  it('announces Saved when the person moved focus while the event reloaded', async () => {
    signedIn();
    let release = () => {};
    const reloaded = new Promise<void>((resolve) => {
      release = resolve;
    });
    const { sent, held } = serving({
      'GET /api/events/ev_1': async () => {
        if (sent.some(({ line }) => line.startsWith('PATCH'))) await reloaded;

        return tagged({ event: held.event }, `"${held.version}"`);
      },
    });
    await editing();

    fireEvent.change(screen.getByLabelText('Event name'), { target: { value: 'Adé at 40' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await screen.findByText('Loading the event…');
    const [nav] = screen.getAllByRole('link', { name: 'Events' });
    act(() => nav!.focus());
    release();

    expect(await screen.findByRole('heading', { level: 1, name: 'Adé at 40' })).toBeDefined();
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Saved'));
    expect(document.activeElement).toBe(nav);
  });

  it('shows every problem at once with focus on the first, and sends nothing', async () => {
    signedIn();
    const { sent } = serving();
    await editing();

    fireEvent.change(screen.getByLabelText('Event name'), { target: { value: '   ' } });
    fireEvent.change(document.getElementById('event-end-date')!, {
      target: { value: '2026-11-13' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Give the event a name.')).toBeDefined();
    expect(screen.getByText('The end is before the start. Choose a later end.')).toBeDefined();
    await waitFor(() => expect(document.activeElement?.id).toBe('event-name'));
    expect(sent.filter(({ line }) => line.startsWith('PATCH'))).toEqual([]);
  });

  it('says somebody else changed it, keeps what was typed, and shows the latest after asking', async () => {
    signedIn();
    const { held } = serving({
      'PATCH /api/events/ev_1': () => problem(412, 'precondition_failed'),
    });
    await editing();
    held.event = { ...held.event, name: 'Their name' };
    held.version = 2;

    fireEvent.change(screen.getByLabelText('Event name'), { target: { value: 'My name' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(
      await screen.findByText(
        'Not saved. Somebody else changed this event since you opened it. What you typed is still here.',
      ),
    ).toBeDefined();
    expect(value('Event name')).toBe('My name');

    fireEvent.click(screen.getByRole('button', { name: 'Show the latest' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Show the latest version?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Show the latest' }));

    await waitFor(() => expect(value('Event name')).toBe('Their name'));
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('takes focus to Edit details once Try again loads the event, and to the line when it fails again (sc-11369)', async () => {
    signedIn();
    let calls = 0;
    serving({
      'GET /api/events/ev_1': () =>
        ++calls === 2 ? tagged({ event: event() }, '"1"') : problem(500, 'internal_error'),
    });
    at('/app/events/ev_1/edit');

    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('heading', { level: 1, name: 'Edit details' }),
      ),
    );

    cleanup();
    calls = 5;
    at('/app/events/ev_1/edit');
    fireEvent.click(await screen.findByRole('button', { name: 'Try again' }));

    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByText('The event did not load. Try again in a moment.'),
      ),
    );
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('takes focus to Save changes after Cancel under "Not saved. Somebody else changed this event…" (sc-11369)', async () => {
    signedIn();
    serving({ 'PATCH /api/events/ev_1': () => problem(412, 'precondition_failed') });
    await editing();

    fireEvent.change(screen.getByLabelText('Event name'), { target: { value: 'My name' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    const notice = (
      await screen.findByText(
        'Not saved. Somebody else changed this event since you opened it. What you typed is still here.',
      )
    ).closest('.notice') as HTMLElement;
    fireEvent.click(within(notice).getByRole('button', { name: 'Cancel' }));

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Save changes' }));
  });

  it('takes focus to "Not saved" when Show the latest fails (sc-11369)', async () => {
    signedIn();
    let reads = 0;
    serving({
      'PATCH /api/events/ev_1': () => problem(412, 'precondition_failed'),
      'GET /api/events/ev_1': () =>
        ++reads === 1
          ? tagged({ event: event() }, '"1"')
          : Promise.reject(new TypeError('Failed to fetch')),
    });
    await editing();

    fireEvent.change(screen.getByLabelText('Event name'), { target: { value: 'My name' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Show the latest' }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Show the latest version?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Show the latest' }));

    const notSaved = await screen.findByText('Not saved. Your changes are still here. Try again.');
    await waitFor(() => expect(document.activeElement).toBe(notSaved));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(value('Event name')).toBe('My name');
  });

  it('says the currency cannot change once amounts are recorded', async () => {
    signedIn();
    serving({ 'PATCH /api/events/ev_1': () => problem(409, 'event_currency_in_use') });
    await editing();

    fireEvent.change(screen.getByLabelText('Currency'), { target: { value: 'GHS' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(
      await screen.findByText(
        'The currency cannot change once amounts are recorded against this event.',
      ),
    ).toBeDefined();
    expect(value('Currency')).toBe('GHS');
  });

  it('says it was not saved when saving fails, keeping everything typed', async () => {
    signedIn();
    serving({ 'PATCH /api/events/ev_1': () => problem(500, 'internal_error') });
    await editing();

    fireEvent.change(screen.getByLabelText('Event name'), { target: { value: 'Kept' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(
      await screen.findByText('Not saved. Your changes are still here. Try again.'),
    ).toBeDefined();
    expect(value('Event name')).toBe('Kept');
  });

  it('asks before leaving with unsaved changes, and leaves when told to', async () => {
    signedIn();
    serving();
    await editing();

    fireEvent.change(screen.getByLabelText('Event name'), { target: { value: 'Unsaved' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    const dialog = await screen.findByRole('alertdialog', { name: 'Leave without saving?' });
    expect(document.activeElement).toBe(
      within(dialog).getByRole('button', { name: 'Keep editing' }),
    );
    fireEvent.click(within(dialog).getByRole('button', { name: 'Keep editing' }));
    expect(value('Event name')).toBe('Unsaved');

    fireEvent.click(document.querySelector('.event-back')!);
    fireEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Leave without saving',
      }),
    );

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Adaeze and Tunde' }),
    ).toBeDefined();
  });

  it('takes focus to the heading of the page left for, not back to the link that asked (sc-11370)', async () => {
    signedIn();
    serving();
    await editing();

    fireEvent.change(screen.getByLabelText('Event name'), { target: { value: 'Unsaved' } });
    const sidebarEvents = screen.getByRole('link', { name: '‹ Events' });
    sidebarEvents.focus();
    fireEvent.click(sidebarEvents);
    fireEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Leave without saving',
      }),
    );

    const heading = await screen.findByRole('heading', { level: 1, name: 'Events' });
    await waitFor(() => expect(document.activeElement).toBe(heading));
  });

  it('puts focus back on the link that asked when editing goes on (sc-11370)', async () => {
    signedIn();
    serving();
    await editing();

    fireEvent.change(screen.getByLabelText('Event name'), { target: { value: 'Unsaved' } });
    const sidebarEvents = screen.getByRole('link', { name: '‹ Events' });
    sidebarEvents.focus();
    fireEvent.click(sidebarEvents);
    fireEvent.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Keep editing',
      }),
    );

    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(document.activeElement).toBe(sidebarEvents);

    fireEvent.click(sidebarEvents);
    await screen.findByRole('alertdialog');
    fireEvent.keyDown(document, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    expect(document.activeElement).toBe(sidebarEvents);
  });

  it('leaves at once when nothing was changed', async () => {
    signedIn();
    serving();
    await editing();

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Adaeze and Tunde' }),
    ).toBeDefined();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('says under Ends when a change of zone puts it in the gap, and keeps the zone example true (sc-10638)', async () => {
    signedIn();
    serving({
      'GET /api/events/ev_1': () =>
        tagged(
          {
            event: event({
              startsAt: '2027-03-27T20:00:00+01:00',
              endsAt: '2027-03-28T02:00:00+01:00',
            }),
          },
          '"1"',
        ),
    });
    await editing();

    expect(gapLine('event-end-gap')).toBe('');
    fireEvent.change(screen.getByLabelText('Time zone'), { target: { value: 'Europe/Paris' } });

    expect(gapLine('event-end-gap')).toBe(
      'There is no 02:00 on Sun, Mar 28 in Europe/Paris: the clocks go forward that night. It will be saved as 03:00.',
    );
    expect(
      screen.getByText(
        'Changing the zone keeps the times as typed. Sat 20:00 stays 20:00 in the new zone.',
      ),
    ).toBeDefined();

    fireEvent.change(document.getElementById('event-start-date')!, {
      target: { value: '2027-03-28' },
    });
    fireEvent.change(document.getElementById('event-start-time')!, {
      target: { value: '02:30' },
    });

    expect(gapLine('event-start-gap')).toContain('It will be saved as 03:30.');
    expect(document.getElementById('event-time-zone-hint')!.textContent).toBe(
      'Changing the zone keeps the times as typed.',
    );
  });

  it('refuses a start the gap moves past the end, and sends nothing (sc-10638)', async () => {
    signedIn();
    const { sent } = serving();
    await editing();

    fireEvent.change(screen.getByLabelText('Time zone'), { target: { value: 'Europe/Paris' } });
    for (const [id, value] of [
      ['event-start-date', '2027-03-28'],
      ['event-start-time', '02:30'],
      ['event-end-date', '2027-03-28'],
      ['event-end-time', '03:15'],
    ] as const)
      fireEvent.change(document.getElementById(id)!, { target: { value } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(
      await screen.findByText('The end is before the start. Choose a later end.'),
    ).toBeDefined();
    expect(sent.filter(({ line }) => line.startsWith('PATCH'))).toEqual([]);
  });

  it('is refused to a role without events.manage', async () => {
    signedIn(READER);
    const { sent } = serving();
    at('/app/events/ev_1/edit');

    expect(await screen.findByRole('heading', { level: 1 })).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'Edit details' })).toBeNull();
    expect(sent.filter(({ line }) => line.includes('/api/events/'))).toEqual([]);
  });
});

describe("An event's venue (sc-3589)", () => {
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

  function address(): HTMLInputElement {
    return screen.getByRole('combobox', { name: 'Address' });
  }

  async function editing(): Promise<void> {
    at('/app/events/ev_1/edit');
    await screen.findByRole('heading', { level: 1, name: 'Edit details' });
  }

  function patched(sent: { line: string; body: unknown }[]): unknown {
    return sent.find(({ line }) => line === 'PATCH /api/events/ev_1')?.body;
  }

  it('sits after Ends, with its hint, in both forms', async () => {
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

    cleanup();
    await editing();
    expect(screen.getByRole('heading', { level: 2, name: 'Venue' })).toBeDefined();
  });

  it('suggests from three characters, picks by keyboard, and sends the suggestion it came from', async () => {
    signedIn();
    const sent = serving({
      'GET /api/addresses/suggest': () =>
        json({ success: true, data: [{ ...CIVIC, secondary_text: CIVIC.secondaryText }] }),
      'GET /api/addresses/node%3A7': () => json({ success: true, data: resolved('Africa/Lagos') }),
    });
    await editing();

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

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(patched(sent)).toBeDefined());
    expect(patched(sent)).toEqual({
      venue: {
        name: null,
        address: 'The Civic Centre, Ozumba Mbadiwe Avenue, Lagos, Nigeria',
        addressId: 'node:7',
      },
    });
  });

  it('saves a typed address as typed, with a name', async () => {
    signedIn();
    const sent = serving({ 'GET /api/addresses/suggest': () => json({ success: true, data: [] }) });
    await editing();

    fireEvent.change(screen.getByLabelText(/Venue name/u), { target: { value: ' Hall 2 ' } });
    fireEvent.change(address(), { target: { value: '12 Bode Thomas Street' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(patched(sent)).toBeDefined());
    expect(patched(sent)).toEqual({ venue: { name: 'Hall 2', address: '12 Bode Thomas Street' } });
    expect(screen.queryByText(/Suggestions aren't available/u)).toBeNull();
  });

  it('says suggestions are unavailable only when the lookup failed, and still saves the address', async () => {
    signedIn();
    const sent = serving({
      'GET /api/addresses/suggest': () => problem(503, 'service_unavailable'),
    });
    await editing();

    fireEvent.change(address(), { target: { value: '12 Bode Thomas Street' } });

    expect(
      await screen.findByText(
        "Suggestions aren't available right now. Type the address in full and it will be saved as you typed it.",
      ),
    ).toBeDefined();
    expect(address().getAttribute('aria-describedby')).toContain('event-venue-lookup-down');
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(patched(sent)).toBeDefined());
    expect(patched(sent)).toEqual({ venue: { name: null, address: '12 Bode Thomas Street' } });
    expect(screen.queryByRole('alert')).toBeNull();
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
      await editing();

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
      fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

      await waitFor(() => expect(patched(sent)).toBeDefined());
      expect(patched(sent)).toMatchObject({ timeZone: 'Europe/Lisbon' });
      expect(patched(sent)).not.toHaveProperty('startsAt');
      expect(patched(sent)).not.toHaveProperty('endsAt');
    });

    it('keeps the zone when declined', async () => {
      const sent = await picked();

      fireEvent.click(screen.getByRole('button', { name: 'Keep Africa/Lagos' }));

      expect((screen.getByLabelText('Time zone') as HTMLSelectElement).value).toBe('Africa/Lagos');
      expect(screen.queryByText(/This venue is in/u)).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

      await waitFor(() => expect(patched(sent)).toBeDefined());
      expect(patched(sent)).not.toHaveProperty('timeZone');
    });
  });

  it('removes the venue when both fields are cleared', async () => {
    signedIn();
    const sent = serving(
      {},
      event({
        venue: { name: 'The Civic Centre', address: { ...TYPED, formatted: 'Victoria Island' } },
      }),
    );
    await editing();

    expect(address().value).toBe('Victoria Island');
    fireEvent.change(screen.getByLabelText(/Venue name/u), { target: { value: '' } });
    fireEvent.change(address(), { target: { value: ' ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(patched(sent)).toBeDefined());
    expect(patched(sent)).toEqual({ venue: null });
  });

  it('refuses a venue name past 120 characters beside it, and sends nothing', async () => {
    signedIn();
    const sent = serving({});
    await editing();

    fireEvent.change(screen.getByLabelText(/Venue name/u), { target: { value: 'a'.repeat(121) } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(
      await screen.findByText('Shorten the venue name to 120 characters or fewer.'),
    ).toBeDefined();
    await waitFor(() => expect(document.activeElement?.id).toBe('event-venue-name'));
    expect(patched(sent)).toBeUndefined();
  });

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

    const venue = screen.getByRole('group', { name: 'Venue' });
    const details = screen.getByRole('region', { name: 'Details' });
    expect(within(venue).getByText('The Civic Centre')).toBeDefined();
    expect(within(details).getByText('The Civic Centre')).toBeDefined();
    expect(within(details).getByText('Ozumba Mbadiwe Avenue, Lagos')).toBeDefined();
    expect(within(venue).getByRole('link', { name: 'Open in maps' }).getAttribute('href')).toBe(
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

  it('says Venue to be confirmed, with Add the venue only for events.manage, opening the Venue section', async () => {
    signedIn();
    serving({});
    at('/app/events/ev_1');
    const details = await screen.findByRole('region', { name: 'Details' });
    expect(within(details).getByText('Venue to be confirmed')).toBeDefined();

    fireEvent.click(within(details).getByRole('link', { name: /Add the venue/ }));
    await screen.findByRole('heading', { level: 1, name: 'Edit details' });
    await waitFor(() => expect(document.activeElement?.id).toBe('event-venue-name'));

    cleanup();
    signedIn(READER);
    at('/app/events/ev_1');
    const readOnly = await screen.findByRole('region', { name: 'Details' });
    expect(within(readOnly).getByText('Venue to be confirmed')).toBeDefined();
    expect(screen.queryByRole('link', { name: /Add the venue/ })).toBeNull();
  });
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

    expect(screen.getByText("Guests can't be invited until this event is live.")).toBeDefined();
    expect(screen.getByRole('button', { name: 'Make live' })).toBeDefined();
    expect(screen.getByText('Draft')).toBeDefined();
  });

  it('shows the line and no Make live without events.manage', async () => {
    signedIn(READER);
    await onTheDraft();

    expect(screen.getByText("Guests can't be invited until this event is live.")).toBeDefined();
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
    expect(screen.queryByText("Guests can't be invited until this event is live.")).toBeNull();
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
        "This event's end has passed, so it cannot be made live. Change its dates first.",
      ),
    ).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Make live' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Change dates' }).getAttribute('href')).toBe(
      '/app/events/ev_1/edit#starts',
    );
  });

  it('shows Live in the list', async () => {
    signedIn();
    answering({ 'GET /api/orgs/org_1/events': listed([live()]) });
    at('/app/events');

    const row = await screen.findByRole('link', { name: /Adaeze and Tunde/ });
    expect(within(row).getByText('Live')).toBeDefined();
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
    ['finished', 'Finished'],
  ])('shows the server phase %s as %s in the list', async (phase, word) => {
    signedIn();
    answering({
      'GET /api/orgs/org_1/events':
        phase === 'finished' ? listed([], [live({ phase })]) : listed([live({ phase })]),
    });
    at('/app/events');
    if (phase === 'finished') fireEvent.click(await screen.findByRole('tab', { name: /Past/ }));

    const row = await screen.findByRole('link', { name: /Adaeze and Tunde/ });
    expect(within(row).getByText(word)).toBeDefined();
  });

  it("shows the server's phase on load, whatever the device clock says", async () => {
    signedIn();
    await onThePage(live({ ...HAPPENING, phase: 'live' }));

    expect(screen.getByText('Live', { selector: '.pill-quiet' })).toBeDefined();
    expect(screen.queryByText('Happening now')).toBeNull();
  });

  it('turns Live to Happening now at the start without a reload, says so, and Call off becomes End now', async () => {
    clockAt('2030-11-14T14:59:50Z');
    signedIn();
    const sent = await onThePage(live());
    expect(screen.getByRole('button', { name: 'Call off…' })).toBeDefined();

    await act(() => vi.advanceTimersByTimeAsync(15_000));

    expect(screen.getByText('Happening now', { selector: '.pill-quiet' })).toBeDefined();
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

    expect(screen.getByText('Happening now', { selector: '.pill-quiet' })).toBeDefined();
  });

  it('still shows Live five minutes before the start on a device ten minutes fast', async () => {
    clockAt('2030-11-14T15:05:00Z');
    signedIn();
    await servedWithDate(live(), 'Thu, 14 Nov 2030 14:55:00 GMT');

    expect(screen.getByText('Live', { selector: '.pill-quiet' })).toBeDefined();
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
        "This event's end has passed, so it cannot be made live. Change its dates first.",
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
    expect(screen.getByText('Finished', { selector: '.pill-quiet' })).toBeDefined();
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Finished'));
    expect(screen.getByText(/^Called off on .*Oct 13, 2030, before it started\./)).toBeDefined();
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
      expect(screen.getByText('Finished', { selector: '.pill-quiet' })).toBeDefined(),
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
    expect(screen.getByText('Live', { selector: '.pill-quiet' })).toBeDefined();
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
    expect(screen.getByText('Finished', { selector: '.pill-quiet' })).toBeDefined();
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
    ['without events.manage', READER, live()],
    ['on a Draft', IRE, event(AHEAD)],
    ['once it is Finished', IRE, live({ phase: 'finished' })],
  ])('offers neither End now nor Call off %s', async (_, who, served) => {
    signedIn(who);
    await onThePage(served);

    expect(screen.queryByRole('button', { name: 'Call off…' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'End now…' })).toBeNull();
  });

  it("shows a Finished event's start, end and time zone read-only on Edit details, saying why", async () => {
    signedIn();
    answering({
      'GET /api/events/ev_1': () =>
        tagged({
          event: live({
            startsAt: '2020-11-14T16:00:00+01:00',
            endsAt: '2020-11-15T02:00:00+01:00',
            phase: 'finished',
          }),
        }),
    });
    at('/app/events/ev_1/edit');
    await screen.findByRole('heading', { level: 1, name: 'Edit details' });

    expect(
      screen.getByText("This event is over, so its start, end and time zone can't be changed."),
    ).toBeDefined();
    for (const id of ['event-start-date', 'event-start-time', 'event-end-date', 'event-end-time']) {
      expect((document.getElementById(id) as HTMLInputElement).readOnly).toBe(true);
    }
    expect((document.getElementById('event-time-zone') as HTMLSelectElement).disabled).toBe(true);
    expect((document.getElementById('event-name') as HTMLInputElement).readOnly).toBe(false);
  });

  it('puts back a schedule typed into when the end passes, and still saves the name', async () => {
    clockAt('2030-11-15T00:59:55Z');
    signedIn();
    const sent = answering({ 'GET /api/events/ev_1': () => tagged({ event: live() }) });
    at('/app/events/ev_1/edit');
    await screen.findByRole('heading', { level: 1, name: 'Edit details' });
    const endTime = document.getElementById('event-end-time') as HTMLInputElement;

    fireEvent.change(endTime, { target: { value: '03:00' } });
    vi.setSystemTime(new Date('2030-11-15T01:00:01Z'));
    await act(() => vi.advanceTimersByTimeAsync(15_000));

    expect(endTime.readOnly).toBe(true);
    expect(endTime.value).toBe('02:00');
    fireEvent.change(document.getElementById('event-name') as HTMLInputElement, {
      target: { value: 'Adaeze and Tunde, after' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() =>
      expect(sent.find(({ line }) => line === 'PATCH /api/events/ev_1')?.body).toEqual({
        name: 'Adaeze and Tunde, after',
      }),
    );
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
      expect(screen.getByText('Paused', { selector: '.pill-quiet' })).toBeDefined(),
    );
    expect(sent.filter(({ line }) => line === 'POST /api/events/ev_1/pause')).toHaveLength(1);
    expect(
      screen.getByText(
        "Paused. Guests can't reply or change anything until you resume it. Check-in and service still work.",
      ),
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
      expect(screen.getByText('Happening now', { selector: '.pill-quiet' })).toBeDefined(),
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
    ['without events.manage', READER, live()],
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

    expect(screen.getByText('Finished', { selector: '.pill-quiet' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Resume' })).toBeNull();
    expect(screen.queryByText(/^Paused\. Guests/)).toBeNull();
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

  async function editing(): Promise<void> {
    at('/app/events/ev_1/edit');
    await screen.findByRole('heading', { level: 1, name: 'Edit details' });
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

  it.each([
    [
      'a GIF',
      'a.gif',
      'image/gif',
      1000,
      'That file is not a photo we can use. Choose a JPEG, PNG, WebP or HEIC.',
    ],
    [
      'over 15 MB',
      'a.jpg',
      'image/jpeg',
      15 * 1024 * 1024 + 1,
      'That photo is over 15 MB. Choose a smaller one.',
    ],
  ])(
    'refuses %s before it uploads, saying which and what is accepted',
    async (_, name, type, size, line) => {
      signedIn();
      const sent = serving(null);
      await editing();
      const chosen = file(name, type, size);

      choose(chosen);

      expect(await screen.findByText(line)).toBeDefined();
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(sent.filter(({ line: sentLine }) => sentLine.includes('cover'))).toEqual([]);
    },
  );

  it('refuses a photo smaller than 1200 × 675 before it uploads', async () => {
    signedIn();
    const sent = serving(null);
    await editing();
    nextImage = { width: 1199, height: 900 };

    choose(file());

    expect(
      await screen.findByText(
        'That photo is smaller than 1200 × 675 pixels, so it would look blurred. Choose a larger one.',
      ),
    ).toBeDefined();
    expect(sent.filter(({ line }) => line.includes('cover'))).toEqual([]);
  });

  it('uploads a chosen photo in the dialog, and Use this photo saves it, its position and its description', async () => {
    signedIn();
    const sent = serving(null);
    await editing();

    choose(file());
    const dialog = await screen.findByRole('dialog', { name: 'Cover photo' });
    const slider = within(dialog).getByLabelText('Photo position');

    expect(document.activeElement).toBe(slider);
    expect(within(dialog).queryByRole('button', { name: 'Remove photo' })).toBeNull();
    await waitFor(() => expect(sent.map(({ line }) => line)).toContain('PUT /upload/1'));

    fireEvent.change(slider, { target: { value: '80' } });
    expect(slider.getAttribute('aria-valuetext')).toBe('Showing the bottom of the photo');
    fireEvent.change(within(dialog).getByLabelText(/Describe the image/), {
      target: { value: ' The arch ' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Use this photo' }));

    const cover = await screen.findByRole('button', { name: 'Change photo' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(sent.find(({ line }) => line === 'PUT /api/events/ev_1/cover')?.body).toEqual({
      uploadKey: 'event_cover/org_1/2026/10/one.jpg',
      position: 80,
      description: 'The arch',
    });
    expect(within(cover).getByRole('img').getAttribute('alt')).toBe('The arch');
    await waitFor(() => expect(document.activeElement).toBe(cover));
  });

  it('Cancel and Escape save nothing from the visit and keep the previous cover, and focus goes back to the cover', async () => {
    signedIn();
    const sent = serving(PHOTO);
    await editing();
    const cover = screen.getByRole('button', { name: 'Change photo' });

    for (const leave of ['Cancel', 'Escape']) {
      fireEvent.click(cover);
      const dialog = await screen.findByRole('dialog', { name: 'Cover photo' });
      fireEvent.change(within(dialog).getByLabelText('Photo position'), {
        target: { value: '90' },
      });
      fireEvent.change(within(dialog).getByLabelText(/Describe the image/), {
        target: { value: 'Something else' },
      });

      if (leave === 'Cancel')
        fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
      else fireEvent.keyDown(document, { key: 'Escape' });

      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      const img = within(screen.getByRole('button', { name: 'Change photo' })).getByRole('img');
      expect(img.getAttribute('alt')).toBe(PHOTO.description);
      expect(img.style.objectPosition).toBe('50% 30%');
      await waitFor(() => expect(document.activeElement).toBe(cover));
    }

    expect(sent.filter(({ line }) => line.includes('/cover'))).toEqual([]);
  });

  it('a new photo chosen and then cancelled is discarded, and the previous cover stays', async () => {
    signedIn();
    const sent = serving(PHOTO);
    await editing();

    choose(file());
    const dialog = await screen.findByRole('dialog', { name: 'Cover photo' });
    await waitFor(() => expect(sent.map(({ line }) => line)).toContain('PUT /upload/1'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(
      sent.find(({ line }) => line === 'DELETE /api/orgs/org_1/event-cover-uploads')?.body,
    ).toEqual({ uploadKey: 'event_cover/org_1/2026/10/one.jpg' });
    expect(
      within(screen.getByRole('button', { name: 'Change photo' }))
        .getByRole('img')
        .getAttribute('src'),
    ).toBe(PHOTO.sizes[0]!.url);
    expect(sent.filter(({ line }) => line.startsWith('PUT /api/events'))).toEqual([]);
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Upload a photo' })),
    );
  });

  it('a photo still uploading when the dialog closes is discarded once it arrives', async () => {
    signedIn();
    let arrive = (): void => undefined;
    const sent = serving(PHOTO, {
      'PUT /upload/1': () =>
        new Promise<Response>((resolve) => {
          arrive = () => resolve(new Response(null, { status: 200 }));
        }),
    });
    await editing();

    choose(file());
    const dialog = await screen.findByRole('dialog', { name: 'Cover photo' });
    await waitFor(() => expect(sent.map(({ line }) => line)).toContain('PUT /upload/1'));
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(dialog.isConnected).toBe(false);
    arrive();

    await waitFor(() =>
      expect(
        sent.find(({ line }) => line === 'DELETE /api/orgs/org_1/event-cover-uploads')?.body,
      ).toEqual({ uploadKey: 'event_cover/org_1/2026/10/one.jpg' }),
    );
  });

  it('Remove photo is there when a saved photo is being replaced through Upload a photo', async () => {
    signedIn();
    serving(PHOTO);
    await editing();

    choose(file());
    const dialog = await screen.findByRole('dialog', { name: 'Cover photo' });

    expect(within(dialog).getByRole('button', { name: 'Remove photo' })).toBeDefined();
  });

  it('Remove photo brings back the default, says so, and focus goes to Upload a photo', async () => {
    signedIn();
    const sent = serving(PHOTO);
    await editing();

    fireEvent.click(screen.getByRole('button', { name: 'Change photo' }));
    const dialog = await screen.findByRole('dialog', { name: 'Cover photo' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove photo' }));

    expect(await screen.findByText('Photo removed. The default cover is back.')).toBeDefined();
    expect(screen.queryByText(/The default cover for this type of event/)).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByTestId('cover-default').className).toContain('cover-default-wedding');
    expect(sent.map(({ line }) => line)).toContain('DELETE /api/events/ev_1/cover');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Upload a photo' }));
  });

  it('an upload that fails says so, the frame keeps the saved cover, and Cancel saves nothing', async () => {
    signedIn();
    const sent = serving(PHOTO, { 'PUT /upload/1': () => new Response(null, { status: 500 }) });
    await editing();

    choose(file());
    const dialog = await screen.findByRole('dialog', { name: 'Cover photo' });

    expect(await within(dialog).findByText('The photo did not upload. Try again.')).toBeDefined();
    expect(dialog.querySelector('.cover-frame img')?.getAttribute('src')).toBe(PHOTO.sizes[0]!.url);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('button', { name: 'Change photo' })).toBeDefined();
    expect(sent.filter(({ line }) => line.startsWith('PUT /api/events'))).toEqual([]);
  });

  it('refuses a description over 250 characters and saves nothing', async () => {
    signedIn();
    const sent = serving(PHOTO);
    await editing();

    fireEvent.click(screen.getByRole('button', { name: 'Change photo' }));
    const dialog = await screen.findByRole('dialog', { name: 'Cover photo' });
    fireEvent.change(within(dialog).getByLabelText(/Describe the image/), {
      target: { value: 'a'.repeat(251) },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Use this photo' }));

    expect(
      within(dialog).getByText('Shorten the description to 250 characters or fewer.'),
    ).toBeDefined();
    expect(sent.filter(({ line }) => line.includes('/cover'))).toEqual([]);
  });

  it('shows no cover on the event page or in the list (sc-22103)', async () => {
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
    expect(document.querySelector('.event-page [class*="cover"]')).toBeNull();
    cleanup();

    at('/app/events');
    fireEvent.click(await screen.findByRole('tab', { name: /Drafts/ }));
    await screen.findAllByRole('link', { name: /Adaeze and Tunde/ });

    expect(screen.queryByRole('img')).toBeNull();
    expect(document.querySelector('.events [class*="cover"]')).toBeNull();
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

  async function editing(): Promise<void> {
    at('/app/events/ev_1/edit');
    await screen.findByRole('heading', { level: 1, name: 'Edit details' });
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

  it("shows the server's copy in the frame after Uploading…, and saves the HEIC itself", async () => {
    signedIn();
    const sent = serving(null);
    await editing();

    chooseHeic();
    const dialog = await screen.findByRole('dialog', { name: 'Cover photo' });

    expect(within(dialog).getByText('Uploading…')).toBeDefined();
    await waitFor(() =>
      expect(dialog.querySelector('.cover-frame img')?.getAttribute('src')).toBe(COPY),
    );
    expect(within(dialog).queryByText('Uploading…')).toBeNull();
    expect(sent.find(({ line }) => line === PREVIEW)?.body).toEqual({
      uploadKey: 'event_cover/org_1/2026/10/one.heic',
    });

    fireEvent.change(within(dialog).getByLabelText('Photo position'), { target: { value: '70' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Use this photo' }));

    const cover = await screen.findByRole('button', { name: 'Change photo' });
    expect(cover.querySelector('img')?.getAttribute('src')).toBe(PHOTO.sizes[0]!.url);
    expect(sent.find(({ line }) => line === 'PUT /api/events/ev_1/cover')?.body).toEqual({
      uploadKey: 'event_cover/org_1/2026/10/one.heic',
      position: 70,
      description: null,
    });
  });

  function chooseShownJpeg(): void {
    vi.stubGlobal(
      'Image',
      class {
        naturalWidth = 2400;
        naturalHeight = 1600;
        onload: (() => void) | null = null;
        set src(_: string) {
          queueMicrotask(() => this.onload?.());
        }
      },
    );
    fireEvent.change(document.getElementById('cover-file')!, {
      target: { files: [new File(['x'], 'arch.jpg', { type: 'image/jpeg' })] },
    });
  }

  it("a JPEG the browser shows is read by the server too, and the frame keeps the browser's own", async () => {
    signedIn();
    const sent = serving(null);
    await editing();

    chooseShownJpeg();
    const dialog = await screen.findByRole('dialog', { name: 'Cover photo' });

    await waitFor(() => expect(sent.map(({ line }) => line)).toContain(PREVIEW));
    await waitFor(() => expect(within(dialog).queryByText('Uploading…')).toBeNull());
    expect(dialog.querySelector('.cover-frame img')?.getAttribute('src')).toBe('blob:chosen');
    expect(
      within(dialog).getByRole('button', { name: 'Use this photo' }).getAttribute('aria-disabled'),
    ).not.toBe('true');
  });

  it('a damaged JPEG whose size the browser reads is refused while Cover photo is open, and nothing is saved (27 Oct)', async () => {
    signedIn();
    const line = 'That file is not a photo we can use. Choose a JPEG, PNG, WebP or HEIC.';
    const sent = serving(PHOTO, { [PREVIEW]: refusedWith(line) });
    await editing();

    chooseShownJpeg();
    const dialog = await screen.findByRole('dialog', { name: 'Cover photo' });

    expect(await within(dialog).findByText(line)).toBeDefined();
    expect(dialog.querySelector('.cover-frame img')?.getAttribute('src')).toBe(PHOTO.sizes[0]!.url);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('button', { name: 'Change photo' })).toBeDefined();
    expect(sent.filter(({ line: sentLine }) => sentLine.startsWith('PUT /api/events'))).toEqual([]);
  });

  for (const [what, line] of [
    [
      'smaller than 1200 × 675',
      'That photo is smaller than 1200 × 675 pixels, so it would look blurred. Choose a larger one.',
    ],
    [
      'not a readable photo',
      'That file is not a photo we can use. Choose a JPEG, PNG, WebP or HEIC.',
    ],
  ] as const) {
    it(`a HEIC ${what} is refused while Cover photo is open, and nothing is saved`, async () => {
      signedIn();
      const sent = serving(PHOTO, { [PREVIEW]: refusedWith(line) });
      await editing();

      chooseHeic();
      const dialog = await screen.findByRole('dialog', { name: 'Cover photo' });

      expect(await within(dialog).findByText(line)).toBeDefined();
      expect(dialog.querySelector('.cover-frame img')?.getAttribute('src')).toBe(
        PHOTO.sizes[0]!.url,
      );
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
      expect(sent.filter(({ line: sentLine }) => sentLine.startsWith('PUT /api/events'))).toEqual(
        [],
      );
    });
  }

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

  it('a copy that cannot be made is never saved unseen: the upload failed, and Cancel keeps the cover', async () => {
    signedIn();
    const sent = serving(PHOTO, { [PREVIEW]: () => new Response(null, { status: 502 }) });
    await editing();

    chooseHeic();
    const dialog = await screen.findByRole('dialog', { name: 'Cover photo' });

    expect(await within(dialog).findByText('The photo did not upload. Try again.')).toBeDefined();
    expect(dialog.querySelector('.cover-frame img')?.getAttribute('src')).toBe(PHOTO.sizes[0]!.url);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByRole('button', { name: 'Change photo' })).toBeDefined();
    await waitFor(() =>
      expect(
        sent.find(({ line }) => line === 'DELETE /api/orgs/org_1/event-cover-uploads')?.body,
      ).toEqual({ uploadKey: 'event_cover/org_1/2026/10/one.heic' }),
    );
    expect(sent.filter(({ line }) => line.startsWith('PUT /api/events'))).toEqual([]);
  });

  it('a copy the frame then cannot show is never saved unseen either', async () => {
    signedIn();
    const sent = serving(null);
    await editing();

    chooseHeic();
    const dialog = await screen.findByRole('dialog', { name: 'Cover photo' });
    await waitFor(() => expect(dialog.querySelector('.cover-frame img')).not.toBeNull());
    fireEvent.error(dialog.querySelector('.cover-frame img')!);

    expect(await within(dialog).findByText('The photo did not upload. Try again.')).toBeDefined();
    expect(dialog.querySelector('.cover-frame')).toBeNull();
    expect(within(dialog).getByRole('button', { name: 'Choose a photo' })).toBeDefined();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Use this photo' }));
    expect(sent.filter(({ line }) => line.startsWith('PUT /api/events'))).toEqual([]);
  });

  it('a file named .jpg that is not a readable photo is refused while Cover photo is open', async () => {
    signedIn();
    const line = 'That file is not a photo we can use. Choose a JPEG, PNG, WebP or HEIC.';
    const sent = serving(PHOTO, { [PREVIEW]: refusedWith(line) });
    await editing();

    fireEvent.change(document.getElementById('cover-file')!, {
      target: { files: [new File(['x'], 'arch.jpg', { type: 'image/jpeg' })] },
    });
    const dialog = await screen.findByRole('dialog', { name: 'Cover photo' });

    expect(await within(dialog).findByText(line)).toBeDefined();
    expect(dialog.querySelector('.cover-frame img')?.getAttribute('src')).toBe(PHOTO.sizes[0]!.url);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(sent.filter(({ line: sentLine }) => sentLine.startsWith('PUT /api/events'))).toEqual([]);
  });

  it('while a HEIC uploads the frame holds the default, not the saved cover, and nothing can be positioned', async () => {
    signedIn();
    let release: (() => void) | null = null;
    serving(PHOTO, {
      [PREVIEW]: () =>
        new Promise((resolve) => {
          release = () => resolve(json({ preview: COPY }));
        }),
    });
    await editing();

    chooseHeic();
    const dialog = await screen.findByRole('dialog', { name: 'Cover photo' });
    await waitFor(() => expect(release).not.toBeNull());

    expect(within(dialog).getByText('Uploading…')).toBeDefined();
    expect(dialog.querySelector('.cover-frame img')).toBeNull();
    expect(dialog.querySelector('.cover-frame .cover-default-wedding')).not.toBeNull();
    const slider = within(dialog).getByLabelText('Photo position');
    expect(slider.getAttribute('aria-disabled')).toBe('true');
    fireEvent.change(slider, { target: { value: '80' } });
    expect((slider as HTMLInputElement).value).toBe('50');
    expect(within(dialog).queryByRole('alert')).toBeNull();

    release!();

    await waitFor(() =>
      expect(dialog.querySelector('.cover-frame img')?.getAttribute('src')).toBe(COPY),
    );
    expect(within(dialog).queryByText('Uploading…')).toBeNull();
    expect(within(dialog).queryByRole('alert')).toBeNull();
    expect(slider.getAttribute('aria-disabled')).toBe('false');
  });

  it('a saved photo that fails to load shows the default in the Cover section and the Cover photo frame', async () => {
    signedIn();
    serving({ ...PHOTO });
    await editing();

    const cover = screen.getByRole('button', { name: 'Change photo' });
    fireEvent.error(within(cover).getByRole('img'));
    expect(within(cover).queryByRole('img')).toBeNull();
    expect(cover.querySelector('.cover-default-wedding')).not.toBeNull();

    fireEvent.click(cover);
    const dialog = await screen.findByRole('dialog', { name: 'Cover photo' });
    fireEvent.error(dialog.querySelector('.cover-frame img')!);

    expect(dialog.querySelector('.cover-frame .cover-default-wedding')).not.toBeNull();
    expect(within(dialog).queryByText('The photo did not upload. Try again.')).toBeNull();
  });
});

describe('Cover photo chooses its own photo, and a refused one never reaches the frame (sc-16524)', () => {
  const PHOTO = {
    position: 30,
    description: 'Adaeze and Tunde under the arch',
    sizes: [
      { width: 640, url: 'http://store.test/c/small.webp' },
      { width: 1280, url: 'http://store.test/c/medium.webp' },
    ],
  };
  const DAMAGED = 'That file is not a photo we can use. Choose a JPEG, PNG, WebP or HEIC.';

  /** Every upload is keyed by its file's name, and the server refuses a file named damaged. */
  function serving(cover: unknown) {
    const sent: { line: string; body: unknown }[] = [];
    let held = event({ cover });
    let uploads = 0;

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const line = `${init?.method ?? 'GET'} ${new URL(String(input)).pathname}`;
      const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : null;
      sent.push({ line, body });

      if (line === 'POST /api/orgs/org_1/event-cover-uploads') {
        uploads += 1;
        return json(
          {
            upload: {
              url: `http://store.test/upload/${uploads}`,
              key: `event_cover/org_1/2026/10/${(body as { filename: string }).filename}`,
              content_type: 'image/jpeg',
            },
          },
          201,
        );
      }
      if (line.startsWith('PUT /upload/')) return new Response(null, { status: 200 });
      if (line === 'POST /api/orgs/org_1/event-cover-uploads/preview')
        return (body as { uploadKey: string }).uploadKey.includes('damaged')
          ? problem(422, 'validation_failed', {
              violations: [{ propertyPath: 'file', message: DAMAGED, code: 'validation_failed' }],
            })
          : json({ preview: 'data:image/webp;base64,UklGRg==' });
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

  function jpeg(name: string, type = 'image/jpeg'): File {
    return new File(['x'], name, { type });
  }

  function upload(chosen: File): void {
    fireEvent.change(document.getElementById('cover-file')!, { target: { files: [chosen] } });
  }

  function pickInDialog(chosen: File): void {
    fireEvent.change(document.getElementById('cover-dialog-file')!, {
      target: { files: [chosen] },
    });
  }

  function frameSource(dialog: HTMLElement): string | null | undefined {
    return dialog.querySelector('.cover-frame img')?.getAttribute('src');
  }

  async function editing(): Promise<void> {
    at('/app/events/ev_1/edit');
    await screen.findByRole('heading', { level: 1, name: 'Edit details' });
  }

  beforeEach(() => {
    URL.createObjectURL = (chosen: Blob) => `blob:${(chosen as File).name}`;
    URL.revokeObjectURL = () => undefined;
    vi.stubGlobal(
      'Image',
      class {
        naturalWidth = 2400;
        naturalHeight = 1600;
        onload: (() => void) | null = null;
        set src(_: string) {
          queueMicrotask(() => this.onload?.());
        }
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('a refused pick keeps the photo chosen earlier in the visit, at its position, and Use this photo saves that one', async () => {
    signedIn();
    const sent = serving(null);
    await editing();

    upload(jpeg('arch.jpg'));
    const dialog = await screen.findByRole('dialog', { name: 'Cover photo' });
    await waitFor(() => expect(within(dialog).queryByText('Uploading…')).toBeNull());
    fireEvent.change(within(dialog).getByLabelText('Photo position'), { target: { value: '80' } });
    fireEvent.change(within(dialog).getByLabelText(/Describe the image/), {
      target: { value: 'The arch' },
    });

    pickInDialog(jpeg('damaged.jpg'));
    const picker = within(dialog).getByRole('button', { name: 'Choose another photo' });

    expect(await within(dialog).findByText(DAMAGED)).toBeDefined();
    expect(frameSource(dialog)).toBe('blob:arch.jpg');
    expect((within(dialog).getByLabelText('Photo position') as HTMLInputElement).value).toBe('80');
    expect((within(dialog).getByLabelText(/Describe the image/) as HTMLTextAreaElement).value).toBe(
      'The arch',
    );
    await waitFor(() => expect(document.activeElement).toBe(picker));
    expect(picker.getAttribute('aria-describedby')).toContain('cover-dialog-refusal');
    expect(document.getElementById('cover-refusal')).toBeNull();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Use this photo' }));

    await waitFor(() =>
      expect(sent.find(({ line }) => line === 'PUT /api/events/ev_1/cover')?.body).toEqual({
        uploadKey: 'event_cover/org_1/2026/10/arch.jpg',
        position: 80,
        description: 'The arch',
      }),
    );
    expect(
      sent.find(({ line }) => line === 'DELETE /api/orgs/org_1/event-cover-uploads')?.body,
    ).toEqual({ uploadKey: 'event_cover/org_1/2026/10/damaged.jpg' });
  });

  it('a refused pick from the cover keeps the saved photo at its saved position, and Use this photo saves it as shown', async () => {
    signedIn();
    const sent = serving(PHOTO);
    await editing();

    fireEvent.click(screen.getByRole('button', { name: 'Change photo' }));
    const dialog = await screen.findByRole('dialog', { name: 'Cover photo' });
    pickInDialog(jpeg('damaged.jpg'));

    expect(await within(dialog).findByText(DAMAGED)).toBeDefined();
    expect(frameSource(dialog)).toBe(PHOTO.sizes[0]!.url);
    expect(dialog.querySelector('.cover-frame img')?.getAttribute('alt')).toBe(PHOTO.description);
    expect((within(dialog).getByLabelText('Photo position') as HTMLInputElement).value).toBe('30');
    expect((within(dialog).getByLabelText(/Describe the image/) as HTMLTextAreaElement).value).toBe(
      PHOTO.description,
    );
    expect(within(dialog).getByRole('button', { name: 'Remove photo' })).toBeDefined();

    fireEvent.change(within(dialog).getByLabelText('Photo position'), { target: { value: '60' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Use this photo' }));

    await waitFor(() =>
      expect(sent.find(({ line }) => line === 'PUT /api/events/ev_1/cover')?.body).toEqual({
        position: 60,
        description: PHOTO.description,
      }),
    );
  });

  it('a refused pick from Upload a photo with a photo saved shows the saved photo, and Cancel keeps the saved cover', async () => {
    signedIn();
    const sent = serving(PHOTO);
    await editing();

    upload(jpeg('damaged.jpg'));
    const dialog = await screen.findByRole('dialog', { name: 'Cover photo' });

    expect(await within(dialog).findByText(DAMAGED)).toBeDefined();
    expect(frameSource(dialog)).toBe(PHOTO.sizes[0]!.url);
    expect((within(dialog).getByLabelText(/Describe the image/) as HTMLTextAreaElement).value).toBe(
      PHOTO.description,
    );
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const img = within(screen.getByRole('button', { name: 'Change photo' })).getByRole('img');
    expect(img.getAttribute('src')).toBe(PHOTO.sizes[0]!.url);
    expect(img.style.objectPosition).toBe('50% 30%');
    expect(sent.filter(({ line }) => line.startsWith('PUT /api/events'))).toEqual([]);
  });

  it('a refused first pick leaves Choose a photo, with nothing to position or describe and nothing to use', async () => {
    signedIn();
    const sent = serving(null);
    await editing();

    upload(jpeg('damaged.jpg'));
    const dialog = await screen.findByRole('dialog', { name: 'Cover photo' });
    const choose = await within(dialog).findByRole('button', { name: 'Choose a photo' });

    expect(within(dialog).getByText(DAMAGED)).toBeDefined();
    expect(dialog.querySelector('.cover-frame')).toBeNull();
    expect(dialog.querySelector('[data-testid="cover-default"]')).toBeNull();
    expect(
      within(dialog).getByText('JPEG, PNG, WebP or HEIC, up to 15 MB, at least 1200 × 675 pixels.'),
    ).toBeDefined();
    expect(within(dialog).queryByLabelText('Photo position')).toBeNull();
    expect(within(dialog).queryByLabelText(/Describe the image/)).toBeNull();
    expect(within(dialog).queryByRole('button', { name: 'Remove photo' })).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(choose));
    expect(choose.getAttribute('aria-describedby')).toBe(
      'cover-dialog-refusal cover-dialog-accepted',
    );
    const use = within(dialog).getByRole('button', { name: 'Use this photo' });
    expect(use.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(use);
    expect(sent.filter(({ line }) => line.startsWith('PUT /api/events'))).toEqual([]);
  });

  it('a good pick after a refusal clears it, fills the frame at the middle with no description, and focus goes to Photo position', async () => {
    signedIn();
    serving(PHOTO);
    await editing();

    fireEvent.click(screen.getByRole('button', { name: 'Change photo' }));
    const dialog = await screen.findByRole('dialog', { name: 'Cover photo' });
    pickInDialog(jpeg('damaged.jpg'));
    await within(dialog).findByText(DAMAGED);

    pickInDialog(jpeg('garden.jpg'));

    await waitFor(() => expect(frameSource(dialog)).toBe('blob:garden.jpg'));
    expect(within(dialog).queryByText(DAMAGED)).toBeNull();
    const slider = within(dialog).getByLabelText('Photo position') as HTMLInputElement;
    expect(slider.value).toBe('50');
    expect((within(dialog).getByLabelText(/Describe the image/) as HTMLTextAreaElement).value).toBe(
      '',
    );
    await waitFor(() => expect(document.activeElement).toBe(slider));
    await waitFor(() => expect(within(dialog).queryByText('Uploading…')).toBeNull());
    expect(
      within(dialog)
        .getByRole('button', { name: 'Choose another photo' })
        .getAttribute('aria-describedby'),
    ).toBeNull();
  });

  it('a photo the frame cannot show keeps the position and description given the saved photo in this visit, as a refusal from the server does', async () => {
    signedIn();
    serving(PHOTO);
    await editing();

    fireEvent.click(screen.getByRole('button', { name: 'Change photo' }));
    const dialog = await screen.findByRole('dialog', { name: 'Cover photo' });
    fireEvent.change(within(dialog).getByLabelText('Photo position'), { target: { value: '70' } });
    fireEvent.change(within(dialog).getByLabelText(/Describe the image/), {
      target: { value: 'The terrace at dusk' },
    });

    pickInDialog(jpeg('b.jpg'));
    await waitFor(() => expect(frameSource(dialog)).toBe('blob:b.jpg'));
    await waitFor(() => expect(within(dialog).queryByText('Uploading…')).toBeNull());
    fireEvent.error(dialog.querySelector('.cover-frame img')!);

    expect(await within(dialog).findByText('The photo did not upload. Try again.')).toBeDefined();
    expect(frameSource(dialog)).toBe(PHOTO.sizes[0]!.url);
    expect((within(dialog).getByLabelText('Photo position') as HTMLInputElement).value).toBe('70');
    expect((within(dialog).getByLabelText(/Describe the image/) as HTMLTextAreaElement).value).toBe(
      'The terrace at dusk',
    );
  });

  it('a photo the frame cannot show gives back the one chosen earlier in this visit, and Use this photo saves that one', async () => {
    signedIn();
    const sent = serving(null);
    await editing();

    upload(jpeg('a.jpg'));
    const dialog = await screen.findByRole('dialog', { name: 'Cover photo' });
    await waitFor(() => expect(within(dialog).queryByText('Uploading…')).toBeNull());
    fireEvent.change(within(dialog).getByLabelText('Photo position'), { target: { value: '80' } });

    pickInDialog(jpeg('b.jpg'));
    await waitFor(() => expect(frameSource(dialog)).toBe('blob:b.jpg'));
    await waitFor(() => expect(within(dialog).queryByText('Uploading…')).toBeNull());
    fireEvent.error(dialog.querySelector('.cover-frame img')!);

    expect(await within(dialog).findByText('The photo did not upload. Try again.')).toBeDefined();
    expect(frameSource(dialog)).toBe('blob:a.jpg');
    expect((within(dialog).getByLabelText('Photo position') as HTMLInputElement).value).toBe('80');
    expect(
      sent
        .filter(({ line }) => line === 'DELETE /api/orgs/org_1/event-cover-uploads')
        .map(({ body }) => body),
    ).toEqual([{ uploadKey: 'event_cover/org_1/2026/10/b.jpg' }]);

    fireEvent.click(within(dialog).getByRole('button', { name: 'Use this photo' }));

    await waitFor(() =>
      expect(sent.find(({ line }) => line === 'PUT /api/events/ev_1/cover')?.body).toEqual({
        uploadKey: 'event_cover/org_1/2026/10/a.jpg',
        position: 80,
        description: null,
      }),
    );
  });

  it('a refusal from the server keeps the position and description given the saved photo in this visit, as one before upload does', async () => {
    signedIn();
    serving(PHOTO);
    await editing();

    fireEvent.click(screen.getByRole('button', { name: 'Change photo' }));
    const dialog = await screen.findByRole('dialog', { name: 'Cover photo' });
    fireEvent.change(within(dialog).getByLabelText('Photo position'), { target: { value: '70' } });
    fireEvent.change(within(dialog).getByLabelText(/Describe the image/), {
      target: { value: 'The terrace at dusk' },
    });

    pickInDialog(jpeg('damaged.jpg'));

    expect(await within(dialog).findByText(DAMAGED)).toBeDefined();
    expect(frameSource(dialog)).toBe(PHOTO.sizes[0]!.url);
    expect((within(dialog).getByLabelText('Photo position') as HTMLInputElement).value).toBe('70');
    expect((within(dialog).getByLabelText(/Describe the image/) as HTMLTextAreaElement).value).toBe(
      'The terrace at dusk',
    );
  });

  it('announces a refusal in the dialog, and two the same in a row leave focus where the organiser takes it next', async () => {
    signedIn();
    serving(PHOTO);
    await editing();

    fireEvent.click(screen.getByRole('button', { name: 'Change photo' }));
    const dialog = await screen.findByRole('dialog', { name: 'Cover photo' });
    const picker = within(dialog).getByRole('button', { name: 'Choose another photo' });
    pickInDialog(jpeg('a.gif', 'image/gif'));
    const alert = await within(dialog).findByRole('alert');
    expect(alert.id).toBe('cover-dialog-refusal');
    await waitFor(() => expect(document.activeElement).toBe(picker));

    pickInDialog(jpeg('b.gif', 'image/gif'));
    await waitFor(() => expect(document.activeElement).toBe(picker));
    const describe = within(dialog).getByLabelText(/Describe the image/);
    describe.focus();
    fireEvent.change(describe, { target: { value: 'T' } });
    fireEvent.change(within(dialog).getByLabelText('Photo position'), { target: { value: '31' } });

    expect(document.activeElement).toBe(describe);
  });

  it("refuses a wrong type from the dialog's picker before it uploads, under the picker, and the dialog stays open", async () => {
    signedIn();
    const sent = serving(PHOTO);
    await editing();

    fireEvent.click(screen.getByRole('button', { name: 'Change photo' }));
    const dialog = await screen.findByRole('dialog', { name: 'Cover photo' });
    pickInDialog(jpeg('a.gif', 'image/gif'));

    expect(
      await within(dialog).findByText(
        'That file is not a photo we can use. Choose a JPEG, PNG, WebP or HEIC.',
      ),
    ).toBeDefined();
    expect(screen.getByRole('dialog', { name: 'Cover photo' })).toBeDefined();
    expect(frameSource(dialog)).toBe(PHOTO.sizes[0]!.url);
    expect(sent.map(({ line }) => line)).not.toContain('POST /api/orgs/org_1/event-cover-uploads');
  });
});

describe('Every pick is held under Uploading… until the server has read it (sc-17978)', () => {
  const PHOTO = {
    position: 30,
    description: 'Adaeze and Tunde under the arch',
    sizes: [
      { width: 640, url: 'http://store.test/c/small.webp' },
      { width: 1280, url: 'http://store.test/c/medium.webp' },
    ],
  };
  const DAMAGED = 'That file is not a photo we can use. Choose a JPEG, PNG, WebP or HEIC.';

  /** Each preview waits for `answer(name)`; the server refuses a file named damaged. */
  function serving(cover: unknown) {
    const waiting = new Map<string, () => void>();

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const line = `${init?.method ?? 'GET'} ${new URL(String(input)).pathname}`;
      const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : null;

      if (line === 'POST /api/orgs/org_1/event-cover-uploads') {
        const { filename } = body as { filename: string };
        return json(
          {
            upload: {
              url: `http://store.test/upload/${filename}`,
              key: `event_cover/org_1/2026/10/${filename}`,
              content_type: 'image/jpeg',
            },
          },
          201,
        );
      }
      if (line.startsWith('PUT /upload/')) return new Response(null, { status: 200 });
      if (line === 'POST /api/orgs/org_1/event-cover-uploads/preview') {
        const name = (body as { uploadKey: string }).uploadKey.split('/').pop()!;
        await new Promise<void>((resolve) => waiting.set(name, resolve));
        return name.includes('damaged')
          ? problem(422, 'validation_failed', {
              violations: [{ propertyPath: 'file', message: DAMAGED, code: 'validation_failed' }],
            })
          : json({ preview: 'data:image/webp;base64,UklGRg==' });
      }
      if (line === 'DELETE /api/orgs/org_1/event-cover-uploads')
        return new Response(null, { status: 204 });

      return new Response(JSON.stringify({ event: event({ cover }) }), {
        headers: { ETag: '"1"' },
      });
    });

    async function answer(name: string): Promise<void> {
      await waitFor(() => expect(waiting.has(name)).toBe(true));
      waiting.get(name)!();
    }

    return { waiting, answer };
  }

  function jpeg(name: string): File {
    return new File(['x'], name, { type: 'image/jpeg' });
  }

  function pickInDialog(chosen: File): void {
    fireEvent.change(document.getElementById('cover-dialog-file')!, {
      target: { files: [chosen] },
    });
  }

  async function changing(): Promise<HTMLElement> {
    at('/app/events/ev_1/edit');
    await screen.findByRole('heading', { level: 1, name: 'Edit details' });
    fireEvent.click(screen.getByRole('button', { name: 'Change photo' }));

    return screen.findByRole('dialog', { name: 'Cover photo' });
  }

  function expectHeld(dialog: HTMLElement): void {
    expect(within(dialog).getByText('Uploading…')).toBeDefined();
    expect(dialog.querySelector('.cover-frame img')).toBeNull();
    expect(dialog.querySelector('.cover-frame .cover-default-wedding')).not.toBeNull();
    expect(within(dialog).getByLabelText('Photo position').getAttribute('aria-disabled')).toBe(
      'true',
    );
    expect(
      within(dialog).getByRole('button', { name: 'Use this photo' }).getAttribute('aria-disabled'),
    ).toBe('true');
  }

  beforeEach(() => {
    URL.createObjectURL = (chosen: Blob) => `blob:${(chosen as File).name}`;
    URL.revokeObjectURL = () => undefined;
    vi.stubGlobal(
      'Image',
      class {
        naturalWidth = 2400;
        naturalHeight = 1600;
        onload: (() => void) | null = null;
        set src(_: string) {
          queueMicrotask(() => this.onload?.());
        }
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('a good JPEG held at the server shows the default with nothing to position, then shows at the middle, keeping what was described', async () => {
    signedIn();
    const { answer } = serving(PHOTO);
    const dialog = await changing();

    pickInDialog(jpeg('garden.jpg'));
    await waitFor(() => expect(within(dialog).getByText('Uploading…')).toBeDefined());
    expectHeld(dialog);
    const slider = within(dialog).getByLabelText('Photo position') as HTMLInputElement;
    fireEvent.change(slider, { target: { value: '80' } });
    expect(slider.value).toBe('50');
    fireEvent.change(within(dialog).getByLabelText(/Describe the image/), {
      target: { value: 'The garden at dusk' },
    });

    await answer('garden.jpg');

    await waitFor(() =>
      expect(dialog.querySelector('.cover-frame img')?.getAttribute('src')).toBe('blob:garden.jpg'),
    );
    expect(within(dialog).queryByText('Uploading…')).toBeNull();
    expect(slider.getAttribute('aria-disabled')).toBe('false');
    expect(slider.value).toBe('50');
    expect(document.activeElement).toBe(slider);
    expect((within(dialog).getByLabelText(/Describe the image/) as HTMLTextAreaElement).value).toBe(
      'The garden at dusk',
    );
  });

  it('a damaged JPEG is never in the frame between the pick and its refusal', async () => {
    signedIn();
    const { answer } = serving(PHOTO);
    const dialog = await changing();

    pickInDialog(jpeg('damaged.jpg'));
    await waitFor(() => expect(within(dialog).getByText('Uploading…')).toBeDefined());
    expectHeld(dialog);

    await answer('damaged.jpg');

    expect(await within(dialog).findByText(DAMAGED)).toBeDefined();
    expect(within(dialog).queryByText('Uploading…')).toBeNull();
    expect(dialog.querySelector('.cover-frame img')?.getAttribute('src')).toBe(PHOTO.sizes[0]!.url);
  });

  it('a second pick while the first uploads keeps the default until the second has been read', async () => {
    signedIn();
    const { waiting, answer } = serving(PHOTO);
    const dialog = await changing();

    pickInDialog(jpeg('first.jpg'));
    await waitFor(() => expect(within(dialog).getByText('Uploading…')).toBeDefined());
    pickInDialog(jpeg('second.jpg'));
    await waitFor(() => expect(waiting.has('second.jpg')).toBe(true));

    await answer('first.jpg');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expectHeld(dialog);

    await answer('second.jpg');

    await waitFor(() =>
      expect(dialog.querySelector('.cover-frame img')?.getAttribute('src')).toBe('blob:second.jpg'),
    );
    expect(within(dialog).queryByText('Uploading…')).toBeNull();
  });

  /** The browser sizes the named file only when told to, so the first pick can answer meanwhile. */
  function sizingLater(name: string, width: number): () => void {
    let size: () => void = () => undefined;
    vi.stubGlobal(
      'Image',
      class {
        naturalWidth = 2400;
        naturalHeight = 1600;
        onload: (() => void) | null = null;
        set src(url: string) {
          if (url === `blob:${name}`) {
            this.naturalWidth = width;
            size = () => this.onload?.();
          } else queueMicrotask(() => this.onload?.());
        }
      },
    );

    return () => size();
  }

  it('the first pick answering while the browser sizes the second never shows', async () => {
    signedIn();
    const { answer } = serving(PHOTO);
    const size = sizingLater('second.jpg', 2400);
    const dialog = await changing();

    pickInDialog(jpeg('first.jpg'));
    await waitFor(() => expect(within(dialog).getByText('Uploading…')).toBeDefined());
    pickInDialog(jpeg('second.jpg'));
    await answer('first.jpg');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expectHeld(dialog);

    size();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expectHeld(dialog);
    await answer('second.jpg');

    await waitFor(() =>
      expect(dialog.querySelector('.cover-frame img')?.getAttribute('src')).toBe('blob:second.jpg'),
    );
  });

  it('a second pick refused before it uploads shows the first, read while the second was sized', async () => {
    signedIn();
    const { waiting, answer } = serving(PHOTO);
    const size = sizingLater('small.jpg', 10);
    const dialog = await changing();

    pickInDialog(jpeg('first.jpg'));
    await waitFor(() => expect(within(dialog).getByText('Uploading…')).toBeDefined());
    pickInDialog(jpeg('small.jpg'));
    await answer('first.jpg');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expectHeld(dialog);

    size();

    await waitFor(() =>
      expect(dialog.querySelector('.cover-frame img')?.getAttribute('src')).toBe('blob:first.jpg'),
    );
    expect(within(dialog).queryByText('Uploading…')).toBeNull();
    expect(waiting.has('small.jpg')).toBe(false);
  });
});

describe('Hosted by, in Edit details (sc-6713)', () => {
  type Sent = { line: string; body: unknown; ifMatch: string | null };

  /** The event as the API holds it, and every request sent; a PATCH is applied as the API would. */
  function serving(held: Record<string, unknown>, answers: Record<string, Answer> = {}) {
    const sent: Sent[] = [];
    let current = event(held);

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const line = `${init?.method ?? 'GET'} ${new URL(String(input)).pathname}`;
      const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : null;
      sent.push({ line, body, ifMatch: new Headers(init?.headers).get('If-Match') });

      const answer = await answers[line]?.(body, new URL(String(input)));
      if (answer != null) return answer;

      if (line === 'PATCH /api/events/ev_1') current = { ...current, ...(body as object) };

      return new Response(JSON.stringify({ event: current }), {
        status: 200,
        headers: { ETag: '"4"' },
      });
    });

    return sent;
  }

  async function editing(hash = ''): Promise<void> {
    at(`/app/events/ev_1/edit${hash}`);
    await screen.findByRole('heading', { level: 1, name: 'Edit details' });
  }

  function hostSection(): HTMLElement {
    return screen.getByRole('region', { name: 'Hosted by' });
  }

  function names(): string[] {
    return within(hostSection())
      .queryAllByRole('textbox')
      .map((field) => (field as HTMLTextAreaElement).value);
  }

  function patched(sent: Sent[]): Sent | undefined {
    return sent.find(({ line }) => line === 'PATCH /api/events/ev_1');
  }

  it('lists the hosts in their order, each labelled by its position, after About the event', async () => {
    signedIn();
    serving({ hosts: ['Funmi Adeyemi', 'Tayo Adeyemi'] });
    await editing();

    expect(names()).toEqual(['Funmi Adeyemi', 'Tayo Adeyemi']);
    expect(screen.getByLabelText<HTMLTextAreaElement>('Host 2').value).toBe('Tayo Adeyemi');
    const headings = screen.getAllByRole('heading', { level: 2 }).map((one) => one.textContent);
    expect(headings.indexOf('Hosted by')).toBe(headings.indexOf('About the event') + 1);
  });

  it('says a draft with no hosts has none yet, and adds an empty row with focus in it', async () => {
    signedIn();
    serving({ hosts: [] });
    await editing();

    expect(
      within(hostSection()).getByText(
        'No hosts yet. The event can be made live once it has at least one.',
      ),
    ).toBeDefined();
    fireEvent.click(within(hostSection()).getByRole('button', { name: 'Add a host' }));

    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Host 1')));
    expect(within(hostSection()).getByRole('button', { name: 'Remove Host 1' })).toBeDefined();
  });

  it('leaves focus in the last row added when Add a host is pressed again and again up to six', async () => {
    signedIn();
    serving({ hosts: [] });
    await editing();

    for (let i = 0; i < 6; i += 1) {
      fireEvent.click(within(hostSection()).getByRole('button', { name: 'Add a host' }));
    }

    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Host 6')));
    expect(within(hostSection()).queryByRole('button', { name: 'Add a host' })).toBeNull();
  });

  it('puts focus in the new row when Add a host is pressed the moment it shows', async () => {
    signedIn();
    serving({ status: 'live', phase: 'live', hosts: [] });
    let pressed = false;
    const watcher = new MutationObserver(() => {
      const add = document.getElementById('event-host-add');
      if (add != null && !pressed) {
        pressed = true;
        add.click();
      }
    });
    watcher.observe(document.body, { childList: true, subtree: true });
    await editing();
    await waitFor(() => expect(pressed).toBe(true));
    watcher.disconnect();

    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Host 1')));
  });

  it('sends the names as typed and trimmed, in their order, with the tag it read', async () => {
    signedIn();
    const sent = serving({ hosts: [] });
    await editing();

    fireEvent.click(within(hostSection()).getByRole('button', { name: 'Add a host' }));
    fireEvent.change(screen.getByLabelText('Host 1'), { target: { value: ' Funmi Adeyemi ' } });
    fireEvent.click(within(hostSection()).getByRole('button', { name: 'Add a host' }));
    fireEvent.change(screen.getByLabelText('Host 2'), {
      target: { value: 'The Okafor\nfamily' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(patched(sent)).toEqual({
        line: 'PATCH /api/events/ev_1',
        body: { hosts: ['Funmi Adeyemi', 'The Okafor family'] },
        ifMatch: '"4"',
      }),
    );
  });

  it('moves a host, keeping focus on the arrow pressed or the other once it reaches the end, and announces it', async () => {
    signedIn();
    const sent = serving({ hosts: ['Funmi Adeyemi', 'Tayo Adeyemi', 'Ade Bello'] });
    await editing();

    expect(
      within(hostSection()).queryByRole('button', { name: 'Move Funmi Adeyemi up' }),
    ).toBeNull();
    expect(within(hostSection()).queryByRole('button', { name: 'Move Ade Bello down' })).toBeNull();

    fireEvent.click(within(hostSection()).getByRole('button', { name: 'Move Ade Bello up' }));
    expect(names()).toEqual(['Funmi Adeyemi', 'Ade Bello', 'Tayo Adeyemi']);
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(hostSection()).getByRole('button', { name: 'Move Ade Bello up' }),
      ),
    );
    expect(document.querySelector('.event-form [role="status"]')?.textContent).toBe(
      'Ade Bello moved to 2 of 3',
    );

    fireEvent.click(within(hostSection()).getByRole('button', { name: 'Move Ade Bello up' }));
    expect(names()).toEqual(['Ade Bello', 'Funmi Adeyemi', 'Tayo Adeyemi']);
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(hostSection()).getByRole('button', { name: 'Move Ade Bello down' }),
      ),
    );

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() =>
      expect(patched(sent)?.body).toEqual({
        hosts: ['Ade Bello', 'Funmi Adeyemi', 'Tayo Adeyemi'],
      }),
    );
  });

  it("removes a host, announcing it and moving focus to the next row's name, else Add a host", async () => {
    signedIn();
    serving({ hosts: ['Funmi Adeyemi', 'Tayo Adeyemi'] });
    await editing();

    fireEvent.click(within(hostSection()).getByRole('button', { name: 'Remove Funmi Adeyemi' }));
    expect(names()).toEqual(['Tayo Adeyemi']);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Host 1')));
    expect(document.querySelector('.event-form [role="status"]')?.textContent).toBe(
      'Funmi Adeyemi removed',
    );

    fireEvent.click(within(hostSection()).getByRole('button', { name: 'Remove Tayo Adeyemi' }));
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(hostSection()).getByRole('button', { name: 'Add a host' }),
      ),
    );
  });

  it('offers no Add a host at six, and says six is the most', async () => {
    signedIn();
    serving({ hosts: ['A', 'B', 'C', 'D', 'E', 'F'] });
    await editing();

    expect(within(hostSection()).queryByRole('button', { name: 'Add a host' })).toBeNull();
    expect(within(hostSection()).getByText('6 is the most hosts an event can have.')).toBeDefined();
  });

  it("keeps a live event's last host, saying why under its name", async () => {
    signedIn();
    serving({ status: 'live', phase: 'live', hosts: ['Funmi Adeyemi'] });
    await editing();

    expect(within(hostSection()).queryByRole('button', { name: /^Remove/ })).toBeNull();
    const field = screen.getByLabelText('Host 1');
    const help = document.getElementById(
      field.getAttribute('aria-describedby') ?? 'none',
    )?.textContent;
    expect(help).toBe(
      'Guests can see this event, so it needs at least one host. You can still change this name.',
    );
  });

  it('lets a live event with no saved host remove a row it added', async () => {
    signedIn();
    serving({ status: 'live', phase: 'live', hosts: [] });
    await editing();

    fireEvent.click(within(hostSection()).getByRole('button', { name: 'Add a host' }));

    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Host 1')));
    expect(within(hostSection()).getByRole('button', { name: 'Remove Host 1' })).toBeDefined();
  });

  it('refuses a blank, a too-long and a repeated name at once, focusing the first in page order', async () => {
    signedIn();
    const sent = serving({ hosts: [] });
    await editing();

    for (const name of ['Funmi Adeyemi', ' ', 'x'.repeat(66), 'FUNMI adeyemi']) {
      fireEvent.click(within(hostSection()).getByRole('button', { name: 'Add a host' }));
      const fields = within(hostSection()).getAllByRole('textbox');
      fireEvent.change(fields[fields.length - 1]!, { target: { value: name } });
    }
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Host 2')));
    expect(within(hostSection()).getByText('Enter a name or remove this host.')).toBeDefined();
    expect(
      within(hostSection()).getByText(
        "A host's name can be at most 60 characters. This one has 66.",
      ),
    ).toBeDefined();
    expect(within(hostSection()).getByText('Funmi Adeyemi is already a host.')).toBeDefined();
    expect(patched(sent)).toBeUndefined();
  });

  it("puts the event name's refusal ahead of a host's for focus", async () => {
    signedIn();
    serving({ hosts: [' '] });
    await editing();

    fireEvent.change(screen.getByLabelText('Event name'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Event name')));
    expect(within(hostSection()).getByText('Enter a name or remove this host.')).toBeDefined();
  });

  it("shows the server's refusal under the host it names", async () => {
    signedIn();
    serving(
      { hosts: ['Funmi Adeyemi'] },
      {
        'PATCH /api/events/ev_1': () =>
          problem(422, 'validation_failed', {
            violations: [
              { propertyPath: 'hosts[1]', message: 'Tayo is already a host.', code: 'x' },
            ],
          }),
      },
    );
    await editing();

    fireEvent.click(within(hostSection()).getByRole('button', { name: 'Add a host' }));
    fireEvent.change(screen.getByLabelText('Host 2'), { target: { value: 'Tayo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Host 2')));
    expect(within(hostSection()).getByText('Tayo is already a host.')).toBeDefined();
  });

  it('arrives from Make live at Add a host when there are none', async () => {
    signedIn();
    serving({ hosts: [] });
    await editing('#hosts');

    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(hostSection()).getByRole('button', { name: 'Add a host' }),
      ),
    );
  });

  it("arrives from Make live at the first host's name", async () => {
    signedIn();
    serving({ hosts: ['Funmi Adeyemi'] });
    await editing('#hosts');

    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Host 1')));
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
    const { sent, dialog, host } = await asking({
      [SAVE]: () => tagged({ event: event({ ...AHEAD, hosts: ['Funmi Adeyemi'] }) }, '"2"'),
      [LIVE]: () =>
        tagged(
          { event: event({ ...AHEAD, status: 'live', phase: 'live', hosts: ['Funmi Adeyemi'] }) },
          '"3"',
        ),
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
    at('/app/events/ev_1');

    const panel = await comingUp();
    await waitFor(() => expect(rows(panel)).toHaveLength(1));

    vi.setSystemTime(new Date('2030-10-13T09:00:04.200Z'));
    fireEvent.click(screen.getByRole('button', { name: 'Call off…' }));
    const dialog = await screen.findByRole('dialog', { name: 'Call off Adaeze and Tunde?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Call off' }));

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

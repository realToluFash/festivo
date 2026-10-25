import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { __setSessionState, type Session } from '../../../session.ts';
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
    status: 'draft',
    startsAt: '2026-11-14T16:00:00+01:00',
    endsAt: '2026-11-15T02:00:00+01:00',
    timeZone: 'Africa/Lagos',
    dayCount: 2,
    currency: 'NGN',
    createdAt: '2026-10-21T09:00:00+00:00',
    ...overrides,
  };
}

function signedIn(organisation = IRE): void {
  const session: Session = {
    name: 'Folake Adeyemi',
    email: 'folake@ire.events',
    verified: true,
    complete: true,
    awaiting: null,
    providers: [],
    needsOrganisation: false,
    hasPassword: true,
    organisation,
    organisations: [organisation],
    organisationCountry: null,
    timezone: null,
    waitingFor: null,
  };

  __setSessionState({ status: 'signedIn', session });
}

type Answer = (body: unknown) => Response | Promise<Response>;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
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
    const line = `${init?.method ?? 'GET'} ${new URL(String(input)).pathname}`;
    const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : null;
    sent.push({ line, body });

    return (await answers[line]?.(body)) ?? json({});
  });

  return sent;
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
});

describe('Events', () => {
  it('lists each event with Draft and its start date, in the order the API gives', async () => {
    signedIn();
    answering({
      'GET /api/orgs/org_1/events': () =>
        json({
          events: [
            event(),
            event({
              id: 'ev_2',
              name: 'Board dinner',
              startsAt: '2026-12-01T19:00:00+00:00',
              endsAt: '2026-12-01T23:00:00+00:00',
              timeZone: 'Europe/London',
            }),
          ],
        }),
    });
    at('/app/events');

    const rows = await screen.findAllByRole('listitem');

    expect(rows.map((row) => spaced(row.textContent))).toEqual([
      'Adaeze and TundeDraftSat, Nov 14, 2026',
      'Board dinnerDraftTue, Dec 1, 2026',
    ]);
    expect(within(rows[0]!).getByRole('link').getAttribute('href')).toBe('/app/events/ev_1');
    expect(screen.getByRole('link', { name: 'New event' }).getAttribute('href')).toBe(
      '/app/events/new',
    );
    expect(screen.queryByRole('tab')).toBeNull();
  });

  it('shows the first-run card, with Create an event, to an organisation with no events', async () => {
    signedIn();
    answering({ 'GET /api/orgs/org_1/events': () => json({ events: [] }) });
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
    answering({ 'GET /api/orgs/org_1/events': () => json({ events: [] }) });
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
      'GET /api/orgs/org_1/events': () =>
        ++calls === 1 ? problem(500, 'internal_error') : json({ events: [event()] }),
    });
    at('/app/events');

    expect((await screen.findByRole('alert')).textContent).toContain(
      'The events did not load. Try again in a moment.',
    );
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('link', { name: /Adaeze and Tunde/ })).toBeDefined();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it("counts the organisation's events on the dashboard", async () => {
    signedIn();
    answering({
      'GET /api/orgs/org_1/events': () => json({ events: [event(), event({ id: 'ev_2' })] }),
    });
    at('/app');

    expect(await screen.findByText('2 events')).toBeDefined();
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
      'event-start-date',
      'event-start-time',
      'event-end-date',
      'event-end-time',
      'event-time-zone',
      'event-currency',
    ]);
    expect(screen.getByLabelText<HTMLSelectElement>('Time zone').value).toBe('Africa/Lagos');
    expect(screen.getByLabelText<HTMLSelectElement>('Currency').value).toBe('NGN');
    expect(
      screen.getByText('An event can run past midnight. Choose the day it ends.'),
    ).toBeDefined();
  });

  it('counts the name as it is typed', async () => {
    signedIn();
    answering({});
    await form();

    expect(screen.getByText('0 of 120 characters')).toBeDefined();
    fill('event-name', '  Ìrè gala ');
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

  it('sends nothing for a blank name, says so beside it and moves focus to it', async () => {
    signedIn();
    const sent = answering({});
    await form();

    fill('event-name', '   ');
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

    const start = document.getElementById('event-start-date')!;
    await waitFor(() => expect(document.activeElement).toBe(start));
    expect(errorUnder('event-start-date')).toContain('Choose when the event starts.');
    expect(errorUnder('event-end-date')).toContain('Choose when the event ends.');
    expect(screen.getByRole('status').textContent).toBe(
      '2 fields need fixing, so nothing was sent.',
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
        startsAt: '2026-11-14T16:00',
        endsAt: '2026-11-14T16:00',
        timeZone: 'Africa/Lagos',
        currency: 'NGN',
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
        startsAt: '2026-11-14T16:00',
        endsAt: '2026-11-15T02:00',
        timeZone: 'Europe/London',
        currency: 'GBP',
      },
    });
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

    fill('event-start-date', '2027-03-28');
    fill('event-start-time', '02:00');
    fill('event-end-time', '02:45');

    expect(gapLine('event-start-gap')).toContain('It will be saved as 03:00.');
    expect(gapLine('event-end-gap')).toContain('It will be saved as 03:45.');
    expect(described('event-end-time')).toContain(
      'An event can run past midnight. Choose the day it ends.',
    );
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

describe("An event's page", () => {
  it("shows the name, Draft, and the start and end in the event's zone", async () => {
    signedIn();
    answering({ 'GET /api/events/ev_1': () => json({ event: event() }) });
    at('/app/events/ev_1');

    const heading = await screen.findByRole('heading', { level: 1, name: 'Adaeze and Tunde' });
    const card = heading.closest('section')!;

    expect(within(card).getByText('Draft')).toBeDefined();
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

    await screen.findByRole('heading', { level: 1, name: 'Adaeze and Tunde' });

    expect(spaced(screen.getByText(/Africa\/Lagos/).textContent)).toBe(
      'Sat, Nov 14, 2026, 16:00 – 23:00 · Africa/Lagos',
    );
  });

  it('opens Guests, which says the guest list is coming', async () => {
    signedIn();
    answering({ 'GET /api/events/ev_1': () => json({ event: event() }) });
    at('/app/events/ev_1');

    const heading = await screen.findByRole('heading', { level: 1, name: 'Adaeze and Tunde' });
    fireEvent.click(within(heading.closest('section')!).getByRole('link', { name: 'Guests' }));

    expect(await screen.findByText('The guest list for this event is coming.')).toBeDefined();
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

      const answer = await answers[line]?.(body);
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

    fireEvent.click(
      within(heading.closest('section')!).getByRole('link', { name: 'Edit details' }),
    );
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
      (document.getElementById('event-start-date') as HTMLInputElement).value,
      (document.getElementById('event-start-time') as HTMLInputElement).value,
      (document.getElementById('event-end-date') as HTMLInputElement).value,
      (document.getElementById('event-end-time') as HTMLInputElement).value,
      value('Time zone'),
      value('Currency'),
    ]).toEqual([
      'Adaeze and Tunde',
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

  it('sends nothing when nothing changed, and the page says so', async () => {
    signedIn();
    const { sent } = serving();
    await editing();

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('Nothing changed, so nothing was sent.')).toBeDefined();
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
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Saved'));
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

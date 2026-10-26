import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { EVENT_TYPES } from '@soirely/domain';

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
    type: 'wedding',
    status: 'draft',
    startsAt: '2026-11-14T16:00:00+01:00',
    endsAt: '2026-11-15T02:00:00+01:00',
    timeZone: 'Africa/Lagos',
    dayCount: 2,
    currency: 'NGN',
    cover: null,
    venue: null,
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
              type: 'corporate',
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
      'Adaeze and TundeWeddingDraftSat, Nov 14, 2026',
      'Board dinnerCorporate eventDraftTue, Dec 1, 2026',
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

  it.each([
    ['the list', [event()], 'Events'],
    ['the first-run card', [], 'Set up your first event'],
  ])(
    'takes focus to the heading above %s once Try again loads it (sc-11369)',
    async (_what, events, heading) => {
      signedIn();
      let calls = 0;
      answering({
        'GET /api/orgs/org_1/events': () =>
          ++calls === 1 ? problem(500, 'internal_error') : json({ events }),
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

describe("An event's page", () => {
  it("shows the name, Draft, and the start and end in the event's zone", async () => {
    signedIn();
    answering({ 'GET /api/events/ev_1': () => json({ event: event() }) });
    at('/app/events/ev_1');

    const heading = await screen.findByRole('heading', { level: 1, name: 'Adaeze and Tunde' });
    const card = heading.closest('section')!;

    expect(within(card).getByText('Draft')).toBeDefined();
    expect(heading.parentElement?.nextElementSibling?.textContent).toBe('Wedding');
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
    const title = await screen.findByRole('heading', { level: 1, name: 'Edit details' });
    await waitFor(() => expect(document.activeElement).toBe(title));

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
    const sidebarEvents = screen.getByRole('link', { name: 'Events' });
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
    const sidebarEvents = screen.getByRole('link', { name: 'Events' });
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

      const answer = await answers[line]?.(body);
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
    expect(within(venue).getByText('The Civic Centre')).toBeDefined();
    expect(within(venue).getByText('Ozumba Mbadiwe Avenue, Lagos')).toBeDefined();
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

    expect(await screen.findByText('12 Bode Thomas Street')).toBeDefined();
    expect(screen.queryByRole('link', { name: 'Open in maps' })).toBeNull();
  });

  it('says Venue to be confirmed, with Add the venue only for events.manage, opening the Venue section', async () => {
    signedIn();
    serving({});
    at('/app/events/ev_1');
    expect(await screen.findByText('Venue to be confirmed')).toBeDefined();

    fireEvent.click(screen.getByRole('link', { name: 'Add the venue' }));
    await screen.findByRole('heading', { level: 1, name: 'Edit details' });
    await waitFor(() => expect(document.activeElement?.id).toBe('event-venue-name'));

    cleanup();
    signedIn(READER);
    at('/app/events/ev_1');
    expect(await screen.findByText('Venue to be confirmed')).toBeDefined();
    expect(screen.queryByRole('link', { name: 'Add the venue' })).toBeNull();
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

      const answer = await answers[line]?.(body);
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
      "That file isn't a photo we can use. Choose a JPEG, PNG, WebP or HEIC.",
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
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
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

  it('Remove photo brings back the default, says so, and focus goes to Upload a photo', async () => {
    signedIn();
    const sent = serving(PHOTO);
    await editing();

    fireEvent.click(screen.getByRole('button', { name: 'Change photo' }));
    const dialog = await screen.findByRole('dialog', { name: 'Cover photo' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove photo' }));

    expect(await screen.findByText('Photo removed. The default cover is back.')).toBeDefined();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByTestId('cover-default').className).toContain('cover-default-wedding');
    expect(sent.map(({ line }) => line)).toContain('DELETE /api/events/ev_1/cover');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Upload a photo' }));
  });

  it('an upload that fails says so and keeps the previous cover', async () => {
    signedIn();
    const sent = serving(PHOTO, { 'PUT /upload/1': () => new Response(null, { status: 500 }) });
    await editing();

    choose(file());
    const dialog = await screen.findByRole('dialog', { name: 'Cover photo' });

    expect(await within(dialog).findByText("The photo didn't upload. Try again.")).toBeDefined();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Use this photo' }));
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

  it('shows the photo on the event page and in the list, decorative when it has no description', async () => {
    signedIn();
    answering({
      'GET /api/events/ev_1': () =>
        json({ event: event({ cover: { ...PHOTO, description: null } }) }),
      'GET /api/orgs/org_1/events': () =>
        json({ events: [event({ cover: PHOTO }), event({ id: 'ev_2', type: 'gala' })] }),
    });
    at('/app/events/ev_1');
    await screen.findByRole('heading', { level: 1, name: 'Adaeze and Tunde' });

    const page = document.querySelector('.event-page-cover img')!;
    expect(page.getAttribute('alt')).toBe('');
    expect(page.getAttribute('srcset')).toContain('http://store.test/c/large.webp 1920w');
    cleanup();

    at('/app/events');
    const rows = await screen.findAllByRole('listitem');

    expect(within(rows[0]!).getByRole('img').getAttribute('alt')).toBe(PHOTO.description);
    expect(rows[1]!.querySelector('.cover-default-gala')).not.toBeNull();
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
});

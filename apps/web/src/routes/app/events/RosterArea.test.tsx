import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { __setSessionState, type Session } from '../../../session.ts';
import { OWNER_PERMISSIONS, membership } from '../../../test-memberships.ts';
import { routes } from '../../index.tsx';
import { cssRule, mediaBlock, stylesheet } from '../../../test-styles.ts';

const tablesOf = (count: number) =>
  Array.from({ length: count }, (_, n) => ({ id: `t${n + 1}`, name: `T${n + 1}` }));

const ROSTER_CSS = stylesheet(import.meta.dirname, 'roster.css');

const WEB_SRC = join(import.meta.dirname, '../../..');

function sheetsLeadingWithRs(): string[] {
  return readdirSync(WEB_SRC, { recursive: true, encoding: 'utf8' })
    .filter((file) => file.endsWith('.css') && !file.startsWith('demo/'))
    .map((file) => join(WEB_SRC, file))
    .filter((path) => path !== join(import.meta.dirname, 'roster.css'))
    .filter((path) =>
      /\.rs(?![\w])/u.test(readFileSync(path, 'utf8').replaceAll(/\/\*[\s\S]*?\*\//gu, '')),
    )
    .map((path) => relative(WEB_SRC, path));
}

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
  venue: {
    name: 'The Landmark',
    address: {
      formatted: 'Water Corporation Drive, Lagos',
      line1: null,
      line2: null,
      city: 'Lagos',
      region: null,
      postalCode: null,
      countryCode: null,
      latitude: null,
      longitude: null,
    },
  },
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

function problem(code: string, status: number, more: Record<string, unknown> = {}): Response {
  return new Response(
    JSON.stringify({ type: `https://soirely.com/errors/${code}`, title: code, status, ...more }),
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );
}

const NO_STATIONS = { places: [], sections: [], floorLead: null, courses: [], walk: [] };

type Answer = (body: unknown) => Response | Promise<Response>;

function entry(id: string, fullName: string, more: Record<string, unknown> = {}) {
  return {
    id,
    fullName,
    mobile: null,
    email: null,
    job: null,
    station: null,
    stations: [],
    stationRemoved: null,
    leads: false,
    floorLead: false,
    shifts: [],
    link: 'no_mobile',
    linkBy: null,
    linkAt: null,
    contactsErased: false,
    ...more,
  };
}

async function onRoster(
  answers: Record<string, Answer>,
  permissions: string[] = OWNER_PERMISSIONS,
  phase = 'live',
): Promise<{ line: string; body: unknown }[]> {
  const sent: { line: string; body: unknown }[] = [];

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const line = `${init?.method ?? 'GET'} ${new URL(String(input)).pathname}`;
    const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : null;
    sent.push({ line, body });

    const answer = answers[line];
    if (answer != null) return answer(body);
    if (line === 'GET /api/events/ev_1') return json({ event: { ...EVENT, permissions, phase } });

    return json({});
  });
  render(
    <RouterProvider
      router={createMemoryRouter(routes, { initialEntries: ['/app/events/ev_1/staff/roster'] })}
    />,
  );
  await screen.findByRole('heading', { level: 1, name: 'Staff' });

  return sent;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('The Roster on the Staff page (sc-3906)', () => {
  it('ends its crumb row with the one bell at a desk (sc-39509)', async () => {
    signedIn();
    await onRoster({});

    const bell = await screen.findByRole('button', { name: /^Notifications/ });
    expect(bell.closest('.ev-crumb-row')).not.toBeNull();
    expect(screen.getAllByRole('button', { name: /^Notifications/ })).toHaveLength(1);
  });

  it('answers a member without the staff permission as a page that does not exist, under the crumb row and its one bell (sc-39509)', async () => {
    signedIn();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) =>
      new URL(String(input)).pathname === '/api/events/ev_1'
        ? json({ event: { ...EVENT, permissions: ['events.read'], phase: 'live' } })
        : json({}),
    );
    render(
      <RouterProvider
        router={createMemoryRouter(routes, { initialEntries: ['/app/events/ev_1/staff/roster'] })}
      />,
    );

    expect(
      await screen.findByRole('heading', { level: 1, name: 'This page does not exist' }),
    ).toBeDefined();
    const bell = await screen.findByRole('button', { name: /^Notifications/ });
    expect(bell.closest('.ev-crumb-row')).not.toBeNull();
    expect(screen.getAllByRole('button', { name: /^Notifications/ })).toHaveLength(1);
  });

  it('answers an area an event does not have as a page that does not exist, under the crumb row and its one bell (sc-39509)', async () => {
    signedIn();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => json({}));
    render(
      <RouterProvider
        router={createMemoryRouter(routes, { initialEntries: ['/app/events/ev_1/bogus'] })}
      />,
    );

    expect(
      await screen.findByRole('heading', { level: 1, name: 'This page does not exist' }),
    ).toBeDefined();
    const bell = await screen.findByRole('button', { name: /^Notifications/ });
    expect(bell.closest('.ev-crumb-row')).not.toBeNull();
    expect(screen.getAllByRole('button', { name: /^Notifications/ })).toHaveLength(1);
  });

  it('opens from Staff at its own address, its tab marked in the Staff tab row', async () => {
    signedIn();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) =>
      new URL(String(input)).pathname === '/api/events/ev_1'
        ? json({ event: { ...EVENT, permissions: OWNER_PERMISSIONS, phase: 'live' } })
        : json({ staff: [], jobs: [], shifts: [], stations: NO_STATIONS }),
    );
    const router = createMemoryRouter(routes, { initialEntries: ['/app/events/ev_1/staff'] });
    render(<RouterProvider router={router} />);

    expect(await screen.findByText('Nobody on the staff yet')).toBeDefined();
    expect(router.state.location.pathname).toBe('/app/events/ev_1/staff/roster');
    expect(router.state.historyAction).toBe('REPLACE');
    const tabs = screen.getByRole('navigation', { name: 'Staff' });
    expect(tabs.querySelector('[aria-current="page"]')?.textContent).toBe('Roster');
    expect(screen.getByRole('link', { name: 'Jobs and shifts' }).getAttribute('href')).toBe(
      '/app/events/ev_1/staff/jobs',
    );
  });

  it("sits inside the desk's button and field resets, and wraps its card's header when narrow", async () => {
    signedIn();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) =>
      new URL(String(input)).pathname === '/api/events/ev_1'
        ? json({ event: { ...EVENT, permissions: OWNER_PERMISSIONS, phase: 'live' } })
        : json({ staff: [], jobs: [], shifts: [], stations: NO_STATIONS }),
    );
    render(
      <RouterProvider
        router={createMemoryRouter(routes, { initialEntries: ['/app/events/ev_1/staff/roster'] })}
      />,
    );

    const add = await screen.findByRole('button', { name: 'Add a person' });
    expect(add.closest('.desk.ev')).not.toBeNull();
    expect(
      cssRule('.rs .sn-card-names', ROSTER_CSS.slice(ROSTER_CSS.indexOf('(width <= 720px)'))),
    ).toContain('flex-basis: 12rem;');
  });

  it("starts where the event's other pages do at a desk, inside the card's one padding", async () => {
    signedIn();
    await onRoster({
      'GET /api/events/ev_1/staff': () =>
        json({ staff: [], jobs: [], shifts: [], stations: NO_STATIONS }),
    });

    const add = await screen.findByRole('button', { name: 'Add a person' });
    expect(add.closest('.shell-content .ev-page.desk-page')).not.toBeNull();
  });

  it('adds a person by name alone, refusing a blank name beside its field', async () => {
    signedIn();
    const sent = await onRoster({
      'GET /api/events/ev_1/staff': () =>
        json({ staff: [], jobs: [], shifts: [], stations: NO_STATIONS }),
      'POST /api/events/ev_1/staff': () =>
        json({ staff: entry('st_1', 'Chidi Okafor'), member: null }, 201),
    });

    expect(await screen.findByText('Nobody on the staff yet')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Add a person' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    expect(screen.getByText('Enter their name.')).toBeDefined();
    expect(sent.some((one) => one.line === 'POST /api/events/ev_1/staff')).toBe(false);

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: '  Chidi Okafor ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(await screen.findAllByText('Chidi Okafor added to the roster.')).toHaveLength(2);
    expect(sent.find((one) => one.line === 'POST /api/events/ev_1/staff')?.body).toEqual({
      fullName: 'Chidi Okafor',
      mobile: null,
      email: null,
      job: null,
      allowShared: false,
    });
    expect(screen.getByRole('button', { name: 'Chidi Okafor' })).toBeDefined();
    expect(screen.getByText('Add a mobile number to send a link')).toBeDefined();
  });

  it('warns that a number is shared, then adds anyway, and names the member it linked', async () => {
    signedIn();
    const sent = await onRoster({
      'GET /api/events/ev_1/staff': () =>
        json({
          staff: [entry('st_1', 'Amaka Eze', { mobile: '+2348031234567', link: 'none' })],
          jobs: [],
          shifts: [],
          stations: NO_STATIONS,
        }),
      'POST /api/events/ev_1/staff': (body) =>
        (body as { allowShared: boolean }).allowShared
          ? json(
              {
                staff: entry('st_2', 'Bola Ade', { mobile: '+2348031234567', link: 'none' }),
                member: 'Bola Adeyemi',
              },
              201,
            )
          : problem('staff_number_shared', 409, { sharedWith: 'Amaka Eze' }),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Add a person' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Bola Ade' } });
    fireEvent.change(screen.getByLabelText(/^Mobile number/), {
      target: { value: '803 123 4567' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(await screen.findByText('Amaka Eze already uses this number')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Add anyway' }));

    expect(await screen.findByText('Bola Ade added to the roster.')).toBeDefined();
    expect(
      screen.getByText(
        'Bola Adeyemi is a member of Ìrè Events. Their shift will appear in their app.',
      ),
    ).toBeDefined();
    const posts = sent.filter((one) => one.line === 'POST /api/events/ev_1/staff');
    expect(posts.map((one) => (one.body as { allowShared: boolean }).allowShared)).toEqual([
      false,
      true,
    ]);
  });

  it('writes the earliest shift, then how many more, in the Shift column', async () => {
    signedIn();
    await onRoster({
      'GET /api/events/ev_1/staff': () =>
        json({
          staff: [
            entry('st_1', 'Amaka Eze', {
              shifts: [
                {
                  id: 'sh_1',
                  startsAt: '2030-11-14T16:30:00+01:00',
                  endsAt: '2030-11-14T21:00:00+01:00',
                },
                {
                  id: 'sh_2',
                  startsAt: '2030-11-14T22:00:00+01:00',
                  endsAt: '2030-11-15T01:00:00+01:00',
                },
              ],
            }),
          ],
          jobs: [],
          shifts: [],
          stations: NO_STATIONS,
        }),
    });

    await screen.findByRole('button', { name: 'Amaka Eze' });
    const more = document.querySelector('.rs-more');
    expect(more?.textContent).toBe('+1 more');
    expect(more?.parentElement?.textContent).toBe('16:30 to 21:00 +1 more');
  });

  it('keeps a Shift cell with no shift on one line below 720 px only, in the paler grey, beside one with a shift (sc-71607)', async () => {
    signedIn();
    await onRoster({
      'GET /api/events/ev_1/staff': () =>
        json({
          staff: [
            entry('st_1', 'Amaka Eze', {
              shifts: [
                {
                  id: 'sh_1',
                  startsAt: '2030-11-14T16:30:00+01:00',
                  endsAt: '2030-11-14T21:00:00+01:00',
                },
              ],
            }),
            entry('st_2', 'Bayo Ade'),
          ],
          jobs: [],
          shifts: [],
          stations: NO_STATIONS,
        }),
    });

    await screen.findByRole('button', { name: 'Bayo Ade' });
    const cells = within(screen.getByRole('table', { name: 'Roster' }))
      .getAllByRole('row')
      .slice(1)
      .map((row) => row.querySelectorAll('td')[2] as HTMLElement);
    expect(cells.map((cell) => [cell.textContent, [...cell.classList]])).toEqual([
      ['16:30 to 21:00', ['rs-shift']],
      ['Not on a shift yet', ['rs-no-shift', 'rs-quiet']],
    ]);
    expect(cssRule('.rs-table td.rs-shift', ROSTER_CSS)).toContain('white-space: nowrap;');
    const narrow = mediaBlock('(width <= 720px)', ROSTER_CSS);
    expect(ROSTER_CSS.replace(narrow, '')).not.toContain('rs-no-shift');
    expect(cssRule('.rs-frame > .rs-table td.rs-no-shift', narrow)).toContain(
      'white-space: nowrap;',
    );
    expect(cssRule('.rs-table tbody td.rs-quiet', ROSTER_CSS)).toContain(
      'color: var(--colorInkSecondary);',
    );
  });

  it.each([
    ['with Add', OWNER_PERMISSIONS],
    ['without Add', OWNER_PERMISSIONS.filter((one) => one !== 'staff.manage')],
  ])(
    'lets the keyboard reach the table frame, the one region named Roster, just before the first name, %s (sc-70540)',
    async (_, permissions) => {
      signedIn();
      await onRoster(
        {
          'GET /api/events/ev_1/staff': () =>
            json({
              staff: [entry('st_1', 'Amaka Eze')],
              jobs: [],
              shifts: [],
              stations: NO_STATIONS,
            }),
        },
        permissions,
      );

      const first = await screen.findByRole('button', { name: 'Amaka Eze' });
      const frame = screen.getByRole('region', { name: 'Roster' });
      expect(frame.tabIndex).toBe(0);
      expect(frame.classList.contains('rs-frame')).toBe(true);
      expect(frame.contains(screen.getByRole('table', { name: 'Roster' }))).toBe(true);
      expect(screen.getByRole('heading', { level: 2, name: 'Roster' }).tabIndex).toBe(-1);
      const reachable = [...document.querySelectorAll<HTMLElement>('button, [tabindex="0"]')];
      expect(reachable[reachable.indexOf(frame) + 1]).toBe(first);
      if (permissions === OWNER_PERMISSIONS) {
        expect(reachable[reachable.indexOf(frame) - 1]).toBe(
          screen.getByRole('button', { name: 'Add a person' }),
        );
      }
    },
  );

  it("draws the Coverage frame's focus ring on the Roster frame (sc-70540)", () => {
    const ring = cssRule('.rs-frame:focus-visible', ROSTER_CSS);
    expect(ring).toContain('outline: 2px solid var(--colorAccent);');
    expect(ring).toContain('outline-offset: 2px;');
  });

  it('keeps whole words in the Roster table below 720 px, the frame scrolling instead (sc-70540)', () => {
    const narrow = ROSTER_CSS.slice(ROSTER_CSS.indexOf('(width <= 720px)'));
    expect(
      cssRule('.rs-frame > .rs-table :is(th, td),\n  .rs-frame > .rs-table :is(th, td) *', narrow),
    ).toContain('overflow-wrap: normal;');
    expect(
      cssRule(
        '.rs-frame > .rs-table thead th:nth-child(2),\n  .rs-frame > .rs-table thead th:nth-child(3)',
        narrow,
      ),
    ).toContain('min-width: 128px;');
    expect(cssRule('.rs-frame > .rs-table thead th:nth-child(5)', narrow)).toContain(
      'min-width: 168px;',
    );
  });

  it('removes a person after asking', async () => {
    signedIn();
    const sent = await onRoster({
      'GET /api/events/ev_1/staff': () =>
        json({ staff: [entry('st_1', 'Amaka Eze')], jobs: [], shifts: [], stations: NO_STATIONS }),
      'DELETE /api/events/ev_1/staff/st_1': () => new Response(null, { status: 204 }),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Amaka Eze' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove from the event' }));
    expect(screen.getByRole('heading', { name: 'Remove Amaka Eze from the event?' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Remove from the event' }));

    await waitFor(() =>
      expect(sent.some((one) => one.line === 'DELETE /api/events/ev_1/staff/st_1')).toBe(true),
    );
    expect(await screen.findByText('Nobody on the staff yet')).toBeDefined();
  });

  it('keeps everyone once the event has finished: no Remove, but Edit stays', async () => {
    signedIn();
    await onRoster(
      {
        'GET /api/events/ev_1/staff': () =>
          json({
            staff: [entry('st_1', 'Amaka Eze')],
            jobs: [],
            shifts: [],
            stations: NO_STATIONS,
          }),
      },
      OWNER_PERMISSIONS,
      'finished',
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Amaka Eze' }));
    expect(screen.queryByRole('button', { name: 'Remove from the event' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeDefined();
  });

  it('shows the roster read-only without permission to manage staff', async () => {
    signedIn();
    await onRoster(
      {
        'GET /api/events/ev_1/staff': () =>
          json({
            staff: [entry('st_1', 'Amaka Eze')],
            jobs: [],
            shifts: [],
            stations: NO_STATIONS,
          }),
      },
      OWNER_PERMISSIONS.filter((one) => one !== 'staff.manage'),
    );

    expect(
      await screen.findByText(
        'You can see the roster. Changing it needs permission to manage staff.',
      ),
    ).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Add a person' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Amaka Eze' }));
    expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
  });

  it("owns the rs- classes: no other product stylesheet leads with one, so the roster's names keep their ink", () => {
    expect(sheetsLeadingWithRs()).toEqual([]);
  });

  it('writes each station in the Station column, a section by its plain name and a lead in words (sc-3910)', async () => {
    signedIn();
    const grill = { id: 'grill', name: 'Grill', kind: 'place', tables: [] };
    const sectionA = { id: 'sa', name: 'Section A', kind: 'section', tables: tablesOf(6) };
    await onRoster({
      'GET /api/events/ev_1/staff': () =>
        json({
          staff: [
            entry('st_1', 'Tayo Bamidele', { station: grill, stations: [grill], leads: true }),
            entry('st_2', 'Grace Udo', { station: sectionA, stations: [sectionA] }),
            entry('st_3', 'Emeka Obi'),
            entry('st_4', 'Kunle Ajayi', { stationRemoved: 'Section D' }),
          ],
          jobs: [],
          shifts: [],
          stations: NO_STATIONS,
        }),
    });

    const rows = (await screen.findByRole('table')).querySelectorAll('tbody tr');
    expect(rows[0]?.querySelectorAll('td')[1]?.textContent).toBe('Grill Lead');
    expect(rows[1]?.querySelectorAll('td')[1]?.textContent).toBe('Section A');
    expect(rows[2]?.querySelectorAll('td')[1]?.textContent).toBe('No station yet');
    const gone = rows[3]?.querySelectorAll('td')[1] as HTMLElement;
    expect(within(gone).getByText('No station')).toBeTruthy();
    expect(within(gone).getByText('Section D was removed from the seating plan.')).toBeTruthy();
    expect(gone.querySelector('.rs-gone-why svg')).not.toBeNull();
  });

  it("says in the details that a person's section was removed from the seating plan (sc-3910)", async () => {
    signedIn();
    await onRoster({
      'GET /api/events/ev_1/staff': () =>
        json({
          staff: [entry('st_1', 'Grace Udo', { stationRemoved: 'Section D' })],
          jobs: [],
          shifts: [],
          stations: NO_STATIONS,
        }),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Grace Udo' }));
    const select = screen.getByRole('combobox', { name: 'Change station, Grace Udo' });
    expect(select.parentElement?.querySelector('[aria-hidden]')?.textContent).toBe('No station');
    expect(select.getAttribute('aria-describedby')).toBe('rs-gone');
    expect(document.getElementById('rs-gone')?.textContent).toBe(
      'Section D was removed from the seating plan.',
    );
  });

  it("changes a person's station from their details, places then sections (sc-3910)", async () => {
    signedIn();
    const sectionB = { id: 'sb', name: 'Section B', kind: 'section', tables: tablesOf(1) };
    const stations = {
      ...NO_STATIONS,
      places: [
        { id: 'pass', name: 'Pass', pass: true, people: [], lead: null, dishes: 0 },
        { id: 'bar', name: 'Bar', pass: false, people: [], lead: null, dishes: 0 },
      ],
      sections: [{ id: 'sb', name: 'Section B', tables: tablesOf(1), people: [], lead: null }],
    };
    const sent = await onRoster({
      'GET /api/events/ev_1/staff': () =>
        json({ staff: [entry('st_1', 'Funmi Bakare')], jobs: [], shifts: [], stations }),
      'PUT /api/events/ev_1/stations/people/st_1': () =>
        json({
          staff: [entry('st_1', 'Funmi Bakare', { station: sectionB, stations: [sectionB] })],
          jobs: [],
          shifts: [],
          stations: {
            ...stations,
            sections: [{ ...stations.sections[0], people: ['st_1'] }],
          },
        }),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Funmi Bakare' }));
    const select = screen.getByRole('combobox', { name: 'Change station, Funmi Bakare' });
    expect([...select.querySelectorAll('option')].map((one) => one.textContent)).toEqual([
      'No station yet',
      'Pass',
      'Bar',
      'Section B',
    ]);
    expect(
      [...select.querySelectorAll('optgroup')].map((group) => [
        group.label,
        [...group.querySelectorAll('option')].map((one) => one.textContent),
      ]),
    ).toEqual([
      ['Places', ['Pass', 'Bar']],
      ['Seating sections', ['Section B']],
    ]);
    fireEvent.change(select, { target: { value: 'sb' } });

    expect(await screen.findAllByText('Funmi Bakare is on Section B.')).not.toHaveLength(0);
    expect(
      sent.find((one) => one.line === 'PUT /api/events/ev_1/stations/people/st_1')?.body,
    ).toEqual({ station: 'sb' });
  });

  it('shows the station as words, with no select, without permission to manage staff (sc-3910)', async () => {
    signedIn();
    const bar = { id: 'bar', name: 'Bar', kind: 'place', tables: [] };
    await onRoster(
      {
        'GET /api/events/ev_1/staff': () =>
          json({
            staff: [entry('st_1', 'Sade Lawal', { station: bar, stations: [bar] })],
            jobs: [],
            shifts: [],
            stations: NO_STATIONS,
          }),
      },
      OWNER_PERMISSIONS.filter((one) => one !== 'staff.manage'),
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Sade Lawal' }));
    expect(screen.queryByRole('combobox', { name: 'Change station, Sade Lawal' })).toBeNull();
    expect(document.querySelector('.rs-facts')?.textContent).toContain('StationBar');
  });
});

describe('Each person’s own link on the Roster (sc-3912)', () => {
  const URL_ISSUED = 'https://soirely.com/w/7Gk2pQ9xVb4mT1sR8nLw3c';
  const AMAKA = { mobile: '+2348031234567' };
  const COPIED = {
    ...AMAKA,
    link: 'copied',
    linkBy: 'Folake Adeyemi',
    linkAt: '2030-11-14T19:12:00+01:00',
  };
  const SENT = {
    ...AMAKA,
    link: 'sent',
    linkBy: 'Tobi Ade',
    linkAt: '2030-11-14T18:44:00+01:00',
  };

  function clipboard(writeText: () => Promise<void>): ReturnType<typeof vi.fn> {
    const spy = vi.fn(writeText);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: spy },
      configurable: true,
    });

    return spy;
  }

  function plan(more: Record<string, unknown>) {
    return () =>
      json({
        staff: [entry('st_1', 'Amaka Eze', more)],
        jobs: [],
        shifts: [],
        stations: NO_STATIONS,
      });
  }

  function row(): HTMLElement {
    const name = screen.getByRole('button', { name: 'Amaka Eze' });
    const tr = name.closest('tr');
    if (tr == null) throw new Error('No row for Amaka Eze');

    return tr;
  }

  afterEach(() => {
    Reflect.deleteProperty(navigator, 'clipboard');
  });

  it('copies a link on a row reading No link yet, then says who copied it and offers Mark as sent', async () => {
    signedIn();
    const writeText = clipboard(() => Promise.resolve());
    const sent = await onRoster({
      'GET /api/events/ev_1/staff': plan({ ...AMAKA, link: 'none' }),
      'POST /api/events/ev_1/staff/st_1/link': () =>
        json({ url: URL_ISSUED, staff: entry('st_1', 'Amaka Eze', COPIED) }),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Copy link: Amaka Eze' }));

    expect(await within(row()).findByText('Copied')).toBeDefined();
    expect(writeText).toHaveBeenCalledWith(URL_ISSUED);
    expect(sent.find((one) => one.line === 'POST /api/events/ev_1/staff/st_1/link')?.body).toEqual({
      via: 'copy',
    });
    expect(
      within(row()).getByText('Copied by Folake Adeyemi · 19:12 · not marked as sent'),
    ).toBeDefined();
    expect(within(row()).getByRole('button', { name: 'Mark as sent: Amaka Eze' })).toBeDefined();
    expect(screen.getAllByRole('status').some((one) => one.textContent === 'Link copied.')).toBe(
      true,
    );
  });

  it('marks a copied link as sent', async () => {
    signedIn();
    const sent = await onRoster({
      'GET /api/events/ev_1/staff': plan(COPIED),
      'POST /api/events/ev_1/staff/st_1/link/sent': () =>
        json({ staff: entry('st_1', 'Amaka Eze', { ...SENT, linkBy: 'Folake Adeyemi' }) }),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Mark as sent: Amaka Eze' }));

    expect(await within(row()).findByText('Link sent')).toBeDefined();
    expect(sent.some((one) => one.line === 'POST /api/events/ev_1/staff/st_1/link/sent')).toBe(
      true,
    );
    expect(within(row()).queryByRole('button', { name: 'Mark as sent: Amaka Eze' })).toBeNull();
  });

  it('leaves a row reading Link sent as it was after another copy, with no Mark as sent', async () => {
    signedIn();
    clipboard(() => Promise.resolve());
    await onRoster({
      'GET /api/events/ev_1/staff': plan(SENT),
      'POST /api/events/ev_1/staff/st_1/link': () =>
        json({ url: URL_ISSUED, staff: entry('st_1', 'Amaka Eze', SENT) }),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Copy link: Amaka Eze' }));

    await waitFor(() =>
      expect(screen.getAllByRole('status').some((one) => one.textContent === 'Link copied.')).toBe(
        true,
      ),
    );
    expect(within(row()).getByText('Link sent')).toBeDefined();
    expect(within(row()).getByText('Marked as sent by Tobi Ade · 18:44')).toBeDefined();
    expect(within(row()).queryByRole('button', { name: 'Mark as sent: Amaka Eze' })).toBeNull();
  });

  it('shows the link to copy by hand when the browser refuses the clipboard, and still records the copy', async () => {
    signedIn();
    clipboard(() => Promise.reject(new Error('NotAllowedError')));
    await onRoster({
      'GET /api/events/ev_1/staff': plan({ ...AMAKA, link: 'none' }),
      'POST /api/events/ev_1/staff/st_1/link': () =>
        json({ url: URL_ISSUED, staff: entry('st_1', 'Amaka Eze', COPIED) }),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Copy link: Amaka Eze' }));

    const field = await screen.findByRole<HTMLInputElement>('textbox', {
      name: 'Link for Amaka Eze',
    });
    expect(field.value).toBe(URL_ISSUED);
    expect(field.readOnly).toBe(true);
    expect(within(row()).getByText('Copied')).toBeDefined();
    expect(
      screen
        .getAllByRole('status')
        .some(
          (one) => one.textContent === 'The link could not be copied. Copy it from the link field.',
        ),
    ).toBe(true);
    await waitFor(() => expect(document.activeElement).toBe(field));
  });

  it('copies nothing and keeps the status when no link can be issued', async () => {
    signedIn();
    const writeText = clipboard(() => Promise.resolve());
    await onRoster({
      'GET /api/events/ev_1/staff': plan({ ...AMAKA, link: 'none' }),
      'POST /api/events/ev_1/staff/st_1/link': () => problem('internal', 503),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Copy link: Amaka Eze' }));

    expect(
      await within(row()).findByText('That did not work. Try again in a moment.'),
    ).toBeDefined();
    expect(within(row()).getByText('No link yet')).toBeDefined();
    expect(writeText).not.toHaveBeenCalled();
  });

  it('offers no Copy link to a person with no mobile number', async () => {
    signedIn();
    await onRoster({ 'GET /api/events/ev_1/staff': plan({}) });

    expect(await within(row()).findByText('Add a mobile number to send a link')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Copy link: Amaka Eze' })).toBeNull();
  });

  it('replaces a link after asking, Keep this link first, and the row reads No link yet', async () => {
    signedIn();
    const sent = await onRoster({
      'GET /api/events/ev_1/staff': plan(SENT),
      'POST /api/events/ev_1/staff/st_1/link/replace': () =>
        json({ staff: entry('st_1', 'Amaka Eze', { ...AMAKA, link: 'none' }) }),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Amaka Eze' }));
    fireEvent.click(screen.getByRole('button', { name: 'Replace link…' }));

    const dialog = screen.getByRole('alertdialog', { name: 'Replace Amaka’s link?' });
    expect(within(dialog).getByText('Their current link stops working now.')).toBeDefined();
    const [keep, replace] = within(dialog).getAllByRole('button');
    expect(keep?.textContent).toBe('Keep this link');
    expect(replace?.textContent).toBe('Replace link');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Replace link' }));

    await waitFor(() =>
      expect(sent.some((one) => one.line === 'POST /api/events/ev_1/staff/st_1/link/replace')).toBe(
        true,
      ),
    );
    expect(await within(row()).findByText('No link yet')).toBeDefined();
    expect(
      screen.getAllByText('Amaka Eze’s link is replaced. Copy link gives them a new one to send.'),
    ).not.toHaveLength(0);
  });

  it('keeps the link when Keep this link is chosen, and returns focus to Replace link…', async () => {
    signedIn();
    const sent = await onRoster({ 'GET /api/events/ev_1/staff': plan(SENT) });

    fireEvent.click(await screen.findByRole('button', { name: 'Amaka Eze' }));
    const opener = screen.getByRole('button', { name: 'Replace link…' });
    fireEvent.click(opener);
    fireEvent.click(screen.getByRole('button', { name: 'Keep this link' }));

    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(sent.some((one) => one.line.endsWith('/link/replace'))).toBe(false);
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });
});

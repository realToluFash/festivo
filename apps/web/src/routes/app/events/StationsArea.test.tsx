import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { serverClock } from '@soirely/domain';

import { __setSessionState, type Session } from '../../../session.ts';
import { OWNER_PERMISSIONS, membership } from '../../../test-memberships.ts';
import { routes } from '../../index.tsx';

const tablesOf = (count: number) =>
  Array.from({ length: count }, (_, n) => ({ id: `t${n + 1}`, name: `T${n + 1}` }));

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

type Answer = (body: unknown) => Response | Promise<Response>;

type Ref = {
  id: string;
  name: string;
  kind: 'place' | 'section';
  tables: { id: string; name: string }[];
};

const place = (id: string, name: string): Ref => ({ id, name, kind: 'place', tables: [] });
const section = (id: string, name: string, tables: number): Ref => ({
  id,
  name,
  kind: 'section',
  tables: tablesOf(tables),
});

function person(id: string, fullName: string, at: Ref | null, more: Record<string, unknown> = {}) {
  return {
    id,
    fullName,
    mobile: null,
    email: null,
    job: null,
    station: at,
    stations: at == null ? [] : [at],
    stationRemoved: null,
    leads: false,
    floorLead: false,
    shifts: [],
    link: 'no_mobile',
    contactsErased: false,
    ...more,
  };
}

const PASS = place('pass', 'Pass');
const BAR = place('bar', 'Bar');
const GRILL = place('grill', 'Grill');
const FLOOR = place('floor', 'Floor');
const SECTION_A = section('sa', 'Section A', 6);

const STAFF = [
  person('ifeoma', 'Ifeoma Nduka', FLOOR, { floorLead: true }),
  person('ronke', 'Ronke Alade', PASS, { leads: true }),
  person('tayo', 'Tayo Bamidele', GRILL, { leads: true }),
  person('gbenga', 'Gbenga Salami', GRILL),
  person('sade', 'Sade Lawal', BAR, { leads: true }),
  person('bola', 'Bola Ajayi', BAR),
  person('grace', 'Grace Udo', SECTION_A, { leads: true }),
  person('emeka', 'Emeka Obi', null),
];

const STATIONS = {
  places: [
    { id: 'pass', name: 'Pass', pass: true, people: ['ronke'], lead: 'ronke', dishes: 1 },
    { id: 'bar', name: 'Bar', pass: false, people: ['sade', 'bola'], lead: 'sade', dishes: 0 },
    { id: 'kitchen', name: 'Kitchen', pass: false, people: [], lead: null, dishes: 1 },
    { id: 'stage', name: 'Stage', pass: false, people: [], lead: null, dishes: 0 },
    { id: 'floor', name: 'Floor', pass: false, people: ['ifeoma'], lead: null, dishes: 0 },
    {
      id: 'grill',
      name: 'Grill',
      pass: false,
      people: ['tayo', 'gbenga'],
      lead: 'tayo',
      dishes: 2,
    },
    { id: 'pastry', name: 'Pastry', pass: false, people: [], lead: null, dishes: 1 },
  ],
  sections: [
    { id: 'sa', name: 'Section A', tables: tablesOf(6), people: ['grace'], lead: 'grace' },
    { id: 'sb', name: 'Section B', tables: tablesOf(1), people: [], lead: null },
    { id: 'sc', name: 'Section C', tables: tablesOf(0), people: [], lead: null },
  ],
  floorLead: 'ifeoma',
  courses: [
    { id: 'c1', name: 'Starter', items: [{ name: 'Canapé selection', dishedAt: 'kitchen' }] },
    {
      id: 'c2',
      name: 'Main',
      items: [
        { name: 'Rice', dishedAt: 'pass' },
        { name: 'Chicken', dishedAt: 'grill' },
        { name: 'Croaker', dishedAt: 'grill' },
      ],
    },
    { id: 'c3', name: 'Dessert', items: [{ name: 'Ice cream', dishedAt: 'pastry' }] },
  ],
  walk: ['kitchen', 'grill', 'pastry'],
};

const PLAN = { staff: STAFF, jobs: [], shifts: [], stations: STATIONS };

async function onStations(
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
    if (line === 'GET /api/events/ev_1')
      return json({ event: { ...EVENT, permissions, phase: 'live' } });
    if (line === 'GET /api/events/ev_1/staff') return json(PLAN);

    return json({});
  });
  render(
    <RouterProvider
      router={createMemoryRouter(routes, { initialEntries: ['/app/events/ev_1/staff/stations'] })}
    />,
  );
  await screen.findByRole('heading', { level: 2, name: 'Places' });

  return sent;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('Stations on the Staff page (sc-3910)', () => {
  it('marks its own tab, third in the Staff tab row', async () => {
    signedIn();
    await onStations({});

    const tabs = screen.getByRole('navigation', { name: 'Staff' });
    expect([...tabs.children].map((one) => one.textContent)).toEqual([
      'Roster',
      'Jobs and shifts',
      'Stations',
    ]);
    expect(tabs.querySelector('[aria-current="page"]')?.textContent).toBe('Stations');
  });

  it('lists the places Pass first, the sections with their tables, and what each place dishes', async () => {
    signedIn();
    await onStations({});

    expect(screen.getByText('Ifeoma Nduka', { selector: '.sn-floor-name' })).toBeDefined();
    const places = screen.getByRole('heading', { level: 2, name: 'Places' }).closest('section');
    const names = [...(places?.querySelectorAll('h3') ?? [])].map((one) => one.textContent);
    expect(names).toEqual(['PassFixed', 'Bar', 'Kitchen', 'Stage', 'Floor', 'Grill', 'Pastry']);
    expect(screen.getByText('2 people · Dishes 2 items')).toBeDefined();
    expect(screen.getByText('Nobody on Stage')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Rename Pass' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Rename Grill' })).toBeDefined();

    const sections = screen
      .getByRole('heading', { level: 2, name: 'Seating sections' })
      .closest('section');
    expect([...(sections?.querySelectorAll('h3') ?? [])].map((one) => one.textContent)).toEqual([
      'Section A · 6 tables',
      'Section B · 1 table',
      'Section C · No tables yet',
    ]);
    expect(screen.queryByRole('button', { name: /^Rename Section/ })).toBeNull();

    expect(screen.getByText('Course 2')).toBeDefined();
    const chicken = screen.getByRole('combobox', { name: 'Dished at, Chicken, Main' });
    expect((chicken as HTMLSelectElement).value).toBe('grill');
    expect([...chicken.querySelectorAll('option')].map((one) => one.textContent)).toEqual([
      'Pass',
      'Bar',
      'Kitchen',
      'Stage',
      'Floor',
      'Grill',
      'Pastry',
    ]);
    expect(screen.getByText('Chicken').getAttribute('translate')).toBe('no');

    expect(
      screen.getByText('1 person on tonight’s roster has no station: Emeka Obi.'),
    ).toBeDefined();
  });

  it('walks from the Pass, with no Move up on the first stop and no Move down on the last', async () => {
    signedIn();
    await onStations({});

    const walk = screen.getByRole('list', { name: 'Walking order' });
    const stops = [...walk.querySelectorAll('.sn-stop-name')].map((one) => one.textContent);
    expect(stops).toEqual(['Pass', 'Kitchen', 'Grill', 'Pastry']);
    expect(walk.textContent).toContain('Every tray starts here');
    expect(screen.queryByRole('button', { name: 'Move up, Kitchen' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Move down, Kitchen' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Move down, Pastry' })).toBeNull();
  });

  it('moves a stop up, says where it went, and keeps focus on the moved stop', async () => {
    signedIn();
    const sent = await onStations({
      'PUT /api/events/ev_1/stations/walking-order': (body) =>
        json({
          ...PLAN,
          stations: { ...STATIONS, walk: (body as { order: string[] }).order },
        }),
    });

    fireEvent.click(screen.getByRole('button', { name: 'Move up, Grill' }));

    expect(await screen.findByText('Grill moved to stop 2 of 4')).toBeDefined();
    expect(
      sent.find((one) => one.line === 'PUT /api/events/ev_1/stations/walking-order')?.body,
    ).toEqual({ order: ['grill', 'kitchen', 'pastry'] });
    await waitFor(() => expect(document.activeElement?.id).toBe('sn-down-grill'));
  });

  it('gives an item another place and says so', async () => {
    signedIn();
    const sent = await onStations({
      'PUT /api/events/ev_1/stations/courses/c2/dished-at': () =>
        json({
          ...PLAN,
          stations: {
            ...STATIONS,
            courses: STATIONS.courses.map((one) =>
              one.id === 'c2'
                ? {
                    ...one,
                    items: one.items.map((item) =>
                      item.name === 'Rice' ? { ...item, dishedAt: 'grill' } : item,
                    ),
                  }
                : one,
            ),
          },
        }),
    });

    fireEvent.change(screen.getByRole('combobox', { name: 'Dished at, Rice, Main' }), {
      target: { value: 'grill' },
    });

    expect(await screen.findByText('Rice is dished at Grill.')).toBeDefined();
    expect(
      sent.find((one) => one.line === 'PUT /api/events/ev_1/stations/courses/c2/dished-at')?.body,
    ).toEqual({ item: 'Rice', place: 'grill' });
  });

  it('asks before removing a place, naming only what goes with it', async () => {
    signedIn();
    const sent = await onStations({
      'DELETE /api/events/ev_1/stations/places/stage': () =>
        json({
          ...PLAN,
          stations: {
            ...STATIONS,
            places: STATIONS.places.filter((one) => one.id !== 'stage'),
          },
        }),
    });

    const asks: [string, string][] = [
      ['Grill', 'Remove Grill? 2 people lose their station, and its 2 items go to the Pass.'],
      ['Bar', 'Remove Bar? 2 people lose their station.'],
      ['Pastry', 'Remove Pastry? Its 1 item goes to the Pass.'],
      ['Stage', 'Remove Stage?'],
    ];
    for (const [name, words] of asks) {
      fireEvent.click(screen.getByRole('button', { name: `Remove ${name}…` }));
      expect(screen.getByText(words)).toBeDefined();
      expect(screen.getByRole('button', { name: `Remove ${name}` })).toBeDefined();
      if (name !== 'Stage') fireEvent.click(screen.getByRole('button', { name: 'Keep it' }));
    }
    expect(sent.some((one) => one.line.startsWith('DELETE'))).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Remove Stage' }));

    expect(await screen.findByText('Stage removed.')).toBeDefined();
    expect(screen.queryByText('Nobody on Stage')).toBeNull();
  });

  it('shows who is on shift at each station now during the event, and not while planning', async () => {
    const shift = (startsAt: string, endsAt: string) => ({ id: startsAt, startsAt, endsAt });
    const staff = STAFF.map((one) =>
      one.id === 'tayo'
        ? { ...one, shifts: [shift('2030-11-14T16:00:00+01:00', '2030-11-15T01:00:00+01:00')] }
        : one.id === 'gbenga'
          ? { ...one, shifts: [shift('2030-11-14T16:00:00+01:00', '2030-11-14T21:00:00+01:00')] }
          : one.id === 'sade'
            ? { ...one, shifts: [shift('2030-11-14T22:00:00+01:00', '2030-11-15T02:00:00+01:00')] }
            : one,
    );
    const now = new Date('2030-11-14T21:30:00+01:00');
    vi.useFakeTimers({ shouldAdvanceTime: true, toFake: ['Date'] });
    vi.setSystemTime(now);
    serverClock.observe(now.toUTCString());
    signedIn();
    await onStations({ 'GET /api/events/ev_1/staff': () => json({ ...PLAN, staff }) });

    const card = screen.getByRole('region', { name: 'Stations tonight' });
    expect(card.textContent).toContain('Who is on shift at each station now, 21:30.');
    const grill = screen.getByRole('list', { name: 'On Grill now' });
    expect(grill.textContent).toBe('Tayo Bamidele16:00 to 01:00Lead');
    expect(card.textContent).toContain('Nobody on Bar');
    expect(card.textContent).not.toContain('Gbenga Salami');
    expect(card.textContent).not.toContain('Sade Lawal');
    expect(screen.queryByRole('list', { name: 'On Bar now' })).toBeNull();
  });

  it('has no Stations tonight card while planning', async () => {
    signedIn();
    await onStations({});

    expect(screen.queryByRole('region', { name: 'Stations tonight' })).toBeNull();
  });

  it('asks in one sentence when one person and an item go with a place', async () => {
    signedIn();
    const places = STATIONS.places.map((one) =>
      one.id === 'kitchen' ? { ...one, people: ['emeka'] } : one,
    );
    await onStations({
      'GET /api/events/ev_1/staff': () => json({ ...PLAN, stations: { ...STATIONS, places } }),
    });

    fireEvent.click(screen.getByRole('button', { name: 'Remove Kitchen…' }));

    expect(
      screen.getByText(
        'Remove Kitchen? 1 person loses their station, and its 1 item goes to the Pass.',
      ),
    ).toBeDefined();
  });

  it("refuses a blank name, a place's name and a section's name before sending, then adds the place", async () => {
    signedIn();
    const sent = await onStations({
      'POST /api/events/ev_1/stations/places': () =>
        json(
          {
            ...PLAN,
            stations: {
              ...STATIONS,
              places: [
                ...STATIONS.places,
                { id: 'terrace', name: 'Terrace', pass: false, people: [], lead: null, dishes: 0 },
              ],
            },
          },
          201,
        ),
    });

    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add place' }));
    expect(screen.getByText('Enter a name for the station.')).toBeDefined();

    const name = screen.getByLabelText('Name');
    fireEvent.change(name, { target: { value: 'bar' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add place' }));
    expect(screen.getByText('This event already has a place called Bar.')).toBeDefined();

    fireEvent.change(name, { target: { value: 'section a' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add place' }));
    expect(
      screen.getByText(
        'Section A is a seating section on this event. Give the place another name.',
      ),
    ).toBeDefined();
    expect(sent.some((one) => one.line === 'POST /api/events/ev_1/stations/places')).toBe(false);

    fireEvent.change(name, { target: { value: ' Terrace ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add place' }));

    expect(await screen.findByText('Terrace added. Nobody is on it yet.')).toBeDefined();
    expect(sent.find((one) => one.line === 'POST /api/events/ev_1/stations/places')?.body).toEqual({
      name: 'Terrace',
    });
  });

  it('puts someone with no station on a place from its People and lead panel', async () => {
    signedIn();
    const sent = await onStations({
      'PUT /api/events/ev_1/stations/people/emeka': () => json(PLAN),
    });

    fireEvent.click(screen.getByRole('button', { name: 'People and lead for Grill' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Grill' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Take Tayo Bamidele off Grill' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Move Sade Lawal from Bar to Grill' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Put Emeka Obi on Grill' }));

    expect(await screen.findByText('Emeka Obi is on Grill.')).toBeDefined();
    expect(
      sent.find((one) => one.line === 'PUT /api/events/ev_1/stations/people/emeka')?.body,
    ).toEqual({ station: 'grill' });
  });

  it('says when a section was removed from the seating plan, naming who was on it', async () => {
    signedIn();
    await onStations({
      'GET /api/events/ev_1/staff': () =>
        json({
          ...PLAN,
          staff: [
            ...STAFF.filter((one) => one.id !== 'emeka'),
            person('emeka', 'Emeka Obi', null, { stationRemoved: 'Section D' }),
            person('chidi', 'Chidi Okafor', null, { stationRemoved: 'Section D' }),
          ],
        }),
    });

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('Section D was removed from the seating plan.');
    expect(alert.textContent).toContain('Emeka Obi and Chidi Okafor were on it');
    fireEvent.click(screen.getByRole('button', { name: 'Got it' }));
    expect(screen.queryByText('Section D was removed from the seating plan.')).toBeNull();
  });

  it('shows everything as words without permission to manage staff', async () => {
    signedIn();
    await onStations(
      {},
      OWNER_PERMISSIONS.filter((one) => one !== 'staff.manage'),
    );

    expect(
      screen.getAllByText('You can see stations. Changing them needs permission to manage staff.'),
    ).toHaveLength(2);
    expect(screen.queryByRole('button', { name: 'Add a place' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^People and lead/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Move / })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Change' })).toBeNull();
    expect(screen.queryByRole('combobox')).toBeNull();
    const chicken = screen.getByText('Chicken').closest('li');
    expect(chicken?.textContent).toBe('ChickenDished atGrill');
  });
});

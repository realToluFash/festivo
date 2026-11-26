import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { __setSessionState, type Session } from '../../../session.ts';
import { OWNER_PERMISSIONS, membership } from '../../../test-memberships.ts';
import { routes } from '../../index.tsx';
import { cssRule, stylesheet } from '../../../test-styles.ts';

const JOBS_CSS = stylesheet(import.meta.dirname, 'jobsShifts.css');

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

type Answer = (body: unknown) => Response | Promise<Response>;

const JOBS = [
  { id: 'j_bar', name: 'Bar', access: 'view' },
  { id: 'j_door', name: 'Door', access: 'check_in' },
  { id: 'j_mc', name: 'MC', access: 'view' },
];

function person(id: string, fullName: string, job: string | null, shifts: string[][] = []) {
  return {
    id,
    fullName,
    mobile: null,
    email: null,
    job: job == null ? null : { id: job, name: JOBS.find((one) => one.id === job)?.name ?? '' },
    station: null,
    stations: [],
    stationRemoved: null,
    leads: false,
    floorLead: false,
    shifts: shifts.map(([sid, startsAt, endsAt]) => ({ id: sid, startsAt, endsAt })),
    link: 'no_mobile',
    linkBy: null,
    linkAt: null,
    briefing: 'none',
    briefingCopy: null,
    contactsErased: false,
  };
}

const NO_STATIONS = { places: [], sections: [], floorLead: null, courses: [], walk: [] };

const PLAN = {
  staff: [
    person('st_sade', 'Sade Lawal', 'j_bar', [
      ['sh_bar', '2030-11-14T16:00:00+01:00', '2030-11-15T01:00:00+01:00'],
    ]),
    person('st_tolu', 'Tolu Bello', 'j_door'),
    person('st_ada', 'Ada Nnaji', null),
  ],
  jobs: JOBS,
  stations: NO_STATIONS,
  rules: null,
  shifts: [
    {
      id: 'sh_bar',
      job: 'j_bar',
      startsAt: '2030-11-14T16:00:00+01:00',
      endsAt: '2030-11-15T01:00:00+01:00',
      needed: 2,
      people: ['st_sade'],
    },
    {
      id: 'sh_mc',
      job: 'j_mc',
      startsAt: '2030-11-14T19:00:00+01:00',
      endsAt: '2030-11-14T20:00:00+01:00',
      needed: 1,
      people: ['st_ada'],
    },
  ],
};

async function onJobs(
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
    if (line === 'GET /api/events/ev_1/staff') return json(PLAN);

    return json({});
  });
  render(
    <RouterProvider
      router={createMemoryRouter(routes, { initialEntries: ['/app/events/ev_1/staff/jobs'] })}
    />,
  );
  await screen.findByRole('heading', { level: 2, name: 'Jobs' });

  return sent;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Jobs and shifts on the Staff page (sc-3908)', () => {
  it('marks its own tab in the Staff tab row, linking the Roster', async () => {
    signedIn();
    await onJobs({});

    const tabs = screen.getByRole('navigation', { name: 'Staff' });
    expect(tabs.querySelector('[aria-current="page"]')?.textContent).toBe('Jobs and shifts');
    expect(screen.getByRole('link', { name: 'Roster' }).getAttribute('href')).toBe(
      '/app/events/ev_1/staff/roster',
    );
  });

  it('lists each job with its level in words and its shifts, and writes out each gap', async () => {
    signedIn();
    await onJobs({});

    expect(screen.getByText('Can check guests in · No shifts')).toBeDefined();
    expect(screen.getAllByText('Can view · 1 shift')).toHaveLength(2);
    expect(screen.getByText('Short 1 · 16:00 to 01:00')).toBeDefined();
    expect(screen.getByText('1 job is short at some point, 1 covered.')).toBeDefined();
    expect(screen.getByText('1 of 2 places filled')).toBeDefined();
  });

  it('switches coverage to a table, one row per steady span', async () => {
    signedIn();
    await onJobs({});

    fireEvent.click(screen.getByRole('button', { name: 'Table' }));

    const table = screen.getByRole('table', { name: 'Coverage by job and time' });
    expect(table.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(table.textContent).toContain('Short 1');
  });

  it('offers no Assign on a full shift, and says so', async () => {
    signedIn();
    await onJobs({});

    expect(screen.queryByRole('button', { name: 'Assign, MC, 19:00 to 20:00' })).toBeNull();
    expect(
      screen.getByText('Every place on this shift is filled. Unassign someone to make room.'),
    ).toBeDefined();
  });

  it('refuses a name already on the event, ignoring case and accents, before sending', async () => {
    signedIn();
    const sent = await onJobs({});

    fireEvent.click(screen.getByRole('button', { name: 'Add a job' }));
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'bár' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(await screen.findByText('This event already has a job called Bar.')).toBeDefined();
    expect(sent.some((one) => one.line === 'POST /api/events/ev_1/staff/jobs')).toBe(false);
  });

  it('refuses someone whose job is another one, on their row', async () => {
    signedIn();
    const sent = await onJobs({});

    fireEvent.click(screen.getByRole('button', { name: 'Assign, Bar, 16:00 to 01:00' }));
    fireEvent.click(await screen.findByRole('button', { name: /^Tolu Bello/ }));

    expect(await screen.findByText('Tolu Bello works as Door on this event.')).toBeDefined();
    expect(sent.some((one) => one.line.startsWith('PUT /api/events/ev_1/staff/shifts'))).toBe(
      false,
    );
  });

  it('sends a shift as wall-clock times in the event’s zone, crossing midnight', async () => {
    signedIn();
    const sent = await onJobs({
      'POST /api/events/ev_1/staff/shifts': () => json(PLAN, 201),
    });

    fireEvent.click(screen.getByRole('button', { name: 'Add a shift' }));
    fireEvent.change(screen.getByLabelText('Job'), { target: { value: 'j_door' } });
    fireEvent.change(screen.getByLabelText('Starts, Time'), { target: { value: '22:00' } });
    fireEvent.change(screen.getByLabelText('Ends, Date'), { target: { value: '2030-11-15' } });
    fireEvent.change(screen.getByLabelText('Ends, Time'), { target: { value: '02:00' } });

    expect(screen.getByText('Ends on Friday at 02:00')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() =>
      expect(sent.find((one) => one.line === 'POST /api/events/ev_1/staff/shifts')?.body).toEqual({
        job: 'j_door',
        startsAt: '2030-11-14T22:00',
        endsAt: '2030-11-15T02:00',
        needed: 1,
      }),
    );
  });

  it('refuses a shift over 24 hours beside its end', async () => {
    signedIn();
    await onJobs({});

    fireEvent.click(screen.getByRole('button', { name: 'Add a shift' }));
    fireEvent.change(screen.getByLabelText('Job'), { target: { value: 'j_door' } });
    fireEvent.change(screen.getByLabelText('Starts, Time'), { target: { value: '10:00' } });
    fireEvent.change(screen.getByLabelText('Ends, Date'), { target: { value: '2030-11-15' } });
    fireEvent.change(screen.getByLabelText('Ends, Time'), { target: { value: '11:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(
      await screen.findByText('A shift cannot be longer than 24 hours. Check the dates.'),
    ).toBeDefined();
  });

  it('shows the API’s count under People needed after a 422, with the shift’s people as they now are', async () => {
    signedIn();
    const now = {
      ...PLAN,
      shifts: PLAN.shifts.map((one) =>
        one.id === 'sh_bar' ? { ...one, people: ['st_sade', 'st_ada'] } : one,
      ),
    };
    let reads = 0;
    await onJobs({
      'GET /api/events/ev_1/staff': () => json(reads++ === 0 ? PLAN : now),
      'PUT /api/events/ev_1/staff/shifts/sh_bar': () =>
        problem('validation_failed', 422, {
          onShift: 2,
          violations: [{ propertyPath: 'needed', message: 'x', code: 'validation_failed' }],
        }),
    });

    fireEvent.click(screen.getByRole('button', { name: 'Edit times, Bar, 16:00 to 01:00' }));
    fireEvent.change(screen.getByLabelText('People needed'), { target: { value: '1' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(
      await screen.findByText(
        '2 people are on this shift. Unassign some first, or keep 2 or more.',
      ),
    ).toBeDefined();
    expect(await screen.findByText('On this shift · 2 people')).toBeDefined();
  });

  it('shows Jobs and shifts read-only without permission to manage staff', async () => {
    signedIn();
    await onJobs({}, ['events.read', 'staff.read']);

    expect(
      screen.getByText(
        'You can see the jobs and shifts. Changing them needs permission to manage staff.',
      ),
    ).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Add a job' })).toBeNull();
    expect(screen.getByText('1 of 1 place filled')).toBeDefined();
    expect(
      screen.queryByText('Every place on this shift is filled. Unassign someone to make room.'),
    ).toBeNull();
  });

  it('starts a gap line under the name in a frame too narrow for it, whole words only (sc-70959)', () => {
    expect(cssRule('.js-frame', JOBS_CSS)).toContain('container: js-frame / inline-size;');
    expect(cssRule('.js-gaps', JOBS_CSS)).toContain('overflow-wrap: normal;');
    const narrow = cssRule(
      '.js-gaps',
      JOBS_CSS.slice(JOBS_CSS.indexOf('@container js-frame (width < 29.5rem)')),
    );
    expect(narrow).toContain('grid-column: 1 / -1;');
    expect(narrow).toContain('left: 0;');
    expect(narrow).toContain('max-width: 100cqi;');
  });
});

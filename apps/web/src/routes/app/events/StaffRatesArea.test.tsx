import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

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
  startsAt: '2030-11-14T16:00:00+00:00',
  endsAt: '2030-11-16T02:00:00+00:00',
  timeZone: 'Europe/London',
  dayCount: 3,
  currency: 'GBP',
  cover: null,
  venue: null,
  arrivalNote: null,
  hosts: [],
  madeLiveAt: '2026-10-26T15:00:00+00:00',
  pausedAt: null,
  phase: 'live',
  concludedAt: null,
  createdAt: '2026-10-21T09:00:00+00:00',
  permissions: OWNER_PERMISSIONS,
};

const HEAD = {
  total: '1502.00',
  countedMinutes: 5490,
  scheduledMinutes: 6135,
  unrated: [{ job: { id: 'bar', name: 'Bar' }, minutes: 645 }],
};

function job(fields: Record<string, unknown>) {
  return {
    changed: null,
    scheduledMinutes: 0,
    shifts: 0,
    openPlaces: 0,
    people: 0,
    cost: null,
    rateMinutes: 0,
    fees: 0,
    paidOnce: [],
    keepOwn: [],
    ...fields,
  };
}

const WAITER = job({
  id: 'waiter',
  name: 'Waiter',
  rate: { kind: 'hourly', amount: '14.00' },
  changed: { by: 'Julien Moreau', at: '2026-10-16T10:00:00+00:00' },
  scheduledMinutes: 2160,
  shifts: 2,
  openPlaces: 2,
  people: 4,
  cost: '518.00',
  rateMinutes: 1740,
  keepOwn: ['Kunle Ajayi'],
});
const BAR = job({
  id: 'bar',
  name: 'Bar',
  rate: null,
  scheduledMinutes: 645,
  shifts: 2,
  people: 2,
});
const DOOR = job({
  id: 'door',
  name: 'Door',
  rate: { kind: 'flat', amount: '120.00' },
  scheduledMinutes: 450,
  shifts: 2,
  people: 1,
  cost: '120.00',
  fees: 1,
  paidOnce: ['Tolu Bello'],
});
const SECURITY = job({
  id: 'security',
  name: 'Security',
  rate: { kind: 'hourly', amount: '15.00' },
  cost: '0.00',
});

function rates(fields: Record<string, unknown> = {}) {
  return {
    currency: 'GBP',
    headline: HEAD,
    jobs: [WAITER, BAR, DOOR, SECURITY],
    own: [
      {
        member: { id: 'kunle', name: 'Kunle Ajayi' },
        job: { id: 'waiter', name: 'Waiter' },
        rate: { kind: 'hourly', amount: '16.00' },
        changed: null,
        minutes: 360,
        cost: '96.00',
      },
    ],
    candidates: [
      {
        member: { id: 'amina', name: 'Amina Yusuf' },
        job: { id: 'waiter', name: 'Waiter' },
        minutes: 420,
      },
    ],
    ...fields,
  };
}

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

const problem = (status: number, type: string) =>
  new Response(
    JSON.stringify({ type: `https://soirely.com/errors/${type}`, title: type, status }),
    {
      status,
      headers: { 'Content-Type': 'application/problem+json' },
    },
  );

type Answer = (body: unknown) => Response | Promise<Response>;

function serve(
  answers: Record<string, Answer>,
  { permissions = OWNER_PERMISSIONS, at = '/app/events/ev_1/budget/staff-rates' } = {},
): { line: string; body: unknown }[] {
  const sent: { line: string; body: unknown }[] = [];

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const line = `${init?.method ?? 'GET'} ${new URL(String(input)).pathname}`;
    const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : null;
    sent.push({ line, body });

    const answer = answers[line];
    if (answer != null) return answer(body);
    if (line === 'GET /api/events/ev_1') return json({ event: { ...EVENT, permissions } });
    if (line === 'GET /api/events/ev_1/budget/staff-rates') return json(rates());
    if (line === 'GET /api/events/ev_1/budget/margin') return problem(403, 'plan_required');

    return json({});
  });
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [at] })} />);

  return sent;
}

const main = () => screen.getByRole('main');
const row = (name: string) => within(main()).getByRole('button', { name: new RegExp(`^${name},`) });

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Budget / Staff rates (sc-101)', () => {
  it('heads the page with the total and the hours not counted', async () => {
    signedIn();
    serve({});

    expect(await screen.findByRole('heading', { level: 1, name: 'Staff rates' })).toBeTruthy();
    await screen.findByText('£1,502');
    expect(main().textContent).toContain(
      'From 91 h 30 min of 102 h 15 min scheduled. Bar’s 10 h 45 min not counted until it has a rate.',
    );
    expect(row('Bar').textContent).toContain('No rate yet');
    expect(row('Bar').textContent).toContain('Not counted');
    expect(row('Security').textContent).toContain('0 h · No shifts yet');
    expect(row('Door').textContent).toContain('£120 for the event, each person');
    expect(row('Door').textContent).toContain('7 h 30 min from 2 shifts · 1 person');
    expect(
      screen.getByText('Bar has no rate yet, so its 10 h 45 min are not in the budget.'),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Set Bar’s rate' })).toBeTruthy();
  });

  it('changes a rate in place, sends it, and says who changed it from what', async () => {
    signedIn();
    const sent = serve({
      'PUT /api/events/ev_1/budget/staff-rates/jobs/waiter': () =>
        json(
          rates({
            headline: { ...HEAD, total: '1531.00' },
            jobs: [
              { ...WAITER, rate: { kind: 'hourly', amount: '15.00' }, cost: '531.00' },
              BAR,
              DOOR,
              SECURITY,
            ],
          }),
        ),
    });

    fireEvent.click(await screen.findByRole('button', { name: /^Waiter,/u }));
    expect(screen.getByRole('group', { name: 'Waiter' })).toBeTruthy();
    expect(screen.getByText('How is each Waiter paid?')).toBeTruthy();
    expect(screen.getByText(/^Set by Julien Moreau on Friday/u)).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Rate an hour'), { target: { value: '15' } });
    expect(screen.getByText('29 h × £15 = £435. Kunle Ajayi keeps their own rate.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Save rate' }));

    await waitFor(() =>
      expect(row('Waiter').textContent).toContain('Changed by you just now. Was £14 an hour.'),
    );
    expect(main().textContent).toContain('£1,531');
    expect(screen.getByText('Waiter’s rate saved.')).toBeTruthy();
    expect(sent.find((one) => one.line.startsWith('PUT'))?.body).toEqual({
      kind: 'hourly',
      amount: '15.00',
      currency: 'GBP',
    });
  });

  it('checks the rate before sending, the words following the choice', async () => {
    signedIn();
    const sent = serve({});

    fireEvent.click(await screen.findByRole('button', { name: /^Door,/u }));
    fireEvent.change(screen.getByLabelText('Fee for each person'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save rate' }));
    expect(screen.getByText('Enter the fee for each person.')).toBeTruthy();

    fireEvent.click(screen.getByRole('radio', { name: /By the hour/u }));
    expect(screen.getByText('Enter the rate an hour.')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Rate an hour'), { target: { value: '-14' } });
    expect(screen.getByText('The rate cannot be below 0. Enter 0 or more.')).toBeTruthy();
    expect(sent.some((one) => one.line.startsWith('PUT'))).toBe(false);
  });

  it('says a rate was not saved under the field when Manage the budget was taken away', async () => {
    signedIn();
    serve({
      'PUT /api/events/ev_1/budget/staff-rates/jobs/waiter': () =>
        problem(403, 'permission_required'),
    });

    fireEvent.click(await screen.findByRole('button', { name: /^Waiter,/u }));
    fireEvent.change(screen.getByLabelText('Rate an hour'), { target: { value: '15' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save rate' }));

    expect(
      await screen.findByText(
        'Not saved. Changing a rate needs the Manage the budget permission, and you no longer have it on this event. The rate is still £14 an hour.',
      ),
    ).toBeTruthy();
  });

  it('gives focus back to the row an editor opened from', async () => {
    signedIn();
    serve({
      'PUT /api/events/ev_1/budget/staff-rates/jobs/waiter': () => json(rates()),
    });

    fireEvent.click(await screen.findByRole('button', { name: /^Waiter,/u }));
    fireEvent.change(screen.getByLabelText('Rate an hour'), { target: { value: '15' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save rate' }));
    await waitFor(() => expect(document.activeElement).toBe(row('Waiter')));

    fireEvent.click(screen.getByRole('button', { name: 'Set Bar’s rate' }));
    fireEvent.keyDown(screen.getByLabelText('Rate an hour'), { key: 'Escape' });
    expect(document.activeElement).toBe(row('Bar'));

    fireEvent.click(row('Door'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(document.activeElement).toBe(row('Door'));

    const kunle = () =>
      within(screen.getByRole('region', { name: 'People on their own rate' })).getByRole('button', {
        name: /^Kunle Ajayi/u,
      });
    fireEvent.click(kunle());
    fireEvent.keyDown(screen.getByLabelText('Rate an hour'), { key: 'Escape' });
    expect(document.activeElement).toBe(kunle());

    fireEvent.click(screen.getByRole('button', { name: 'Add one' }));
    fireEvent.keyDown(screen.getByLabelText('Who'), { key: 'Escape' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Add one' }));
  });

  it('keeps focus in the field when the server refuses the rate', async () => {
    signedIn();
    serve({
      'PUT /api/events/ev_1/budget/staff-rates/jobs/waiter': () =>
        problem(403, 'permission_required'),
    });

    fireEvent.click(await screen.findByRole('button', { name: /^Waiter,/u }));
    fireEvent.change(screen.getByLabelText('Rate an hour'), { target: { value: '15' } });
    screen.getByRole('button', { name: 'Save rate' }).focus();
    fireEvent.click(screen.getByRole('button', { name: 'Save rate' }));

    await screen.findByText(/^Not saved\./u);
    expect(document.activeElement).toBe(screen.getByLabelText('Rate an hour'));
  });

  it('removes a job’s rate', async () => {
    signedIn();
    const sent = serve({
      'DELETE /api/events/ev_1/budget/staff-rates/jobs/door': () =>
        json(rates({ jobs: [WAITER, BAR, { ...DOOR, rate: null, cost: null }, SECURITY] })),
    });

    fireEvent.click(await screen.findByRole('button', { name: /^Door,/u }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove the rate' }));

    await waitFor(() => expect(row('Door').textContent).toContain('No rate yet'));
    await waitFor(() => expect(document.activeElement).toBe(row('Door')));
    expect(
      screen.getByText('Door’s rate removed. Its hours are not counted until it has one.'),
    ).toBeTruthy();
    expect(
      sent.some((one) => one.line === 'DELETE /api/events/ev_1/budget/staff-rates/jobs/door'),
    ).toBe(true);
  });

  it('gives a person their own rate, and puts them back on their job’s', async () => {
    signedIn();
    const amina = {
      member: { id: 'amina', name: 'Amina Yusuf' },
      job: { id: 'waiter', name: 'Waiter' },
      rate: { kind: 'hourly', amount: '16.00' },
      changed: null,
      minutes: 420,
      cost: '112.00',
    };
    const sent = serve({
      'PUT /api/events/ev_1/budget/staff-rates/people/amina': () =>
        json(rates({ own: [...rates().own, amina], candidates: [] })),
      'DELETE /api/events/ev_1/budget/staff-rates/people/amina': () => json(rates()),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Add one' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add rate' }));
    expect(screen.getByText('Choose who this rate is for.')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Who'), { target: { value: 'amina' } });
    fireEvent.change(screen.getByLabelText('Rate an hour'), { target: { value: '16' } });
    expect(screen.getByText('7 h × £16 = £112.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add rate' }));

    const own = within(screen.getByRole('region', { name: 'People on their own rate' }));
    const row = await own.findByRole('button', { name: /^Amina Yusuf/u });
    expect(row.textContent).toContain('£16 an hour · Instead of Waiter’s £14 an hour');
    expect(row.textContent).toContain('7 h as Waiter');
    await waitFor(() => expect(document.activeElement).toBe(row));
    fireEvent.click(row);
    fireEvent.click(screen.getByRole('button', { name: 'Use Waiter’s rate' }));

    expect(await screen.findByText('Amina Yusuf is back on Waiter’s rate.')).toBeTruthy();
    expect(own.queryByRole('button', { name: /^Amina Yusuf/u })).toBeNull();
    await waitFor(() =>
      expect(document.activeElement).toBe(
        within(main()).getByRole('button', { name: /^Waiter,/u }),
      ),
    );
    expect(
      sent.some((one) => one.line === 'DELETE /api/events/ev_1/budget/staff-rates/people/amina'),
    ).toBe(true);
  });

  it('shows the rates as text, with no buttons, without Manage the budget', async () => {
    signedIn();
    serve({}, { permissions: OWNER_PERMISSIONS.filter((one) => one !== 'budget.manage') });

    expect(
      await screen.findByText(
        'You can see staff rates but not change them. Changing a rate needs the Manage the budget permission.',
      ),
    ).toBeTruthy();
    expect(within(main()).queryByRole('button', { name: /^Waiter,/u })).toBeNull();
    expect(within(main()).queryByRole('button', { name: 'Add one' })).toBeNull();
    expect(within(main()).queryByRole('button', { name: 'Set Bar’s rate' })).toBeNull();
  });

  it('is not there at all without budget.read', async () => {
    signedIn();
    serve({}, { permissions: OWNER_PERMISSIONS.filter((one) => !one.startsWith('budget.')) });

    await waitFor(() => expect(screen.queryByText('Adaeze and Tunde')).toBeNull());
    expect(screen.queryByRole('heading', { name: 'Staff rates' })).toBeNull();
  });

  it('points an event with no jobs to Jobs and shifts', async () => {
    signedIn();
    serve({
      'GET /api/events/ev_1/budget/staff-rates': () =>
        json(
          rates({
            jobs: [],
            own: [],
            candidates: [],
            headline: { ...HEAD, total: '0', unrated: [] },
          }),
        ),
    });

    expect(await screen.findByRole('heading', { name: 'No jobs on this event yet' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open Jobs and shifts' }).getAttribute('href')).toBe(
      '/app/events/ev_1/staff/jobs',
    );
  });

  it('after the event sets Worked under Scheduled on each row, the headline still scheduled (sc-234)', async () => {
    signedIn();
    const worked = (minutes: number, cost: string | null, more: Record<string, unknown> = {}) => ({
      minutes,
      assumedMinutes: 0,
      noAttendance: 0,
      people: 0,
      cost,
      ...more,
    });
    serve({
      'GET /api/events/ev_1/budget/staff-rates': () =>
        json(
          rates({
            worked: {
              total: '1410.50',
              minutes: 5210,
              scheduledMinutes: 5490,
              assumedMinutes: 548,
              noAttendance: 1,
            },
            jobs: [
              {
                ...WAITER,
                worked: worked(2042, '476.47', { assumedMinutes: 548, noAttendance: 1 }),
              },
              { ...BAR, worked: worked(640, null) },
              { ...DOOR, worked: worked(450, '120.00', { people: 1 }) },
              { ...SECURITY, worked: worked(0, '0.00') },
            ],
            own: [
              {
                ...rates().own[0],
                worked: { minutes: 342, cost: '91.20' },
              },
            ],
          }),
        ),
    });

    await screen.findByText('£1,502');
    expect(
      screen.getByText('Worked 86 h 50 min of 91 h 30 min scheduled: £1,410.50.'),
    ).toBeTruthy();
    expect(
      screen.getByText(
        'Of the hours worked, 9 h 8 min are assumed: a missing clock-out counts to the scheduled end.',
      ),
    ).toBeTruthy();
    expect(screen.getByText('Bar’s 10 h 45 min not counted until it has a rate.')).toBeTruthy();
    expect(
      screen.getByText(
        '34 h 2 min · of which 9 h 8 min assumed (not clocked out) · 1 shift with no attendance recorded',
      ),
    ).toBeTruthy();
    expect(screen.getByText('7 h 30 min · 1 person worked')).toBeTruthy();
    expect(screen.getByText('Worked 5 h 42 min as Waiter · £91.20')).toBeTruthy();
    expect(
      screen.getByText('Worked hours are the clock-ins and clock-outs on Staff, Hours worked.'),
    ).toBeTruthy();
    expect(screen.getAllByText('Worked')).toHaveLength(4);
  });

  it('puts the same figure on the Budget’s Staff line, which opens Staff rates', async () => {
    signedIn();
    const staffLine = {
      id: 'staff',
      label: 'Staff',
      category: 'staffing',
      basis: 'per_staff_hour',
      rate: null,
      amount: null,
      currency: 'GBP',
      note: null,
      notPriced: false,
      quantity: { count: 102, source: 'staff_hours', reason: null },
      createdAt: '2026-11-01T09:00:00+00:00',
      updatedAt: '2026-11-01T09:00:00+00:00',
      cost: { confirmed: '1502.00', potential: '1502.00' },
    };
    const quantities = {
      per_head: { count: 96, source: 'accepted', reason: null },
      per_table: { count: 0, source: 'seating_tables', reason: 'no_seating_plan' },
      per_staff_hour: { count: 102, source: 'staff_hours', reason: null },
      per_day: { count: 3, source: 'event_days', reason: null },
      fixed: { count: 1, source: 'fixed', reason: null },
    };
    serve(
      {
        'GET /api/events/ev_1/budget': () =>
          json({
            currency: 'GBP',
            confirmed: '1502.00',
            potential: '1502.00',
            perHead: {
              confirmed: { amount: '15.65', heads: 96 },
              potential: { amount: '11.29', heads: 133 },
            },
            notPriced: 0,
            quantities,
            lines: [staffLine],
            staff: HEAD,
          }),
      },
      { at: '/app/events/ev_1/budget' },
    );

    const staff = await screen.findByRole('link', { name: 'Staff, Staff rates' });
    expect(staff.textContent).toContain('£1,502.00');
    expect(staff.textContent).toContain('91 h 30 min of 102 h 15 min scheduled · from Staff rates');
    expect(staff.textContent).toContain('Bar’s 10 h 45 min not counted until it has a rate.');
    expect(staff.getAttribute('href')).toBe('/app/events/ev_1/budget/staff-rates');

    fireEvent.click(screen.getByRole('button', { name: 'Add a cost' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add a cost' });
    expect(
      within(dialog).getByText(
        'No rate on this line. It adds up each job’s rate, or flat fee, from Staff rates, so there is one place to change a rate.',
      ),
    ).toBeTruthy();
    expect(
      within(dialog).getByRole('link', { name: 'Open Staff rates' }).getAttribute('href'),
    ).toBe('/app/events/ev_1/budget/staff-rates');
  });
});

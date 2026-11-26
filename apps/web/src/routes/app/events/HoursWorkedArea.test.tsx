import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

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

function row(fields: Record<string, unknown> = {}) {
  return {
    shiftId: 'lead',
    staffId: 'ifeoma',
    name: 'Ifeoma Nduka',
    job: 'Floor lead',
    startsAt: '2030-11-14T16:00:00+01:00',
    endsAt: '2030-11-15T01:00:00+01:00',
    scheduledMinutes: 540,
    clockedInAt: '2030-11-14T15:52:00+01:00',
    clockedOutAt: null,
    recordedInAt: '2030-11-14T15:52:00+01:00',
    recordedOutAt: null,
    workedMinutes: 548,
    assumedMinutes: 548,
    mark: 'not_clocked_out',
    live: 'in',
    opensAt: '2030-11-14T15:00:00+01:00',
    stillOn: false,
    corrections: [],
    ...fields,
  };
}

const EMEKA = row({
  shiftId: 'w2',
  staffId: 'emeka',
  name: 'Emeka Obi',
  job: 'Waiter',
  startsAt: '2030-11-14T17:00:00+01:00',
  scheduledMinutes: 480,
  clockedInAt: null,
  recordedInAt: null,
  workedMinutes: 0,
  assumedMinutes: 0,
  mark: 'no_attendance',
  live: 'not_yet',
  opensAt: '2030-11-14T16:00:00+01:00',
});

const HOURS = {
  timeZone: 'Africa/Lagos',
  now: '2030-11-15T02:10:00+01:00',
  live: false,
  canCorrect: true,
  rows: [row(), EMEKA],
  summary: {
    workedMinutes: 548,
    scheduledMinutes: 1020,
    assumedMinutes: 548,
    noAttendance: 1,
    clockedIn: 1,
    total: 2,
  },
};

async function onHours(
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

    return json({});
  });
  render(
    <RouterProvider
      router={createMemoryRouter(routes, { initialEntries: ['/app/events/ev_1/staff/hours'] })}
    />,
  );

  return sent;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Hours worked on the Staff page (sc-234)', () => {
  it('lists each person’s scheduled and clocked times, both marks and the sum', async () => {
    signedIn();
    await onHours({ 'GET /api/events/ev_1/staff/hours': () => json(HOURS) });

    expect(await screen.findByText('9 h 8 min of 17 h scheduled')).toBeDefined();
    const tabs = screen.getByRole('navigation', { name: 'Staff' });
    expect(tabs.querySelector('[aria-current="page"]')?.textContent).toBe('Hours worked');
    expect(
      screen.getByText(
        'of which 9 h 8 min assumed (not clocked out) · 1 shift with no attendance recorded',
      ),
    ).toBeDefined();
    expect(screen.getByText('In 15:52 · No clock-out')).toBeDefined();
    expect(screen.getByText('Not clocked out · Counted to 01:00, the scheduled end')).toBeDefined();
    expect(screen.getByText('No attendance recorded · 0 h counted')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Correct times, Emeka Obi' })).toBeDefined();
  });

  it('during service says who has clocked in, and when clock-in opens', async () => {
    signedIn();
    await onHours({
      'GET /api/events/ev_1/staff/hours': () =>
        json({
          ...HOURS,
          live: true,
          now: '2030-11-14T15:30:00+01:00',
          rows: [row({ mark: null }), { ...EMEKA, mark: null, live: 'later' }],
        }),
    });

    expect(await screen.findByText('1 of 2 clocked in')).toBeDefined();
    expect(screen.getByText('As of 15:30')).toBeDefined();
    expect(screen.getByText('Clocked in')).toBeDefined();
    expect(screen.getByText('Clock-in opens at 16:00')).toBeDefined();
  });

  it('without staff.manage shows the hours and no Correct times', async () => {
    signedIn();
    await onHours({
      'GET /api/events/ev_1/staff/hours': () => json({ ...HOURS, canCorrect: false }),
    });

    expect(
      await screen.findByText(
        'You can see the hours. Correcting a time needs permission to manage staff.',
      ),
    ).toBeDefined();
    expect(screen.queryByRole('button', { name: /^Correct times/u })).toBeNull();
  });

  it('says when nobody is on a shift, with the way to Jobs and shifts', async () => {
    signedIn();
    await onHours({
      'GET /api/events/ev_1/staff/hours': () =>
        json({ ...HOURS, rows: [], summary: { ...HOURS.summary, total: 0 } }),
    });

    expect(await screen.findByRole('heading', { name: 'Nobody is on a shift yet' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Open Jobs and shifts' }).getAttribute('href')).toBe(
      '/app/events/ev_1/staff/jobs',
    );
  });

  it('offers Try again when the hours do not load', async () => {
    signedIn();
    let reads = 0;
    await onHours({
      'GET /api/events/ev_1/staff/hours': () =>
        reads++ === 0 ? problem('internal', 500) : json(HOURS),
    });

    expect(
      await screen.findByText('The hours could not load. Check your connection and try again.'),
    ).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('9 h 8 min of 17 h scheduled')).toBeDefined();
  });

  it('corrects a time, checks it first, and keeps the recorded one beside it', async () => {
    signedIn();
    const fixed = {
      ...HOURS,
      rows: [
        row({
          clockedOutAt: '2030-11-15T01:15:00+01:00',
          mark: null,
          workedMinutes: 563,
          assumedMinutes: 0,
          corrections: [
            { field: 'out', was: null, by: 'Folake Adeyemi', at: '2030-11-15T02:10:00+01:00' },
          ],
        }),
        EMEKA,
      ],
    };
    const sent = await onHours({
      'GET /api/events/ev_1/staff/hours': () => json(HOURS),
      'PUT /api/events/ev_1/staff/hours/lead/ifeoma': () => json(fixed),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Correct times, Ifeoma Nduka' }));
    expect(screen.getByRole('heading', { name: 'Correct Ifeoma Nduka’s times' })).toBeDefined();
    expect(screen.getByText('Recorded 15:52')).toBeDefined();
    expect(screen.getByText('Not recorded, counted to 01:00')).toBeDefined();

    const outTime = screen.getByLabelText('Clocked out, Time');
    fireEvent.change(screen.getByLabelText('Clocked out, Date'), {
      target: { value: '2030-11-14' },
    });
    fireEvent.change(outTime, { target: { value: '01:15' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save times' }));
    expect(await screen.findByText('The end must be after the start.')).toBeDefined();
    await waitFor(() => expect(document.activeElement).toBe(outTime));

    fireEvent.change(screen.getByLabelText('Clocked out, Date'), {
      target: { value: '2030-11-15' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save times' }));

    expect(await screen.findByText('Ifeoma Nduka’s times saved.')).toBeDefined();
    expect(sent.find((one) => one.line.startsWith('PUT'))?.body).toEqual({
      clockedInAt: '2030-11-14T15:52',
      clockedOutAt: '2030-11-15T01:15',
    });
    expect(
      screen.getByText('Out 01:15 · corrected from no clock-out by Folake Adeyemi, Friday 02:10'),
    ).toBeDefined();
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'Correct times, Ifeoma Nduka' }),
      ),
    );
  });

  it('shows the server’s word under the field it refused', async () => {
    signedIn();
    await onHours({
      'GET /api/events/ev_1/staff/hours': () => json(HOURS),
      'PUT /api/events/ev_1/staff/hours/lead/ifeoma': () =>
        problem('validation_failed', 422, {
          violations: [
            {
              propertyPath: 'clockedInAt',
              message: 'That is before the shift’s day.',
              code: 'validation_failed',
            },
          ],
        }),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Correct times, Ifeoma Nduka' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save times' }));

    expect(await screen.findByText('That is before the shift’s day.')).toBeDefined();
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByLabelText('Clocked in, Time')),
    );
  });
});

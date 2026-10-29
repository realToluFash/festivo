import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { __setSessionState, type Session } from '../../../session.ts';
import { OWNER_PERMISSIONS, membership } from '../../../test-memberships.ts';
import { routes } from '../../index.tsx';

const IRE = membership({ id: 'org_1', name: 'Ìrè Events' });

const MANAGER = membership({
  ...IRE,
  role: { id: 'role_4', seededAs: 'event_manager', name: null },
  permissions: OWNER_PERMISSIONS.filter((permission) => permission !== 'events.create'),
});

const AHEAD = { startsAt: '2030-11-14T16:00:00+01:00', endsAt: '2030-11-15T02:00:00+01:00' };

function event(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ev_1',
    organisationId: 'org_1',
    name: 'Adaeze and Tunde',
    type: 'wedding',
    status: 'draft',
    ...AHEAD,
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

function live(overrides: Record<string, unknown> = {}) {
  return event({
    status: 'live',
    phase: 'live',
    madeLiveAt: '2026-10-26T15:00:00+00:00',
    ...overrides,
  });
}

function signedIn(organisation = IRE): void {
  const session: Session = {
    userId: 'u1',
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

async function onTheEvent(shown: ReturnType<typeof event>, answers: Record<string, Answer> = {}) {
  const sent = answering({
    'GET /api/events/ev_1': () => json({ event: shown }),
    'GET /api/orgs/org_1/events': () => json({ events: [] }),
    ...answers,
  });
  render(
    <RouterProvider
      router={createMemoryRouter(routes, { initialEntries: ['/app/events/ev_1'] })}
    />,
  );
  await screen.findByRole('heading', { level: 1, name: shown.name });

  return sent;
}

async function opened(shown: ReturnType<typeof event>, answers: Record<string, Answer> = {}) {
  const sent = await onTheEvent(shown, answers);
  fireEvent.click(screen.getByRole('button', { name: 'Duplicate' }));

  return { sent, dialog: await screen.findByRole('dialog', { name: `Duplicate ${shown.name}` }) };
}

function start(dialog: HTMLElement, date: string, time: string): void {
  fireEvent.change(within(dialog).getByLabelText('Date'), { target: { value: date } });
  fireEvent.change(within(dialog).getByLabelText('Time'), { target: { value: time } });
}

function duplicates(sent: { line: string }[]): boolean {
  return sent.some(({ line }) => line === 'POST /api/events/ev_1/duplicate');
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Duplicate an event (sc-3593)', () => {
  it('is offered to somebody with events.create, a Finished event included', async () => {
    signedIn();
    await onTheEvent(live({ phase: 'finished', concludedAt: '2026-10-20T01:00:00+01:00' }));

    expect(screen.getByRole('button', { name: 'Duplicate' })).toBeDefined();
  });

  it('is not offered without events.create, even to somebody who manages events', async () => {
    signedIn(MANAGER);
    await onTheEvent(event());

    expect(screen.getByRole('button', { name: 'Make live' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Duplicate' })).toBeNull();
  });

  it('opens on its title with what is copied and works out the end as the start is chosen', async () => {
    signedIn();
    const { dialog } = await opened(event());

    expect(document.activeElement).toBe(
      within(dialog).getByRole('heading', { name: 'Duplicate Adaeze and Tunde' }),
    );
    expect(within(dialog).getByText('Cover and its description')).toBeDefined();
    expect(within(dialog).getByText('Anything that happened at the event')).toBeDefined();
    expect(within(dialog).getByText('Hosts')).toBeDefined();
    expect(
      within(dialog).getByText(
        'It ends 10 hours after it starts, like the original. Times in Africa/Lagos.',
      ),
    ).toBeDefined();

    start(dialog, '2027-05-15', '16:00');

    expect(
      within(dialog).getByText(
        'It ends Sun, May 16, 2027, 02:00, 10 hours later, like the original. Times in Africa/Lagos.',
      ),
    ).toBeDefined();
  });

  it('gives a length that is not whole hours in hours and minutes', async () => {
    signedIn();
    const { dialog } = await opened(event({ endsAt: '2030-11-14T18:20:00+01:00' }));

    expect(
      within(dialog).getByText(
        'It ends 2 hours 20 minutes after it starts, like the original. Times in Africa/Lagos.',
      ),
    ).toBeDefined();
  });

  it('reads the length on the clock when the original crosses a change of clocks', async () => {
    signedIn();
    const { dialog } = await opened(
      event({
        startsAt: '2027-03-27T20:00:00+01:00',
        endsAt: '2027-03-28T08:00:00+02:00',
        timeZone: 'Europe/Madrid',
      }),
    );

    start(dialog, '2027-07-17', '20:00');

    expect(
      within(dialog).getByText(
        'It ends Sun, Jul 18, 2027, 08:00, 12 hours later, like the original. Times in Europe/Madrid.',
      ),
    ).toBeDefined();
  });

  it('names the year of an end that falls in the next year', async () => {
    signedIn();
    const { dialog } = await opened(
      event({
        startsAt: '2027-07-17T20:00:00+02:00',
        endsAt: '2027-07-18T08:00:00+02:00',
        timeZone: 'Europe/Madrid',
      }),
    );

    start(dialog, '2027-12-31', '20:00');

    expect(
      within(dialog).getByText(
        'It ends Sat, Jan 1, 2028, 08:00, 12 hours later, like the original. Times in Europe/Madrid.',
      ),
    ).toBeDefined();
  });

  it('sends nothing with no start, says so beside it and moves focus to the first empty field', async () => {
    signedIn();
    const { sent, dialog } = await opened(event());

    fireEvent.click(within(dialog).getByRole('button', { name: 'Create draft' }));

    expect(within(dialog).getByText('Choose when the copy starts.')).toBeDefined();
    expect(document.activeElement).toBe(within(dialog).getByLabelText('Date'));

    fireEvent.change(within(dialog).getByLabelText('Date'), { target: { value: '2027-05-15' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create draft' }));

    expect(within(dialog).getByText('Choose the time the copy starts.')).toBeDefined();
    expect(document.activeElement).toBe(within(dialog).getByLabelText('Time'));
    expect(duplicates(sent)).toBe(false);
  });

  it('creates the draft from the start typed and lands on its page', async () => {
    signedIn();
    const copy = event({
      id: 'ev_2',
      startsAt: '2027-05-15T16:00:00+01:00',
      endsAt: '2027-05-16T02:00:00+01:00',
    });
    const { sent, dialog } = await opened(live(), {
      'POST /api/events/ev_1/duplicate': () => json({ event: copy }, 201),
      'GET /api/events/ev_2': () => json({ event: copy }),
    });

    start(dialog, '2027-05-15', '16:00');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create draft' }));

    expect(await within(dialog).findByText('Draft created. Opening it.')).toBeDefined();
    await waitFor(() =>
      expect(sent.some(({ line }) => line === 'GET /api/events/ev_2')).toBe(true),
    );
    expect(sent.find(({ line }) => line === 'POST /api/events/ev_1/duplicate')?.body).toEqual({
      startsAt: '2027-05-15T16:00',
    });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('says a failure saved nothing and keeps the start that was typed', async () => {
    signedIn();
    const { dialog } = await opened(event(), {
      'POST /api/events/ev_1/duplicate': () => json({ title: 'Server error', status: 500 }, 500),
    });

    start(dialog, '2027-05-15', '16:00');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Create draft' }));

    expect((await within(dialog).findByRole('alert')).textContent).toContain(
      'Not created. Nothing was saved. Try again.',
    );
    expect(within(dialog).getByLabelText<HTMLInputElement>('Date').value).toBe('2027-05-15');
    expect(within(dialog).getByLabelText<HTMLInputElement>('Time').value).toBe('16:00');
  });

  it('closes on Escape and gives focus back to Duplicate', async () => {
    signedIn();
    const { dialog } = await opened(event());

    fireEvent.keyDown(dialog, { key: 'Escape' });

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Duplicate' })),
    );
  });
});

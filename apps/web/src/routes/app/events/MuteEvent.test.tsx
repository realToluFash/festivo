import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { __setSessionState, type Session } from '../../../session.ts';
import { membership } from '../../../test-memberships.ts';
import { routes } from '../../index.tsx';

const IRE = membership({ id: 'org_1', name: 'Ìrè Events' });

const READER = membership({
  ...IRE,
  role: { id: 'role_5', seededAs: 'viewer', name: null },
  permissions: ['events.read'],
});

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
  venue: null,
  madeLiveAt: '2026-10-26T15:00:00+00:00',
  phase: 'live',
  concludedAt: null,
  createdAt: '2026-10-21T09:00:00+00:00',
};

function signedIn(organisation = IRE): void {
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
    organisations: [organisation],
    organisationCountry: null,
    timezone: null,
    waitingFor: null,
  };

  __setSessionState({ status: 'signedIn', session });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status });
}

async function onTheEvent(
  muted: boolean,
  put: (body: unknown) => Response = (body) => json(body),
): Promise<{ line: string; body: unknown }[]> {
  const sent: { line: string; body: unknown }[] = [];

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const line = `${init?.method ?? 'GET'} ${new URL(String(input)).pathname}`;
    const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : null;
    sent.push({ line, body });

    if (line === 'GET /api/events/ev_1') return json({ event: EVENT });
    if (line === 'GET /api/events/ev_1/mute') return json({ muted });
    if (line === 'PUT /api/events/ev_1/mute') return put(body);

    return json({});
  });
  render(
    <RouterProvider
      router={createMemoryRouter(routes, { initialEntries: ['/app/events/ev_1'] })}
    />,
  );
  await screen.findByRole('heading', { level: 1, name: EVENT.name });

  return sent;
}

function card(): HTMLElement {
  return screen.getByRole('region', { name: 'Just for you' });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Mute this event on the event page (sc-3980)', () => {
  it('shows the Just for you card to somebody who can only read the event', async () => {
    signedIn(READER);
    await onTheEvent(true);

    expect(within(card()).getByText('Nobody else on this event is affected.')).toBeDefined();
    await waitFor(() =>
      expect(
        (within(card()).getByRole('switch', { name: 'Mute this event' }) as HTMLInputElement)
          .checked,
      ).toBe(true),
    );
    expect(
      within(card()).getByRole('link', { name: 'Notification settings' }).getAttribute('href'),
    ).toBe('/app/account/notifications');
    expect(screen.queryByRole('button', { name: 'Delete event' })).toBeNull();
  });

  it('sits below the page buttons and above Delete event', async () => {
    signedIn();
    await onTheEvent(false);

    const guests = screen
      .getAllByRole('link', { name: 'Guests' })
      .find((link) => link.getAttribute('href') === '/app/events/ev_1/guests');
    const remove = screen.getByRole('button', { name: 'Delete event' });

    expect(
      (guests?.compareDocumentPosition(card()) ?? 0) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(card().compareDocumentPosition(remove) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('saves the switch for this person as soon as it changes', async () => {
    signedIn(READER);
    const sent = await onTheEvent(false);
    const toggle = within(card()).getByRole('switch', { name: 'Mute this event' });
    await waitFor(() => expect((toggle as HTMLInputElement).disabled).toBe(false));

    fireEvent.click(toggle);

    await waitFor(() =>
      expect(sent.find(({ line }) => line === 'PUT /api/events/ev_1/mute')?.body).toEqual({
        muted: true,
      }),
    );
    expect((toggle as HTMLInputElement).checked).toBe(true);
  });

  it('puts the switch back and says so when the change is not saved', async () => {
    signedIn(READER);
    await onTheEvent(false, () => json({ title: 'Down' }, 503));
    const toggle = within(card()).getByRole('switch', { name: 'Mute this event' });
    await waitFor(() => expect((toggle as HTMLInputElement).disabled).toBe(false));

    fireEvent.click(toggle);

    await within(card()).findByText("Couldn't save. Try again.");
    expect((toggle as HTMLInputElement).checked).toBe(false);
  });
});

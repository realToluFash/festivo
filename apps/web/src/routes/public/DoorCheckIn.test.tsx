import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { __setSessionState } from '../../session.ts';
import { tokens } from '../../tokens.ts';
import { routes } from '../index.tsx';

/** As CheckInSerialiser answers GET /api/events/{id}/check-in. */
function list(arrived = false): Record<string, unknown> {
  return {
    checkIn: { state: 'open', opensAt: '2030-11-14T18:00:00+00:00', timeZone: 'Europe/Lisbon' },
    count: { attended: arrived ? 1 : 0, expected: 2 },
    guests: [
      {
        id: 'g_amara',
        fullName: 'Amara Eze',
        reply: 'coming',
        arrival: arrived ? { at: '2030-11-14T19:05:00+00:00', by: 'Kemi Okafor' } : null,
        companions: [],
      },
      { id: 'g_bisi', fullName: 'Bísí Adé', reply: 'coming', arrival: null, companions: [] },
    ],
  };
}

const NIGHT = {
  event: { id: 'ev_1', name: 'Joana & Rui’s wedding', timeZone: 'Europe/Lisbon' },
  endsAt: '2030-11-14T23:30:00+00:00',
  station: null,
  job: 'Door',
  shift: null,
  later: null,
  lead: null,
  timing: [],
  doorsAt: '2030-11-14T18:00:00+00:00',
  tables: null,
  checksIn: true,
};

const REFUSED = (status: number) => ({
  type: 'https://soirely.com/errors/access_denied',
  title: 'No',
  status,
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function signedIn(): void {
  tokens.save({ accessToken: 'live', refreshExpiresAt: '', sessionId: 's' });
  __setSessionState({
    status: 'signedIn',
    session: {
      name: 'Kemi Okafor',
      email: 'kemi@example.com',
      verified: true,
      complete: true,
      awaiting: null,
      providers: [],
      userId: 'u_kemi',
      needsOrganisation: true,
      hasPassword: true,
      organisation: null,
      organisations: [],
      organisationCountry: null,
      timezone: null,
      waitingFor: null,
      outsideEvents: [],
    },
  } as never);
}

let router: ReturnType<typeof createMemoryRouter>;

function at(path: string, answers: Record<string, () => Response>): string[] {
  const sent: string[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const line = `${init?.method ?? 'GET'} ${new URL(String(input)).pathname}`;
    sent.push(line);

    return answers[line]?.() ?? json({}, 404);
  });
  router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);

  return sent;
}

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

describe('check-in in the browser (sc-28230)', () => {
  it('lists the guests, leads back to Your shift, and announces an arrival', async () => {
    signedIn();
    let arrived = false;
    const sent = at('/door/ev_1', {
      'GET /api/events/ev_1/check-in': () => json(list(arrived)),
      'GET /api/events/ev_1/my-night': () => json(NIGHT),
      'POST /api/events/ev_1/check-in/arrivals': () => {
        arrived = true;
        return json(list(true));
      },
    });

    expect(await screen.findByText('Amara Eze')).toBeTruthy();
    expect((await screen.findByRole('link', { name: /Your shift/ })).getAttribute('href')).toBe(
      '/night/ev_1',
    );

    fireEvent.click(screen.getByRole('button', { name: 'Arrived: Amara Eze' }));

    await waitFor(() => expect(sent).toContain('POST /api/events/ev_1/check-in/arrivals'));
    expect(await screen.findByRole('button', { name: /Amara Eze/ })).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('Amara Eze');
  });

  it('finds a guest by a name typed without its accents', async () => {
    signedIn();
    at('/door/ev_1', {
      'GET /api/events/ev_1/check-in': () => json(list()),
      'GET /api/events/ev_1/my-night': () => json(NIGHT),
    });

    fireEvent.change(await screen.findByLabelText('Search by name'), { target: { value: 'bisi' } });

    expect(screen.getByText('Bísí Adé')).toBeTruthy();
    expect(screen.queryByText('Amara Eze')).toBeNull();
  });

  it('keeps no guest’s name in the browser’s storage', async () => {
    signedIn();
    at('/door/ev_1', {
      'GET /api/events/ev_1/check-in': () => json(list(true)),
      'GET /api/events/ev_1/my-night': () => json(NIGHT),
    });
    await screen.findByText('Amara Eze');

    const kept = [localStorage, sessionStorage].flatMap((store) =>
      Object.keys(store).map((key) => `${key}=${store.getItem(key) ?? ''}`),
    );
    expect(kept.join('\n')).not.toMatch(/Amara|Bísí/);
  });

  it('shows the link page in the list’s place once the grant has ended', async () => {
    signedIn();
    at('/door/ev_1', {
      'GET /api/events/ev_1/check-in': () => json(REFUSED(404), 404),
    });

    expect(await screen.findByText('This link does not work.')).toBeTruthy();
    expect(screen.queryByText('Amara Eze')).toBeNull();
  });

  it('goes back to the shift page once the job is moved to Can view', async () => {
    signedIn();
    at('/door/ev_1', {
      'GET /api/events/ev_1/check-in': () => json(REFUSED(403), 403),
      'GET /api/events/ev_1/my-night': () => json({ ...NIGHT, checksIn: false }),
    });

    await waitFor(() => expect(router.state.location.pathname).toBe('/night/ev_1'));
  });

  it('names nobody to a browser that is not signed in', async () => {
    tokens.clear();
    __setSessionState({ status: 'signedOut', ended: false });
    const sent = at('/door/ev_1', {});

    expect(await screen.findByRole('link', { name: /door code/i })).toBeTruthy();
    expect(sent.filter((line) => line.includes('check-in'))).toEqual([]);
  });
});

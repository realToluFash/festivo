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

/** A door code's grant on the event, as /api/me's outsideEvents lists it. */
const HELD = {
  id: 'ev_1',
  name: 'Joana & Rui’s wedding',
  organisationName: 'Lumen Feiras',
  role: 'can_check_in',
  jobLabel: 'Bar and drinks',
  startsAt: '2030-11-14T15:00:00+00:00',
  endsAt: '2030-11-14T23:30:00+00:00',
  timeZone: 'Europe/Lisbon',
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

function signedIn(outsideEvents: unknown[] = []): void {
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
      outsideEvents,
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
  vi.unstubAllGlobals();
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

  it('keeps no guest’s name in the browser after a search, an arrival and a walk-in', async () => {
    signedIn();
    const opened = { indexedDB: vi.fn(), caches: vi.fn() };
    vi.stubGlobal('indexedDB', { open: opened.indexedDB });
    vi.stubGlobal('caches', { open: opened.caches });
    let arrived = false;
    const walkIn = {
      id: 'g_ze',
      fullName: 'Zé Novo',
      reply: 'coming',
      arrival: { at: '2030-11-14T19:10:00+00:00', by: 'Kemi Okafor' },
      companions: [],
    };
    const sent = at('/door/ev_1', {
      'GET /api/events/ev_1/check-in': () => json(list(arrived)),
      'GET /api/events/ev_1/my-night': () => json(NIGHT),
      'POST /api/events/ev_1/check-in/arrivals': () => {
        arrived = true;
        return json(list(true));
      },
      'POST /api/events/ev_1/check-in/walk-ins': () => {
        const now = list(true);

        return json({
          ...now,
          guests: [...(now.guests as unknown[]), walkIn],
          walkIn: { id: 'g_ze' },
        });
      },
    });

    const search = await screen.findByLabelText('Search by name');
    fireEvent.change(search, { target: { value: 'amara' } });
    fireEvent.click(screen.getByRole('button', { name: 'Arrived: Amara Eze' }));
    await waitFor(() => expect(sent).toContain('POST /api/events/ev_1/check-in/arrivals'));

    fireEvent.change(search, { target: { value: 'Zé Novo' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Add walk-in' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Add and mark arrived' }));
    await waitFor(() => expect(sent).toContain('POST /api/events/ev_1/check-in/walk-ins'));

    router.dispose();
    const kept = [localStorage, sessionStorage].flatMap((store) =>
      Object.keys(store).map((key) => `${key}=${store.getItem(key) ?? ''}`),
    );
    expect([...kept, document.cookie].join('\n')).not.toMatch(/Amara|Bísí|Zé|amara/);
    expect(opened.indexedDB).not.toHaveBeenCalled();
    expect(opened.caches).not.toHaveBeenCalled();
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

  it('leads a door code’s holder back to "You’re in for…" when they hold no shift here', async () => {
    signedIn([HELD]);
    at('/door/ev_1', {
      'GET /api/events/ev_1/check-in': () => json(list()),
      'GET /api/events/ev_1/my-night': () => json(REFUSED(404), 404),
    });

    const back = await screen.findByRole('link', { name: /Joana & Rui’s wedding/ });
    expect(back.getAttribute('href')).toBe('/d/in/ev_1');
    expect(screen.queryByRole('link', { name: /Your shift/ })).toBeNull();
  });

  it('asks the shift page again when it did not answer, rather than taking the door code’s way', async () => {
    signedIn([HELD]);
    let fails = true;
    at('/door/ev_1', {
      'GET /api/events/ev_1/check-in': () => json(list()),
      'GET /api/events/ev_1/my-night': () => (fails ? json(REFUSED(500), 500) : json(NIGHT)),
    });
    await screen.findByText('Amara Eze');
    expect(screen.queryByRole('link', { name: /Joana & Rui’s wedding/ })).toBeNull();

    fails = false;
    expect(
      (await screen.findByRole('link', { name: /Your shift/ }, { timeout: 7_000 })).getAttribute(
        'href',
      ),
    ).toBe('/night/ev_1');
  }, 10_000);
});

describe('Sign out on the shift page check-in leads back to (sc-28230)', () => {
  it('stays at its address and shows the not-signed-in page with Signed out. as a status', async () => {
    signedIn();
    at('/night/ev_1', {
      'GET /api/events/ev_1/my-night': () => json(NIGHT),
      'POST /api/auth/logout': () => json({}),
    });

    const [signOut] = await screen.findAllByRole('button', { name: 'Sign out' });
    fireEvent.click(signOut ?? document.body);

    const heading = await screen.findByRole('heading', { name: 'Sign in from your link or code' });
    expect(document.activeElement).toBe(heading);
    expect(screen.getByRole('status').textContent).toBe('Signed out.');
    expect(screen.getByRole('link', { name: 'Enter a door code' })).toBeTruthy();
    expect(router.state.location.pathname).toBe('/night/ev_1');
  });

  it('reads no Signed out. when opened signed out', async () => {
    tokens.clear();
    __setSessionState({ status: 'signedOut', ended: false });
    at('/night/ev_1', {});

    const heading = await screen.findByRole('heading', { name: 'Sign in from your link or code' });
    expect(document.activeElement).not.toBe(heading);
    expect(screen.queryByText('Signed out.')).toBeNull();
  });

  it('stays signed in and says so when the sign-out does not reach Soirely', async () => {
    signedIn();
    at('/night/ev_1', {
      'GET /api/events/ev_1/my-night': () => json(NIGHT),
      'POST /api/auth/logout': () => {
        throw new TypeError('Failed to fetch');
      },
    });

    const [signOut] = await screen.findAllByRole('button', { name: 'Sign out' });
    fireEvent.click(signOut ?? document.body);

    const [alert] = await screen.findAllByRole('alert');
    expect(alert?.textContent).toMatch(/You are still signed in/);
    expect(screen.getAllByText('Signed in as Kemi Okafor')).not.toHaveLength(0);
    expect(screen.queryByText('Signed out.')).toBeNull();
  });
});

describe('the web shift page leads to check-in (sc-28230)', () => {
  it('shows Check-in to a job that checks guests in', async () => {
    signedIn();
    at('/night/ev_1', { 'GET /api/events/ev_1/my-night': () => json(NIGHT) });

    expect((await screen.findByRole('link', { name: 'Check-in' })).getAttribute('href')).toBe(
      '/door/ev_1',
    );
  });

  it('shows no Check-in to a job that cannot', async () => {
    signedIn();
    at('/night/ev_1', {
      'GET /api/events/ev_1/my-night': () => json({ ...NIGHT, checksIn: false }),
    });

    expect(await screen.findByText(/Joana & Rui’s wedding/)).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Check-in' })).toBeNull();
  });
});

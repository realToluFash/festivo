import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import i18next from 'i18next';
import { useEffect, useState } from 'react';
import { Link, RouterProvider, createMemoryRouter, useNavigate } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { setLanguage } from './i18n/index.ts';
import { ArrivalNotice, PageArrival } from './components/PageArrival.tsx';
import { UNASKED } from './pageArrival.ts';
import { __setSessionState, forgetSession, type Session } from './session.ts';
import { membership } from './test-memberships.ts';
import { pageTitle, usePageTitle } from './pageTitle.ts';
import { routes } from './routes/index.tsx';

function Page({ heading, to }: { heading: string; to?: string }) {
  return (
    <main>
      <h1>{heading}</h1>
      {to != null && <Link to={to}>Onwards</Link>}
    </main>
  );
}

function Later() {
  const [shown, setShown] = useState(false);

  return shown ? (
    <h1>Arrived</h1>
  ) : (
    <button type="button" onClick={() => setShown(true)}>
      Show it
    </button>
  );
}

function SentOn() {
  const navigate = useNavigate();

  useEffect(() => {
    void navigate('/two', { replace: true, state: UNASKED });
  }, [navigate]);

  return null;
}

function Named() {
  usePageTitle(pageTitle(i18next.t, ['Members', 'Settings']));

  return <h1>Ada Okonkwo</h1>;
}

function Failed() {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    void Promise.resolve().then(() => setFailed(true));
  }, []);

  return failed ? (
    <ArrivalNotice
      role="alert"
      line="The event did not load."
      lineRef={null}
      focusable
      retry="Try again"
      onRetry={() => {}}
    />
  ) : (
    <p>Loading the event…</p>
  );
}

function site(initial = '/one') {
  const router = createMemoryRouter(
    [
      {
        element: <PageArrival />,
        children: [
          { path: '/one', element: <Page heading="One" to="/two" /> },
          { path: '/two', element: <Page heading="Two" to="/one" /> },
          { path: '/later', element: <Later /> },
          { path: '/sent-on', element: <SentOn /> },
          { path: '/named', element: <Named /> },
          { path: '/failed', element: <Failed /> },
          { path: '/plain', element: <p>Nothing to name it</p> },
        ],
      },
    ],
    { initialEntries: [initial] },
  );

  render(<RouterProvider router={router} />);

  return router;
}

/** A click that sends the person on once its answer comes, as Sign in does. */
async function clickThen(router: ReturnType<typeof site>, path: string): Promise<void> {
  fireEvent.click(document.body);
  await act(() => router.navigate(path));
}

afterEach(async () => {
  await setLanguage('en');
});

describe('opening another page (sc-11370)', () => {
  it('leaves focus alone on the page a tab opens on, and titles it with its heading', () => {
    site();

    expect(document.activeElement).toBe(document.body);
    expect(document.title).toBe('One – Soirely');
  });

  it('takes focus to the new heading after a click, and titles the tab with it', async () => {
    site();

    fireEvent.click(screen.getByRole('link', { name: 'Onwards' }));

    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('heading')));
    expect(screen.getByRole('heading').textContent).toBe('Two');
    expect(document.title).toBe('Two – Soirely');
  });

  it('takes focus to the heading of the page Back shows', async () => {
    const router = site();

    fireEvent.click(screen.getByRole('link', { name: 'Onwards' }));
    await screen.findByRole('heading', { name: 'Two' });
    act(() => screen.getByRole('link', { name: 'Onwards' }).focus());

    await act(() => router.navigate(-1));

    expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'One' }));
  });

  it('waits for a heading that shows later', async () => {
    const router = site();

    await clickThen(router, '/later');
    fireEvent.click(screen.getByRole('button', { name: 'Show it' }));

    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'Arrived' })),
    );
  });

  it('leaves focus where the person put it while the page was loading', async () => {
    const router = site();

    await clickThen(router, '/later');
    const button = screen.getByRole('button', { name: 'Show it' });
    fireEvent.pointerDown(button);
    act(() => button.focus());
    fireEvent.click(button);

    await screen.findByRole('heading', { name: 'Arrived' });
    expect(document.activeElement).not.toBe(screen.getByRole('heading', { name: 'Arrived' }));
  });

  it('leaves focus alone on a page change nobody asked for', async () => {
    const router = site();

    await act(() => router.navigate('/sent-on'));

    expect(await screen.findByRole('heading', { name: 'Two' })).toBeDefined();
    expect(document.activeElement).toBe(document.body);
  });

  it('takes focus to the line that says the page did not load, which is then not also an alert', async () => {
    const router = site();

    await clickThen(router, '/failed');

    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByText('The event did not load.')),
    );
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('keeps the alert of a notice on the page a tab opens on', async () => {
    site('/failed');

    expect((await screen.findByRole('alert')).textContent).toContain('The event did not load.');
  });

  it('titles the tab with what the page names, over its heading', () => {
    site('/named');

    expect(document.title).toBe('Members – Settings – Soirely');
  });

  it('titles a page with no heading Soirely', () => {
    site('/plain');

    expect(document.title).toBe('Soirely');
  });

  it('titles the tab in the language the page is shown in', async () => {
    await setLanguage('fr');

    expect(
      pageTitle(i18next.t, [i18next.t('settings.sectionRoles'), i18next.t('nav.settings')]),
    ).toBe('Rôles – Paramètres – Soirely');
  });
});

describe('the pages Soirely has', () => {
  function at(path: string) {
    const router = createMemoryRouter(routes, { initialEntries: [path] });

    render(<RouterProvider router={router} />);

    return router;
  }

  it('takes focus from Sign in to Reset your password, and titles both', async () => {
    at('/sign-in');

    expect(document.title).toBe('Sign in – Soirely');
    fireEvent.click(screen.getByRole('link', { name: 'Forgot it?' }));

    const heading = await screen.findByRole('heading', { level: 1, name: 'Reset your password' });
    await waitFor(() => expect(document.activeElement).toBe(heading));
    expect(document.title).toBe('Reset your password – Soirely');
  });

  it('titles the home page Soirely, though its heading is the tagline', () => {
    at('/');

    expect(document.title).toBe('Soirely');
  });
});

describe('the pages Soirely has, signed in', () => {
  const IRE = membership({ id: 'org_1', name: 'Ìrè Events' });
  const FOLAKE: Session = {
    name: 'Folake Adeyemi',
    email: 'folake@ire.events',
    verified: true,
    complete: true,
    awaiting: null,
    providers: [],
    userId: 'u1',
    needsOrganisation: false,
    hasPassword: true,
    organisation: IRE,
    organisations: [IRE],
    organisationCountry: null,
    timezone: null,
    waitingFor: null,
  };
  const EVENT = {
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
    hosts: ['Funmi Adeyemi'],
    madeLiveAt: null,
    pausedAt: null,
    phase: 'draft',
    concludedAt: null,
    createdAt: '2026-10-21T09:00:00+00:00',
  };

  function at(path: string) {
    const router = createMemoryRouter(routes, { initialEntries: [path] });

    render(<RouterProvider router={router} />);

    return router;
  }

  beforeEach(() => {
    __setSessionState({ status: 'signedIn', session: FOLAKE });
    // The event answers; every other request stays in flight, so each page shows as it loads.
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) =>
      new URL(String(input)).pathname === '/api/events/ev_1'
        ? Promise.resolve(
            new Response(JSON.stringify({ event: EVENT }), { headers: { ETag: '"1"' } }),
          )
        : new Promise<Response>(() => {}),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    ['/app/settings', 'General – Settings – Soirely'],
    ['/app/settings/members', 'Members – Settings – Soirely'],
    ['/app/settings/roles', 'Roles – Settings – Soirely'],
    ['/app/settings/sign-in-rules', 'Sign-in rules – Settings – Soirely'],
    ['/app/account', 'Account – Your account – Soirely'],
    ['/app/account/security', 'Security – Your account – Soirely'],
  ])('titles %s "%s"', async (path, title) => {
    at(path);

    await waitFor(() => expect(document.title).toBe(title));
  });

  it.each([
    ['/app/events/ev_1/edit', 'Edit details – Adaeze and Tunde – Soirely'],
    ['/app/events/ev_1/guests', 'Guests – Adaeze and Tunde – Soirely'],
  ])('titles %s "%s" once the event loads', async (path, title) => {
    at(path);

    await waitFor(() => expect(document.title).toBe(title));
  });

  it("titles a paused organisation's page with Paused and its name", async () => {
    const { id, name, countryCode, currency, timezone, contactAddress, locale } = membership({
      id: 'org_3',
      name: 'Lagos Weddings',
    });
    __setSessionState({
      status: 'signedIn',
      session: {
        ...FOLAKE,
        pausedIn: {
          id,
          name,
          countryCode,
          currency,
          timezone,
          contactAddress,
          locale,
          suspension: {
            reason: 'address_gone',
            domain: 'lagosweddings.ng',
            since: { at: '2026-10-16T08:40:00+00:00', written: 'Friday, Oct 16 at 09:40 WAT' },
            removesAt: null,
            onlyOwner: false,
          },
          ownerClaim: null,
        },
      },
    });

    at('/app/events');

    await waitFor(() => expect(document.title).toBe('Paused – Lagos Weddings – Soirely'));
  });

  it('titles the page Cannot reach Soirely when the API does not answer', async () => {
    __setSessionState({ status: 'unreachable', retrying: false });

    at('/app');

    await waitFor(() => expect(document.title).toBe('Cannot reach Soirely'));
  });

  it('takes focus within Your account to the section opened, and back again', async () => {
    const router = at('/app');

    fireEvent.click(screen.getByRole('link', { name: 'Your account' }));
    const heading = await screen.findByRole('heading', { level: 1, name: 'Your account' });
    await waitFor(() => expect(document.activeElement).toBe(heading));

    fireEvent.click(screen.getByRole('link', { name: 'Security' }));
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Security' })),
    );
    expect(document.activeElement?.getAttribute('aria-current')).toBe('page');

    await act(() => router.navigate(-1));

    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Account' })),
    );
  });

  it('takes focus to the line, not its Try again, when an event opened after a click does not load', async () => {
    vi.mocked(fetch).mockImplementation((input) =>
      new URL(String(input)).pathname === '/api/events/ev_1'
        ? Promise.reject(new TypeError('Failed to fetch'))
        : new Promise<Response>(() => {}),
    );
    const router = at('/app');

    fireEvent.click(document.body);
    await act(() => router.navigate('/app/events/ev_1'));

    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByText('The event did not load. Try again in a moment.'),
      ),
    );
  });

  describe('opening Edit details by a click while the event loads (sc-23303)', () => {
    function held(): { answer: (response: Response) => void } {
      let answer: (response: Response) => void = () => {};
      const event = new Promise<Response>((resolve) => {
        answer = resolve;
      });

      vi.mocked(fetch).mockImplementation((input) =>
        new URL(String(input)).pathname === '/api/events/ev_1'
          ? event
          : new Promise<Response>(() => {}),
      );

      return { answer };
    }

    async function openedByClick(): Promise<void> {
      const router = at('/app');
      fireEvent.click(document.body);
      await act(() => router.navigate('/app/events/ev_1/edit'));
      await screen.findByRole('heading', { level: 1, name: 'Edit details' });
      expect(document.activeElement).toBe(document.body);
    }

    it('takes focus to the heading of the form once it arrives', async () => {
      const { answer } = held();
      await openedByClick();

      answer(new Response(JSON.stringify({ event: EVENT }), { headers: { ETag: '"1"' } }));

      await waitFor(() => expect(document.querySelector('[aria-busy="true"]')).toBeNull());
      await waitFor(() =>
        expect(document.activeElement).toBe(screen.getByRole('heading', { level: 1 })),
      );
    });

    it('takes focus to the line that says the event did not load', async () => {
      const { answer } = held();
      await openedByClick();

      answer(new Response('{}', { status: 500 }));

      await waitFor(() =>
        expect(document.activeElement).toBe(
          screen.getByText('The event did not load. Try again in a moment.'),
        ),
      );
    });
  });

  it('leaves focus alone on Sign in when the session ends after a click', async () => {
    at('/app/events');

    fireEvent.click(document.body);
    act(() => forgetSession(true));

    expect(await screen.findByText('You were signed out')).toBeDefined();
    expect(document.activeElement).toBe(document.body);
  });
});

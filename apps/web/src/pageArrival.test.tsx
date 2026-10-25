import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useEffect, useState } from 'react';
import { Link, RouterProvider, createMemoryRouter, useNavigate } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ArrivalNotice, PageArrival } from './components/PageArrival.tsx';
import { UNASKED } from './pageArrival.ts';
import { __setSessionState, forgetSession, type Session } from './session.ts';
import { membership } from './test-memberships.ts';
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

function Failed() {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    void Promise.resolve().then(() => setFailed(true));
  }, []);

  return failed ? (
    <ArrivalNotice className="notice" role="alert">
      The event did not load.
    </ArrivalNotice>
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
          { path: '/failed', element: <Failed /> },
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

describe('opening another page (sc-11370)', () => {
  it('leaves focus alone on the page a tab opens on', () => {
    site();

    expect(document.activeElement).toBe(document.body);
  });

  it('takes focus to the new heading after a click', async () => {
    site();

    fireEvent.click(screen.getByRole('link', { name: 'Onwards' }));

    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('heading')));
    expect(screen.getByRole('heading').textContent).toBe('Two');
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

  it('takes focus to a notice that says the page did not load, which is then not also an alert', async () => {
    const router = site();

    await clickThen(router, '/failed');

    await waitFor(() =>
      expect(document.activeElement?.textContent).toBe('The event did not load.'),
    );
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('keeps the alert of a notice on the page a tab opens on', async () => {
    site('/failed');

    expect((await screen.findByRole('alert')).textContent).toBe('The event did not load.');
  });
});

describe('the pages Soirely has', () => {
  function at(path: string) {
    const router = createMemoryRouter(routes, { initialEntries: [path] });

    render(<RouterProvider router={router} />);

    return router;
  }

  it('takes focus from Sign in to Reset your password', async () => {
    at('/sign-in');

    fireEvent.click(screen.getByRole('link', { name: 'Forgot your password?' }));

    const heading = await screen.findByRole('heading', { level: 1, name: 'Reset your password' });
    await waitFor(() => expect(document.activeElement).toBe(heading));
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
    needsOrganisation: false,
    hasPassword: true,
    organisation: IRE,
    organisations: [IRE],
    organisationCountry: null,
    timezone: null,
    waitingFor: null,
  };

  function at(path: string) {
    const router = createMemoryRouter(routes, { initialEntries: [path] });

    render(<RouterProvider router={router} />);

    return router;
  }

  beforeEach(() => {
    __setSessionState({ status: 'signedIn', session: FOLAKE });
    // Every request stays in flight, so each page shows as it loads.
    vi.spyOn(globalThis, 'fetch').mockImplementation(() => new Promise<Response>(() => {}));
  });

  afterEach(() => {
    vi.restoreAllMocks();
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

  it('leaves focus alone on Sign in when the session ends after a click', async () => {
    at('/app/events');

    fireEvent.click(document.body);
    act(() => forgetSession(true));

    expect(await screen.findByText('You were signed out')).toBeDefined();
    expect(document.activeElement).toBe(document.body);
  });
});

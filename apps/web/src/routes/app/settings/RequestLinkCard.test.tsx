import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { __setSessionState, type Session } from '../../../session.ts';
import { membership } from '../../../test-memberships.ts';
import { routes } from '../../index.tsx';

const IRE = membership({ id: 'org_1', name: 'Ìrè Events' });

function settings(organisation = IRE) {
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

  return render(
    <RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/app/settings'] })} />,
  );
}

function answering(answers: Record<string, (body: unknown) => Response>) {
  const sent: { method: string; path: string; body: unknown }[] = [];

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const method = init?.method ?? 'GET';
    const path = decodeURIComponent(new URL(String(input)).pathname);
    const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : null;
    sent.push({ method, path, body });

    const answer = answers[`${method} ${path}`];
    if (answer == null) throw new TypeError('Failed to fetch');

    return answer(body);
  });

  return sent;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const DOMAINS = { domains: [], most: 5, ownAddress: 'folake@ire.events' };
const URL_ON = 'https://soirely.test/join/' + 'cd'.repeat(16);

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Settings > General > Requests to join (sc-562)', () => {
  it('is off until somebody turns it on, and then shows the link in full', async () => {
    const sent = answering({
      'GET /api/orgs/org_1/domains': () => json(DOMAINS),
      'GET /api/orgs/org_1/request-link': () => json({ on: false, url: null }),
      'PUT /api/orgs/org_1/request-link': () => json({ on: true, url: URL_ON }),
    });
    settings();

    const toggle = await screen.findByRole('switch', { name: 'Requests to join' });
    expect(toggle.getAttribute('aria-checked')).toBe('false');
    expect(screen.queryByLabelText('Request link')).toBeNull();

    fireEvent.click(toggle);

    expect(((await screen.findByLabelText('Request link')) as HTMLInputElement).value).toBe(URL_ON);
    expect(sent.some((one) => one.method === 'PUT')).toBe(true);
  });

  it('asks before replacing the link, since the old one stops at once', async () => {
    const sent = answering({
      'GET /api/orgs/org_1/domains': () => json(DOMAINS),
      'GET /api/orgs/org_1/request-link': () => json({ on: true, url: URL_ON }),
      'POST /api/orgs/org_1/request-link/replace': () =>
        json({ on: true, url: 'https://soirely.test/join/' + 'ef'.repeat(16) }),
    });
    settings();

    fireEvent.click(await screen.findByRole('button', { name: 'Replace link…' }));
    expect(screen.getByText('This link stops working as soon as you replace it.')).toBeDefined();
    expect(sent.some((one) => one.path.endsWith('/replace'))).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Replace link' }));

    expect(
      await screen.findByText('The link is replaced. The old one no longer works.'),
    ).toBeDefined();
    await waitFor(() => expect(sent.some((one) => one.path.endsWith('/replace'))).toBe(true));
  });

  it('puts focus back on Replace link after Keep it (sc-11369)', async () => {
    answering({
      'GET /api/orgs/org_1/domains': () => json(DOMAINS),
      'GET /api/orgs/org_1/request-link': () => json({ on: true, url: URL_ON }),
    });
    settings();

    fireEvent.click(await screen.findByRole('button', { name: 'Replace link…' }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep it' }));

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Replace link…' }));
  });

  it('takes focus to the line that says the link is replaced (sc-11369)', async () => {
    answering({
      'GET /api/orgs/org_1/domains': () => json(DOMAINS),
      'GET /api/orgs/org_1/request-link': () => json({ on: true, url: URL_ON }),
      'POST /api/orgs/org_1/request-link/replace': () =>
        json({ on: true, url: 'https://soirely.test/join/' + 'ef'.repeat(16) }),
    });
    settings();

    fireEvent.click(await screen.findByRole('button', { name: 'Replace link…' }));
    fireEvent.click(screen.getByRole('button', { name: 'Replace link' }));

    const notice = (
      await screen.findByText('The link is replaced. The old one no longer works.')
    ).closest('.notice');
    await waitFor(() => expect(document.activeElement).toBe(notice));
    expect(notice?.getAttribute('role')).toBeNull();
  });

  it('takes focus to the line that says replacing did not work, with no connection (sc-11369)', async () => {
    answering({
      'GET /api/orgs/org_1/domains': () => json(DOMAINS),
      'GET /api/orgs/org_1/request-link': () => json({ on: true, url: URL_ON }),
    });
    settings();

    fireEvent.click(await screen.findByRole('button', { name: 'Replace link…' }));
    fireEvent.click(screen.getByRole('button', { name: 'Replace link' }));

    const notice = (await screen.findByText('That did not work. Try again in a moment.')).closest(
      '.notice',
    );
    await waitFor(() => expect(document.activeElement).toBe(notice));
    expect(notice?.getAttribute('role')).toBeNull();
  });

  it('is not shown to a role that cannot manage members', async () => {
    answering({});
    settings(membership({ id: 'org_1', name: 'Ìrè Events', permissions: [] }));

    expect(await screen.findByRole('heading', { level: 1 })).toBeDefined();
    expect(screen.queryByRole('switch', { name: 'Requests to join' })).toBeNull();
  });
});

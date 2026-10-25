import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { __setSessionState, type Session } from '../../../session.ts';
import { OWNER_PERMISSIONS, membership } from '../../../test-memberships.ts';
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

function listed(domains: { domain: string; stopped: boolean }[]) {
  return { domains, most: 5, ownAddress: 'folake@ire.events' };
}

async function removing(domain: string) {
  fireEvent.click(await screen.findByRole('button', { name: `Remove ${domain}` }));
  const confirm = screen.getAllByRole('button', { name: `Remove ${domain}` }).at(-1);
  if (confirm != null) fireEvent.click(confirm);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Settings > General > Company domain joining (sc-561)', () => {
  it('is off until a domain is listed, and says which address it must be', async () => {
    answering({ 'GET /api/orgs/org_1/domains': () => json(listed([])) });
    settings();

    expect(await screen.findByRole('heading', { name: 'Company domain joining' })).toBeDefined();
    expect(screen.getByText('Off')).toBeDefined();
    expect(
      screen.getByText(
        'Only a domain your own address is at. Yours is folake@ire.events. Up to 5 domains.',
      ),
    ).toBeDefined();
  });

  it('is not shown to a role that cannot manage members', () => {
    const sent = answering({});
    settings(
      membership({
        permissions: OWNER_PERMISSIONS.filter((one) => one !== 'members.manage'),
      }),
    );

    expect(screen.queryByRole('heading', { name: 'Company domain joining' })).toBeNull();
    expect(sent.some((request) => request.path.endsWith('/domains'))).toBe(false);
  });

  it('checks a domain before sending it', async () => {
    const sent = answering({ 'GET /api/orgs/org_1/domains': () => json(listed([])) });
    settings();

    fireEvent.click(await screen.findByRole('button', { name: 'Add domain' }));
    expect(screen.getByText('Enter a domain, like ire.events.')).toBeDefined();

    fireEvent.change(screen.getByLabelText('Add a domain'), { target: { value: 'ire events' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add domain' }));
    expect(
      screen.getByText('Enter a domain with a dot and no spaces, like ire.events.'),
    ).toBeDefined();
    expect(sent.filter((request) => request.method === 'POST')).toEqual([]);
  });

  it('adds a domain and turns on', async () => {
    const sent = answering({
      'GET /api/orgs/org_1/domains': () => json(listed([])),
      'POST /api/orgs/org_1/domains': () =>
        json(listed([{ domain: 'ire.events', stopped: false }]), 201),
    });
    settings();

    fireEvent.change(await screen.findByLabelText('Add a domain'), {
      target: { value: ' IRE.events ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add domain' }));

    expect(await screen.findByText('ire.events added.')).toBeDefined();
    expect(screen.getByText('On')).toBeDefined();
    expect(sent.find((request) => request.method === 'POST')?.body).toEqual({
      domain: 'ire.events',
    });
  });

  it("shows the API's refusal under the field", async () => {
    answering({
      'GET /api/orgs/org_1/domains': () => json(listed([])),
      'POST /api/orgs/org_1/domains': () =>
        json(
          {
            type: 'https://soirely.com/errors/validation_failed',
            title: 'Validation failed',
            status: 422,
            violations: [
              {
                propertyPath: 'domain',
                message: 'Add a domain your own address is at.',
                code: 'validation_failed',
              },
            ],
          },
          422,
        ),
    });
    settings();

    fireEvent.change(await screen.findByLabelText('Add a domain'), {
      target: { value: 'okafor.family' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add domain' }));

    expect(await screen.findByText('Add a domain your own address is at.')).toBeDefined();
  });

  it('asks before removing a domain', async () => {
    const sent = answering({
      'GET /api/orgs/org_1/domains': () => json(listed([{ domain: 'ire.events', stopped: false }])),
      'DELETE /api/orgs/org_1/domains/ire.events': () => json(listed([])),
    });
    settings();

    fireEvent.click(await screen.findByRole('button', { name: 'Remove ire.events' }));
    expect(screen.getByRole('heading', { name: 'Remove ire.events?' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Keep it' }));
    expect(sent.some((request) => request.method === 'DELETE')).toBe(false);

    fireEvent.click(screen.getByRole('button', { name: 'Remove ire.events' }));
    const confirm = screen.getAllByRole('button', { name: 'Remove ire.events' }).at(-1);
    if (confirm != null) fireEvent.click(confirm);

    expect(await screen.findByText('ire.events removed.')).toBeDefined();
    await waitFor(() => expect(sent.some((request) => request.method === 'DELETE')).toBe(true));
  });

  it('says a domain another organisation proved has stopped, and that the list is full', async () => {
    answering({
      'GET /api/orgs/org_1/domains': () =>
        json(
          listed([
            { domain: 'ire.events', stopped: true },
            { domain: 'ire.ng', stopped: false },
            { domain: 'ire.co', stopped: false },
            { domain: 'ire-catering.com', stopped: false },
            { domain: 'ireweddings.com', stopped: false },
          ]),
        ),
    });
    settings();

    expect(await screen.findByText('Stopped')).toBeDefined();
    expect(
      screen.getByText(
        'Another organisation has proved ire.events on Enterprise, so its listing is the only one that works. Remove ire.events from this list.',
      ),
    ).toBeDefined();
    expect(
      screen.getByText('That is 5 domains, the most the list can hold. Remove one to add another.'),
    ).toBeDefined();
    expect(screen.queryByLabelText('Add a domain')).toBeNull();
  });

  it('forgets a failed add once the same add works (sc-11481)', async () => {
    let tries = 0;
    answering({
      'GET /api/orgs/org_1/domains': () => json(listed([])),
      'POST /api/orgs/org_1/domains': () => {
        tries += 1;
        if (tries === 1) throw new TypeError('Failed to fetch');
        return json(listed([{ domain: 'ire.events', stopped: false }]), 201);
      },
    });
    settings();

    const field = await screen.findByLabelText('Add a domain');
    fireEvent.change(field, { target: { value: 'ire.events' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add domain' }));
    expect(await screen.findByText('That did not work. Try again in a moment.')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Add domain' }));
    expect(await screen.findByText('ire.events added.')).toBeDefined();
    expect(screen.queryByText('That did not work. Try again in a moment.')).toBeNull();
    expect(field.getAttribute('aria-invalid')).toBe('false');
    expect(field.className).not.toContain('input-wrong');
    expect((field as HTMLInputElement).value).toBe('');
  });

  it('brings Add a domain back clean after an add that failed, then filled the list (sc-11481)', async () => {
    const four = [
      { domain: 'ire.ng', stopped: false },
      { domain: 'ire.co', stopped: false },
      { domain: 'ire-catering.com', stopped: false },
      { domain: 'ireweddings.com', stopped: false },
    ];
    let tries = 0;
    answering({
      'GET /api/orgs/org_1/domains': () => json(listed(four)),
      'POST /api/orgs/org_1/domains': () => {
        tries += 1;
        if (tries === 1) throw new TypeError('Failed to fetch');
        return json(listed([...four, { domain: 'ire.events', stopped: false }]), 201);
      },
      'DELETE /api/orgs/org_1/domains/ire.ng': () =>
        json(listed([...four.slice(1), { domain: 'ire.events', stopped: false }])),
    });
    settings();

    fireEvent.change(await screen.findByLabelText('Add a domain'), {
      target: { value: 'ire.events' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Add domain' }));
    expect(await screen.findByText('That did not work. Try again in a moment.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Add domain' }));
    expect(
      await screen.findByText(
        'That is 5 domains, the most the list can hold. Remove one to add another.',
      ),
    ).toBeDefined();

    await removing('ire.ng');

    expect(await screen.findByText('ire.ng removed.')).toBeDefined();
    const field = screen.getByLabelText('Add a domain');
    expect(screen.queryByText('That did not work. Try again in a moment.')).toBeNull();
    expect(field.getAttribute('aria-invalid')).toBe('false');
    expect((field as HTMLInputElement).value).toBe('');
  });

  it('leaves a failed add as it was after a removal that works (sc-11481)', async () => {
    answering({
      'GET /api/orgs/org_1/domains': () => json(listed([{ domain: 'ire.ng', stopped: false }])),
      'DELETE /api/orgs/org_1/domains/ire.ng': () => json(listed([])),
    });
    settings();

    const field = await screen.findByLabelText('Add a domain');
    fireEvent.change(field, { target: { value: 'ire.events' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add domain' }));
    expect(await screen.findByText('That did not work. Try again in a moment.')).toBeDefined();

    await removing('ire.ng');

    expect(await screen.findByText('ire.ng removed.')).toBeDefined();
    expect(screen.getByText('That did not work. Try again in a moment.')).toBeDefined();
    expect(field.getAttribute('aria-invalid')).toBe('true');
    expect((field as HTMLInputElement).value).toBe('ire.events');
  });

  describe('a removal that fails (sc-11339)', () => {
    const FIVE = [
      { domain: 'ire.events', stopped: false },
      { domain: 'ire.ng', stopped: false },
      { domain: 'ire.co', stopped: false },
      { domain: 'ire-catering.com', stopped: false },
      { domain: 'ireweddings.com', stopped: false },
    ];

    const scrolled = vi.fn();

    beforeEach(() => {
      scrolled.mockClear();
      Element.prototype.scrollIntoView = scrolled;
    });

    it('says so above the list when the list is full, and scrolls to it', async () => {
      answering({ 'GET /api/orgs/org_1/domains': () => json(listed(FIVE)) });
      settings();

      await removing('ireweddings.com');

      const alert = await screen.findByText('That did not work. Try again in a moment.');
      const notice = alert.closest('[role="alert"]');
      expect(notice?.classList.contains('notice-broken')).toBe(true);
      expect(screen.getByRole('list', { name: /domains/i }).previousElementSibling).toBe(notice);
      expect(screen.getByRole('button', { name: 'Remove ireweddings.com' }).textContent).toBe(
        'Remove',
      );
      expect(scrolled).toHaveBeenCalledWith({ block: 'nearest' });
      expect(scrolled.mock.contexts).toEqual([notice]);
    });

    it('leaves the add field alone, and a removal that works takes it away', async () => {
      let fails = true;
      answering({
        'GET /api/orgs/org_1/domains': () => json(listed(FIVE.slice(0, 2))),
        'DELETE /api/orgs/org_1/domains/ire.ng': () => {
          if (fails) throw new TypeError('Failed to fetch');
          return json(listed(FIVE.slice(0, 1)));
        },
      });
      settings();

      await removing('ire.ng');

      expect(await screen.findByText('That did not work. Try again in a moment.')).toBeDefined();
      const field = screen.getByLabelText('Add a domain');
      expect(field.getAttribute('aria-invalid')).toBe('false');
      expect(field.classList.contains('input-wrong')).toBe(false);

      fails = false;
      await removing('ire.ng');

      expect(await screen.findByText('ire.ng removed.')).toBeDefined();
      expect(screen.queryByText('That did not work. Try again in a moment.')).toBeNull();
      expect(screen.getByLabelText('Add a domain').getAttribute('aria-invalid')).toBe('false');
    });

    it('leaves the hidden add field alone when the list is full, and it comes back clean', async () => {
      let fails = true;
      answering({
        'GET /api/orgs/org_1/domains': () => json(listed(FIVE)),
        'DELETE /api/orgs/org_1/domains/ire.ng': () => {
          if (fails) throw new TypeError('Failed to fetch');
          return json(listed(FIVE.filter(({ domain }) => domain !== 'ire.ng')));
        },
      });
      settings();

      await removing('ire.ng');

      expect(await screen.findByText('That did not work. Try again in a moment.')).toBeDefined();
      expect(screen.queryByLabelText('Add a domain')).toBeNull();

      fails = false;
      await removing('ire.ng');

      expect(await screen.findByText('ire.ng removed.')).toBeDefined();
      expect(screen.queryByText('That did not work. Try again in a moment.')).toBeNull();
      const field = screen.getByLabelText('Add a domain');
      expect(field.getAttribute('aria-invalid')).toBe('false');
      expect(field.classList.contains('input-wrong')).toBe(false);
    });

    it('leaves a failed add as it was, beside its own failure (sc-11481)', async () => {
      answering({ 'GET /api/orgs/org_1/domains': () => json(listed(FIVE.slice(0, 2))) });
      settings();

      const field = await screen.findByLabelText('Add a domain');
      fireEvent.change(field, { target: { value: 'ire.events' } });
      fireEvent.click(screen.getByRole('button', { name: 'Add domain' }));
      expect(await screen.findByText('That did not work. Try again in a moment.')).toBeDefined();

      await removing('ire.ng');

      await waitFor(() =>
        expect(screen.getAllByText('That did not work. Try again in a moment.')).toHaveLength(2),
      );
      expect(field.getAttribute('aria-invalid')).toBe('true');
      expect((field as HTMLInputElement).value).toBe('ire.events');
    });

    it('stays through an add the card refuses without sending, and goes with one it sends', async () => {
      answering({
        'GET /api/orgs/org_1/domains': () => json(listed(FIVE.slice(0, 2))),
        'POST /api/orgs/org_1/domains': () => json(listed(FIVE.slice(0, 3)), 201),
      });
      settings();

      await removing('ire.ng');
      expect(await screen.findByText('That did not work. Try again in a moment.')).toBeDefined();

      fireEvent.click(screen.getByRole('button', { name: 'Add domain' }));
      expect(screen.getByText('Enter a domain, like ire.events.')).toBeDefined();
      expect(screen.getByText('That did not work. Try again in a moment.')).toBeDefined();

      fireEvent.change(screen.getByLabelText('Add a domain'), { target: { value: 'ire.co' } });
      fireEvent.click(screen.getByRole('button', { name: 'Add domain' }));

      expect(await screen.findByText('ire.co added.')).toBeDefined();
      expect(screen.queryByText('That did not work. Try again in a moment.')).toBeNull();
    });
  });
});

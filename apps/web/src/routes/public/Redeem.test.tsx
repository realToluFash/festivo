import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { __setSessionState } from '../../session.ts';
import { membership } from '../../test-memberships.ts';
import { tokens } from '../../tokens.ts';
import { routes } from '../index.tsx';

/** As RedeemController answers GET /api/door-codes/{code} (PR #3354's contract). */
const OPENED = {
  role: 'can_check_in',
  jobLabel: 'Bar and drinks',
  event: {
    id: 'ev_1',
    name: 'Joana & Rui’s wedding',
    startsAt: '2030-11-14T15:00:00+00:00',
    endsAt: '2030-11-14T23:30:00+00:00',
    timeZone: 'Europe/Lisbon',
    organisation: 'Lumen Feiras',
  },
  standing: null,
};

const REFUSED = {
  type: 'https://soirely.com/errors/door_code_invalid',
  title: 'That code does not work. Check it with whoever gave it to you.',
  status: 404,
  code: 'door_code_invalid',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function signedIn(): void {
  tokens.save({ accessToken: 'live', refreshExpiresAt: '', sessionId: 's' });
  const ire = membership({ id: 'org_2', name: 'Ìrè Events' });
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
      needsOrganisation: false,
      hasPassword: true,
      organisation: ire,
      organisations: [ire],
      organisationCountry: null,
      timezone: null,
      waitingFor: null,
    },
  });
}

function signedOut(): void {
  tokens.clear();
  __setSessionState({ status: 'signedOut', ended: false });
}

function at(
  path: string,
  answers: Record<string, () => Response>,
): { line: string; body: unknown }[] {
  const sent: { line: string; body: unknown }[] = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const line = `${init?.method ?? 'GET'} ${new URL(String(input)).pathname}`;
    sent.push({ line, body: typeof init?.body === 'string' ? JSON.parse(init.body) : null });

    return answers[line]?.() ?? json({});
  });
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />);

  return sent;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the browser’s redeem pages (sc-72)', () => {
  it('checks the code before it sends anything, in any case and with spaces ignored', async () => {
    signedOut();
    const sent = at('/d', {
      'GET /api/door-codes/K7P2QX9M': () => json(OPENED),
    });
    const field = await screen.findByLabelText('Door code');

    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText('Enter the door code.')).toBeDefined();

    fireEvent.change(field, { target: { value: 'k7p2 q' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText('A door code is 8 letters and numbers.')).toBeDefined();
    expect(sent.some((one) => one.line.startsWith('GET /api/door-codes'))).toBe(false);

    fireEvent.change(field, { target: { value: 'k7p2-qx9m' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Joana & Rui’s wedding' }),
    ).toBeDefined();
    expect(screen.getByText(/Lumen Feiras · Can check guests in · Bar and drinks$/u)).toBeDefined();
  });

  it('gives one refusal for a code that does not work, and keeps what was typed', async () => {
    signedOut();
    at('/d', { 'GET /api/door-codes/Q7KM4XP3': () => json(REFUSED, 404) });

    fireEvent.change(await screen.findByLabelText('Door code'), {
      target: { value: 'Q7KM 4XP3' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect((await screen.findByRole('alert')).textContent).toBe(
      'That code does not work. Check it with whoever gave it to you.',
    );
    expect(screen.getByLabelText('Door code')).toHaveProperty('value', 'Q7KM 4XP3');
  });

  it('says when too many tries were made, with the time the server gives', async () => {
    signedOut();
    at('/d/Q7KM4XP3', {
      'GET /api/door-codes/Q7KM4XP3': () =>
        json(
          {
            type: 'https://soirely.com/errors/too_many_attempts',
            title: 'Too many tries. Try again at 13:32 UTC.',
            status: 429,
            retryAt: 'at 13:32 UTC',
            code: 'too_many_attempts',
          },
          429,
        ),
    });

    expect(await screen.findByRole('heading', { level: 1, name: 'Too many tries' })).toBeDefined();
    expect(screen.getByText('Try again at 13:32 UTC.')).toBeDefined();
  });

  it('opens a code from the address and joins a signed-in person by their account', async () => {
    signedIn();
    const sent = at('/d/K7P2QX9M', {
      'GET /api/door-codes/K7P2QX9M': () => json(OPENED),
      'POST /api/door-codes/K7P2QX9M/redeem': () =>
        json(
          {
            eventId: 'ev_1',
            name: 'Kemi Okafor',
            role: 'can_check_in',
            jobLabel: 'Bar and drinks',
            endsAt: '2030-11-14T23:30:00+00:00',
            again: false,
          },
          201,
        ),
    });

    fireEvent.click(await screen.findByRole('button', { name: 'Join as Kemi Okafor' }));

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'You’re in for Joana & Rui’s wedding · Bar and drinks',
      }),
    ).toBeDefined();
    expect(screen.getByText('Access ends when the event concludes.')).toBeDefined();
    expect(screen.getByText('Signed in as Kemi Okafor')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Open the event' })).toBeDefined();
    await waitFor(() =>
      expect(sent.some((one) => one.line === 'POST /api/door-codes/K7P2QX9M/redeem')).toBe(true),
    );
  });

  it('turns a member of the organisation away, with Open Events', async () => {
    signedIn();
    at('/d/K7P2QX9M', {
      'GET /api/door-codes/K7P2QX9M': () => json({ ...OPENED, standing: 'member' }),
    });

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'You’re already a member of Lumen Feiras',
      }),
    ).toBeDefined();
    expect(
      screen.getByText(
        'Members open an event from its People page. Ask its lead or an admin to add you.',
      ),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: 'Open Events' })).toBeDefined();
  });
});

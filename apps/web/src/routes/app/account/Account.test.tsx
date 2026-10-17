import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { __setSessionState, type Session } from '../../../session.ts';
import { membership } from '../../../test-memberships.ts';
import { tokens } from '../../../tokens.ts';
import { routes } from '../../index.tsx';

const MEMBERSHIP = membership({ id: 'acc_1', name: 'Ire Events' });

const FOLAKE: Session = {
  name: 'Folake Ire',
  email: 'folake@ire.events',
  verified: true,
  complete: true,
  awaiting: null,
  providers: [],
  needsOrganisation: false,
  hasPassword: true,
  organisation: MEMBERSHIP,
  organisations: [MEMBERSHIP],
  organisationCountry: null,
  timezone: 'Africa/Lagos',
};

const ZONES = [
  { id: 'Africa/Lagos', city: 'Lagos', country: 'Nigeria', offset: '+01:00' },
  { id: 'Africa/Kinshasa', city: 'Kinshasa', country: 'Congo - Kinshasa', offset: '+01:00' },
  { id: 'Europe/London', city: 'London', country: 'United Kingdom', offset: '+01:00' },
];

interface Sent {
  call: string;
  body: unknown;
}

function answering(answers: Record<string, () => Response> = {}): Sent[] {
  const sent: Sent[] = [];

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const call = `${init?.method ?? 'GET'} ${new URL(String(input)).pathname}`;
    sent.push({ call, body: typeof init?.body === 'string' ? JSON.parse(init.body) : null });

    const answer =
      answers[call] ??
      (call === 'GET /api/auth/timezones' ? () => json({ timezones: ZONES }) : null);
    if (answer == null) throw new Error(`Nothing stubbed for ${call}`);

    return answer();
  });

  return sent;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function open(session: Partial<Session> = {}) {
  __setSessionState({ status: 'signedIn', session: { ...FOLAKE, ...session } });

  return render(
    <RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/app/account'] })} />,
  );
}

beforeEach(() => {
  tokens.save({ accessToken: 'live', refreshExpiresAt: '', sessionId: 's' });
});

afterEach(() => {
  vi.restoreAllMocks();
  __setSessionState({ status: 'unknown' });
  tokens.clear();
});

describe("the account's time zone", () => {
  it('shows the zone by its city and offset', async () => {
    answering();
    open();

    expect(await screen.findByText('Lagos (UTC+01:00)')).toBeDefined();
    expect(screen.getByRole('link', { name: 'Security' })).toBeDefined();
  });

  it('says times reach an account with none in UTC', () => {
    answering();
    open({ timezone: null });

    expect(screen.getByText('Not set: times reach you in UTC')).toBeDefined();
  });

  it('finds a zone by its country, picks it, and saves it', async () => {
    const sent = answering({
      'PUT /api/auth/timezone': () => json({ timezone: 'Europe/London' }),
      'GET /api/auth/me': () =>
        json({
          id: 'acc_1',
          name: 'Folake Ire',
          businessName: null,
          countryCode: null,
          locale: 'en',
          timezone: 'Europe/London',
          verified: true,
          complete: true,
          needsOrganisation: false,
          hasPassword: true,
          providers: [],
          emailAddresses: [
            { id: 'a1', address: 'folake@ire.events', verified: true, primary: true },
          ],
          phoneNumbers: [],
        }),
      'GET /api/orgs': () => json({ organisations: [] }),
    });
    open();

    fireEvent.click(await screen.findByRole('button', { name: 'Change' }));
    fireEvent.change(screen.getByLabelText('Find your time zone'), {
      target: { value: 'united kingdom' },
    });
    fireEvent.click(screen.getByRole('option', { name: /London \(UTC\+01:00\)/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Save time zone' }));

    expect(
      await screen.findByText(
        'Time zone changed to London (UTC+01:00). Times in your emails now use it.',
      ),
    ).toBeDefined();
    expect(sent.find((s) => s.call === 'PUT /api/auth/timezone')?.body).toEqual({
      timezone: 'Europe/London',
    });
  });

  it('sends nothing until a listed zone is picked', async () => {
    const sent = answering();
    open();

    fireEvent.click(await screen.findByRole('button', { name: 'Change' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save time zone' }));
    expect(screen.getByText('Choose a time zone from the list.')).toBeDefined();

    fireEvent.change(screen.getByLabelText('Find your time zone'), { target: { value: 'Lagso' } });
    expect(
      screen.getByText(
        'No time zone matches “Lagso”. Try a city, a country or an offset like UTC+01.',
      ),
    ).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Save time zone' }));
    expect(
      screen.getByText('Choose a time zone from the list. Nothing matches “Lagso”.'),
    ).toBeDefined();

    expect(sent.some((s) => s.call === 'PUT /api/auth/timezone')).toBe(false);
  });

  it("says when the server doesn't know the zone, and nothing is saved", async () => {
    answering({
      'PUT /api/auth/timezone': () =>
        new Response(
          JSON.stringify({
            type: 'https://soirely.com/errors/validation_failed',
            title: 'x',
            status: 422,
            violations: [{ propertyPath: 'timezone', message: 'x', code: 'validation_failed' }],
          }),
          { status: 422, headers: { 'Content-Type': 'application/problem+json' } },
        ),
    });
    open();

    fireEvent.click(await screen.findByRole('button', { name: 'Change' }));
    fireEvent.change(screen.getByLabelText('Find your time zone'), {
      target: { value: 'Kinshasa' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save time zone' }));

    await waitFor(() =>
      expect(
        screen.getByText(
          'That time zone isn’t one we know, so nothing was saved. Choose one from the list.',
        ),
      ).toBeDefined(),
    );
  });
});

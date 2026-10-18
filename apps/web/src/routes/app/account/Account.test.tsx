import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { setLanguage } from '../../../i18n/index.ts';
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
  {
    id: 'Asia/Kolkata',
    city: 'Kolkata',
    ianaCity: 'Kolkata',
    aliases: ['Calcutta'],
    formerName: 'Calcutta',
    country: 'India',
    offset: '+05:30',
  },
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

  it('finds a zone by a former name, and says only then which name it was', async () => {
    answering();
    open();

    fireEvent.click(await screen.findByRole('button', { name: 'Change' }));
    fireEvent.change(screen.getByLabelText('Find your time zone'), {
      target: { value: 'calcutta' },
    });
    expect(screen.getByRole('option', { name: /Kolkata \(UTC\+05:30\)/ }).textContent).toContain(
      'India · was Calcutta',
    );

    fireEvent.change(screen.getByLabelText('Find your time zone'), { target: { value: 'india' } });
    expect(screen.getByRole('option', { name: /Kolkata/ }).textContent).not.toContain('was');
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
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Change' }));
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

const ZONES_FR = [
  { id: 'Africa/Lagos', city: 'Lagos', country: 'Nigéria', offset: '+01:00' },
  { id: 'Europe/London', city: 'Londres', country: 'Royaume-Uni', offset: '+01:00' },
  {
    id: 'Asia/Kolkata',
    city: 'Calcutta',
    ianaCity: 'Kolkata',
    aliases: ['Kolkata'],
    country: 'Inde',
    offset: '+05:30',
  },
];

function answeringByLanguage(french: Promise<Response> | null = null): string[] {
  const asked: string[] = [];

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const call = `${init?.method ?? 'GET'} ${new URL(String(input)).pathname}`;
    if (call !== 'GET /api/auth/timezones') throw new Error(`Nothing stubbed for ${call}`);

    const language = new Headers(init?.headers).get('Accept-Language') ?? '';
    asked.push(language);

    if (language !== 'fr') return json({ timezones: ZONES });

    return french ?? json({ timezones: ZONES_FR });
  });

  return asked;
}

/** The header's language picker is a combobox too, and this one's label changes with the language. */
function zoneInput(): HTMLInputElement {
  return document.getElementById('tz-input') as HTMLInputElement;
}

describe('the time zone list after a language change', () => {
  afterEach(async () => {
    await act(() => setLanguage(null));
  });

  it('names the current zone in the new language with the card closed', async () => {
    const asked = answeringByLanguage();
    open({ timezone: 'Asia/Kolkata' });
    expect(await screen.findByText('Kolkata (UTC+05:30)')).toBeDefined();

    await act(() => setLanguage('fr'));

    expect(await screen.findByText('Calcutta (UTC+05:30)')).toBeDefined();
    expect(asked).toEqual(['en', 'fr']);
  });

  it('keeps the query and the rows shown until the new rows arrive, then shows those', async () => {
    let release: (response: Response) => void = () => {};
    answeringByLanguage(new Promise((resolve) => (release = resolve)));
    open();

    fireEvent.click(await screen.findByRole('button', { name: 'Change' }));
    fireEvent.change(zoneInput(), { target: { value: 'calcutta' } });
    expect(screen.getByRole('option', { name: /Kolkata \(UTC\+05:30\)/ }).textContent).toContain(
      'India · was Calcutta',
    );

    await act(() => setLanguage('fr'));

    expect(screen.getByLabelText('Trouvez votre fuseau horaire')).toBe(zoneInput());
    expect(screen.getByRole('option', { name: /Kolkata/ })).toBeDefined();
    expect(screen.queryByRole('status')).toBeNull();

    await act(async () => release(json({ timezones: ZONES_FR })));

    const row = await screen.findByRole('option', { name: /Calcutta \(UTC\+05:30\)/ });
    expect(row.textContent).toContain('Inde');
    expect(row.textContent).not.toContain('anciennement');
    expect(zoneInput().value).toBe('calcutta');

    await act(() => setLanguage('en'));

    expect(
      (await screen.findByRole('option', { name: /Kolkata \(UTC\+05:30\)/ })).textContent,
    ).toContain('India · was Calcutta');
  });

  it('keeps the rows shown when the new list cannot be fetched, and saves nothing', async () => {
    const asked = answeringByLanguage(
      Promise.resolve(json({ type: 'x', title: 'x', status: 500 }, 500)),
    );
    open();

    fireEvent.click(await screen.findByRole('button', { name: 'Change' }));
    fireEvent.change(zoneInput(), { target: { value: 'calcutta' } });

    await act(() => setLanguage('fr'));
    await waitFor(() => expect(asked).toEqual(['en', 'fr']));

    expect(screen.getByRole('option', { name: /Kolkata \(UTC\+05:30\)/ })).toBeDefined();
    expect(vi.mocked(fetch).mock.calls.some(([, init]) => (init?.method ?? 'GET') !== 'GET')).toBe(
      false,
    );
  });

  it('reads a picked zone in the new language', async () => {
    answeringByLanguage();
    open();

    fireEvent.click(await screen.findByRole('button', { name: 'Change' }));
    fireEvent.change(zoneInput(), { target: { value: 'united kingdom' } });
    fireEvent.click(screen.getByRole('option', { name: /London \(UTC\+01:00\)/ }));

    await act(() => setLanguage('fr'));

    await waitFor(() => expect(zoneInput().value).toBe('Londres (UTC+01:00)'));
  });
});

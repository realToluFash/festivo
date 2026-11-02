import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
  userId: 'u1',
  needsOrganisation: false,
  hasPassword: true,
  organisation: MEMBERSHIP,
  organisations: [MEMBERSHIP],
  organisationCountry: null,
  timezone: 'Africa/Lagos',
  waitingFor: null,
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

function me({ timezone, name = 'Folake Ire' }: { timezone: string; name?: string }): Response {
  return json({
    id: 'acc_1',
    name,
    businessName: null,
    countryCode: null,
    locale: 'en',
    timezone,
    verified: true,
    complete: true,
    userId: 'u1',
    needsOrganisation: false,
    hasPassword: true,
    providers: [],
    emailAddresses: [{ id: 'a1', address: 'folake@ire.events', verified: true, primary: true }],
    phoneNumbers: [],
  });
}

function open(session: Partial<Session> = {}) {
  __setSessionState({ status: 'signedIn', session: { ...FOLAKE, ...session } });

  return render(
    <RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/app/account'] })} />,
  );
}

/** The Time zone card's Change, not the Name card's above it. */
function zoneChange(): HTMLElement {
  return within(screen.getByRole('region', { name: 'Time zone' })).getByRole('button', {
    name: 'Change',
  });
}

/** Change waits with the zone's name for the list (sc-27219). */
async function findZoneChange(): Promise<HTMLElement> {
  return within(await screen.findByRole('region', { name: 'Time zone' })).findByRole('button', {
    name: 'Change',
  });
}

beforeEach(() => {
  tokens.save({ accessToken: 'live', refreshExpiresAt: '', sessionId: 's' });
});

afterEach(() => {
  vi.restoreAllMocks();
  tokens.clear();
});

describe('offline (sc-27088)', () => {
  it('draws the name and zone Try again fetched, not the ones from before the band', async () => {
    let reachable = true;
    let changedElsewhere = false;
    answering({
      'GET /api/auth/me': () => {
        if (!reachable) throw new TypeError('Failed to fetch');

        return changedElsewhere
          ? me({ timezone: 'Europe/London', name: 'Folake Adeyemi' })
          : me({ timezone: 'Africa/Lagos' });
      },
      'GET /api/auth/two-factor': () => json({ on: false }),
    });
    open();
    expect(await screen.findByText('Lagos (UTC+01:00)')).toBeDefined();

    reachable = false;
    act(() => {
      window.dispatchEvent(new Event('offline'));
    });
    await waitFor(() => expect(document.querySelector('.offline-band')).not.toBeNull());

    changedElsewhere = true;
    reachable = true;
    const band = document.querySelector('.offline-band') as HTMLElement;
    fireEvent.click(within(band).getByRole('button', { name: 'Try again' }));

    await waitFor(() => expect(document.querySelector('.offline-band')).toBeNull());
    const nameCard = screen.getByRole('region', { name: 'Name' });
    expect(within(nameCard).getByText('Folake Adeyemi')).toBeDefined();
    expect(await screen.findByText('London (UTC+01:00)')).toBeDefined();
  });
});

describe("the account's time zone", () => {
  it('shows the zone by its city and offset', async () => {
    answering();
    open();

    expect(await screen.findByText('Lagos (UTC+01:00)')).toBeDefined();
    expect(screen.getByRole('link', { name: 'Security' })).toBeDefined();
  });

  it('holds the zone row, Change with it, until the list names the zone (sc-27219)', async () => {
    let release: (response: Response) => void = () => {};
    answeringByLanguage(null, {}, new Promise((resolve) => (release = resolve)));
    open();

    const card = await screen.findByRole('region', { name: 'Time zone' });
    expect(within(card).getByText(/^Times in the emails/)).toBeDefined();
    expect(within(card).queryByText('Africa/Lagos')).toBeNull();
    expect(within(card).queryByRole('button', { name: 'Change' })).toBeNull();
    expect(card.querySelector('[aria-busy="true"]')).not.toBeNull();

    await act(async () => release(json({ timezones: ZONES })));

    expect(await within(card).findByText('Lagos (UTC+01:00)')).toBeDefined();
    expect(within(card).getByText('Africa/Lagos')).toBeDefined();
    expect(within(card).getByRole('button', { name: 'Change' })).toBeDefined();
  });

  it("names the zone by IANA's city when the list cannot be fetched", async () => {
    answering({ 'GET /api/auth/timezones': () => json({}, 500) });
    open();

    const card = await screen.findByRole('region', { name: 'Time zone' });
    expect(await within(card).findByText('Lagos')).toBeDefined();
    expect(within(card).getByText('Africa/Lagos')).toBeDefined();
    expect(within(card).getByRole('button', { name: 'Change' })).toBeDefined();
  });

  it('names a zone the list has no row for by its city, and an id with no slash once', async () => {
    answering();
    const { unmount } = open({ timezone: 'Asia/Calcutta' });

    const card = await screen.findByRole('region', { name: 'Time zone' });
    expect(await within(card).findByText('Calcutta')).toBeDefined();
    expect(within(card).getByText('Asia/Calcutta')).toBeDefined();
    unmount();

    answering();
    open({ timezone: 'UTC' });
    const utc = await screen.findByRole('region', { name: 'Time zone' });
    expect(await within(utc).findByText('UTC')).toBeDefined();
    expect(within(utc).getAllByText('UTC')).toHaveLength(1);
  });

  it('says times reach an account with none in UTC', () => {
    answering();
    open({ timezone: null });

    expect(screen.getByText('Not set: times reach you in UTC')).toBeDefined();
  });

  it('finds a zone by a former name, and says only then which name it was', async () => {
    answering();
    open();

    fireEvent.click(await findZoneChange());
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
      'GET /api/auth/me': () => me({ timezone: 'Europe/London' }),
      'GET /api/orgs': () => json({ organisations: [MEMBERSHIP] }),
    });
    open();

    fireEvent.click(await findZoneChange());
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
    const line = screen
      .getByText('Time zone changed to London (UTC+01:00). Times in your emails now use it.')
      .closest('.status-done');
    await waitFor(() => expect(document.activeElement).toBe(line));
    expect(line?.getAttribute('role')).toBeNull();
  });

  it('goes back to Change after Cancel, and after Escape in the search', async () => {
    answering();
    open();

    fireEvent.click(await findZoneChange());
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(document.activeElement).toBe(zoneChange());

    fireEvent.click(zoneChange());
    fireEvent.keyDown(screen.getByLabelText('Find your time zone'), { key: 'Escape' });
    expect(document.activeElement).toBe(zoneChange());
  });

  it('sends nothing until a listed zone is picked', async () => {
    const sent = answering();
    open();

    fireEvent.click(await findZoneChange());
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

    fireEvent.click(await findZoneChange());
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

function answeringByLanguage(
  french: Promise<Response> | null = null,
  answers: Record<string, () => Response> = {},
  english: Promise<Response> | null = null,
): string[] {
  const asked: string[] = [];

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const call = `${init?.method ?? 'GET'} ${new URL(String(input)).pathname}`;
    const answer = answers[call];
    if (answer != null) return answer();
    if (call !== 'GET /api/auth/timezones') throw new Error(`Nothing stubbed for ${call}`);

    const language = new Headers(init?.headers).get('Accept-Language') ?? '';
    asked.push(language);

    if (language !== 'fr') return english ?? json({ timezones: ZONES });

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
    let release: (response: Response) => void = () => {};
    const asked = answeringByLanguage(new Promise((resolve) => (release = resolve)));
    open({ timezone: 'Asia/Kolkata' });
    expect(await screen.findByText('Kolkata (UTC+05:30)')).toBeDefined();

    await act(() => setLanguage('fr'));

    // Until the French list comes, the name already shown stays, with neither the id nor a skeleton in its place (sc-27219).
    const card = screen.getByRole('region', { name: 'Fuseau horaire' });
    expect(within(card).getByText('Kolkata (UTC+05:30)')).toBeDefined();
    expect(card.querySelector('[aria-busy="true"]')).toBeNull();

    await act(async () => release(json({ timezones: ZONES_FR })));

    expect(await screen.findByText('Calcutta (UTC+05:30)')).toBeDefined();
    expect(asked).toEqual(['en', 'fr']);
  });

  it('keeps the query and the rows shown until the new rows arrive, then shows those', async () => {
    let release: (response: Response) => void = () => {};
    answeringByLanguage(new Promise((resolve) => (release = resolve)));
    open();

    fireEvent.click(await findZoneChange());
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

    fireEvent.click(await findZoneChange());
    fireEvent.change(zoneInput(), { target: { value: 'calcutta' } });

    await act(() => setLanguage('fr'));
    await waitFor(() => expect(asked).toEqual(['en', 'fr']));

    expect(screen.getByRole('option', { name: /Kolkata \(UTC\+05:30\)/ })).toBeDefined();
    expect(vi.mocked(fetch).mock.calls.some(([, init]) => (init?.method ?? 'GET') !== 'GET')).toBe(
      false,
    );
  });

  const SAVING_KOLKATA = {
    'PUT /api/auth/timezone': () => json({ timezone: 'Asia/Kolkata' }),
    'GET /api/auth/me': () => me({ timezone: 'Asia/Kolkata' }),
    'GET /api/orgs': () => json({ organisations: [MEMBERSHIP] }),
  };

  async function saveKolkata(): Promise<void> {
    fireEvent.click(await findZoneChange());
    fireEvent.change(zoneInput(), { target: { value: 'india' } });
    fireEvent.click(screen.getByRole('option', { name: /Kolkata \(UTC\+05:30\)/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Save time zone' }));

    expect(
      await screen.findByText(
        'Time zone changed to Kolkata (UTC+05:30). Times in your emails now use it.',
      ),
    ).toBeDefined();
  }

  it('names the saved zone in the new language in its confirmation, and back again', async () => {
    const asked = answeringByLanguage(null, SAVING_KOLKATA);
    open();
    await saveKolkata();

    await act(() => setLanguage('fr'));

    expect(
      await screen.findByText(
        /^Fuseau horaire changé pour Calcutta \(UTC\+05:30\)\. Les heures de vos e-mails l.utilisent désormais\.$/,
      ),
    ).toBeDefined();

    await act(() => setLanguage('en'));

    expect(
      await screen.findByText(
        'Time zone changed to Kolkata (UTC+05:30). Times in your emails now use it.',
      ),
    ).toBeDefined();
    expect(asked).toEqual(['en', 'fr', 'en']);
    expect(zoneChange()).toBeDefined();
  });

  it('keeps the saved name shown while the new list is on its way, and if it never comes', async () => {
    let release: (response: Response) => void = () => {};
    answeringByLanguage(new Promise((resolve) => (release = resolve)), SAVING_KOLKATA);
    open();
    await saveKolkata();

    await act(() => setLanguage('fr'));

    const kept =
      /^Fuseau horaire changé pour Kolkata \(UTC\+05:30\)\. Les heures de vos e-mails l.utilisent désormais\.$/;
    expect(screen.getByText(kept)).toBeDefined();

    await act(async () => release(json({ type: 'x', title: 'x', status: 500 }, 500)));

    expect(screen.getByText(kept)).toBeDefined();
    expect(screen.getByText(kept).closest('.status-done')?.textContent).not.toContain('Asia/');
  });

  it('reads a picked zone in the new language', async () => {
    answeringByLanguage();
    open();

    fireEvent.click(await findZoneChange());
    fireEvent.change(zoneInput(), { target: { value: 'united kingdom' } });
    fireEvent.click(screen.getByRole('option', { name: /London \(UTC\+01:00\)/ }));

    await act(() => setLanguage('fr'));

    await waitFor(() => expect(zoneInput().value).toBe('Londres (UTC+01:00)'));
  });
});

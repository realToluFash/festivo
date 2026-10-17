import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { __setSessionState, type Session } from '../../session.ts';
import { membership } from '../../test-memberships.ts';
import { routes } from '../index.tsx';

const FOLAKE: Session = {
  name: 'Folake Adeyemi',
  email: 'folake@ire.events',
  verified: true,
  complete: false,
  awaiting: 'details' as const,
  providers: [],
  needsOrganisation: true,
  hasPassword: true,
  organisation: null,
  organisations: [],
  organisationCountry: null,
  timezone: null,
};

const ACCOUNT = {
  id: 'acc_1',
  name: 'Folake Adeyemi',
  businessName: null,
  countryCode: null,
  organisationCountry: null,
  locale: 'en',
  timezone: null,
  verified: true,
  complete: true,
  needsOrganisation: false,
  hasPassword: true,
  emailAddresses: [{ id: 'a1', address: 'folake@ire.events', verified: true, primary: true }],
  phoneNumbers: [],
};

function at(path: string, session: Session = FOLAKE) {
  __setSessionState({ status: 'signedIn', session });

  return render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />);
}

function answering(answers: Record<string, (body: unknown) => Response>) {
  const sent: { method: string; path: string; body: unknown }[] = [];

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const method = init?.method ?? 'GET';
    const path = new URL(String(input)).pathname;
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

afterEach(() => {
  vi.restoreAllMocks();
  __setSessionState({ status: 'unknown' });
});

describe('a few details', () => {
  it('shows the strip, the name from registration, and the organisation for a self-registered account', () => {
    at('/complete-profile');

    expect(screen.getByRole('heading', { level: 1, name: 'A few details' })).toBeDefined();
    expect(screen.getByText('Email verified · done')).toBeDefined();
    expect((screen.getByLabelText('Full name') as HTMLInputElement).value).toBe('Folake Adeyemi');
    expect(screen.getByLabelText('Organisation name')).toBeDefined();
    expect(screen.getByText('Your events belong to it. You can rename it later.')).toBeDefined();
    expect(screen.getByLabelText('Country')).toBeDefined();
    expect(screen.getByText('Signed in as folake@ire.events.')).toBeDefined();
  });

  it('starts blank when the browser names no country, and refuses it blank before sending', () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['es-419']);
    const sent = answering({});
    at('/complete-profile');

    expect((screen.getByLabelText('Country') as HTMLSelectElement).value).toBe('');
    expect((screen.getByLabelText('Code') as HTMLSelectElement).value).toBe('');

    fireEvent.change(screen.getByLabelText('Organisation name'), {
      target: { value: 'Ìrè Events' },
    });
    fireEvent.change(screen.getByLabelText(/Mobile number/), { target: { value: '803 555 0142' } });
    fireEvent.click(screen.getByRole('button', { name: /Save/ }));

    expect(screen.getAllByText('Choose a country.')).toHaveLength(2);
    expect(document.activeElement).toBe(screen.getByLabelText('Country'));
    expect(sent.filter((request) => request.method !== 'GET')).toEqual([]);

    fireEvent.change(screen.getByLabelText('Country'), { target: { value: 'GH' } });
    expect((screen.getByLabelText('Code') as HTMLSelectElement).value).toBe('GH');
    expect(screen.queryByText('Choose a country.')).toBeNull();
  });

  it('does not ask an invited account for an organisation', () => {
    at('/complete-profile', { ...FOLAKE, needsOrganisation: false });

    expect(screen.queryByLabelText('Organisation name')).toBeNull();
    expect(screen.queryByLabelText('Country')).toBeNull();
  });

  it('refuses a blank name and a blank organisation together, before sending anything', () => {
    const sent = answering({});
    at('/complete-profile');

    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: '  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }));

    expect(screen.getByText('Add your name to carry on.')).toBeDefined();
    expect(screen.getByText("Add your organisation's name to carry on.")).toBeDefined();
    expect(screen.getByLabelText('Full name').getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(screen.getByLabelText('Full name'));
    expect(sent).toEqual([]);
  });

  it('saves the name and founds the organisation, then opens the product', async () => {
    const sent = answering({
      'PATCH /api/auth/complete-profile': () =>
        json({ account: ACCOUNT, verificationNeeded: false }),
      'GET /api/orgs': () => json({ organisations: [membership({ name: 'Ìrè Events' })] }),
    });
    at('/complete-profile');

    fireEvent.change(screen.getByLabelText('Organisation name'), {
      target: { value: ' Ìrè Events ' },
    });
    fireEvent.change(screen.getByLabelText('Country'), { target: { value: 'NG' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }));

    await waitFor(() => expect(screen.getByRole('link', { name: 'Events' })).toBeDefined());

    const saved = sent.find((request) => request.method === 'PATCH');
    expect(saved?.body).toMatchObject({
      name: 'Folake Adeyemi',
      organisationName: 'Ìrè Events',
      countryCode: 'NG',
      phoneNumber: '',
    });
    expect(typeof (saved?.body as { timezone?: unknown }).timezone).toBe('string');
  });

  it('starts the phone code on the Country, follows it, and stays once picked by hand', () => {
    answering({});
    at('/complete-profile');

    fireEvent.change(screen.getByLabelText('Country'), { target: { value: 'NG' } });
    expect((screen.getByLabelText('Code') as HTMLSelectElement).value).toBe('NG');

    fireEvent.change(screen.getByLabelText('Country'), { target: { value: 'GH' } });
    expect((screen.getByLabelText('Code') as HTMLSelectElement).value).toBe('GH');

    fireEvent.change(screen.getByLabelText('Code'), { target: { value: 'KE' } });
    fireEvent.change(screen.getByLabelText('Country'), { target: { value: 'NG' } });
    expect((screen.getByLabelText('Code') as HTMLSelectElement).value).toBe('KE');
  });

  it("starts an invited person's phone code on the organisation's country, not the browser's", () => {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-GB']);
    at('/complete-profile', { ...FOLAKE, needsOrganisation: false, organisationCountry: 'GH' });

    expect((screen.getByLabelText('Code') as HTMLSelectElement).value).toBe('GH');
  });

  it('marks the mobile optional and checks a typed one for its country before sending', () => {
    const sent = answering({});
    at('/complete-profile', { ...FOLAKE, needsOrganisation: false });

    expect(screen.getByText('Optional')).toBeDefined();
    expect(screen.getByText(/we text it a code to check it/)).toBeDefined();

    fireEvent.change(screen.getByLabelText('Code'), { target: { value: 'NG' } });
    fireEvent.change(screen.getByLabelText(/Mobile number/), { target: { value: '803 55' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }));

    expect(
      screen.getByText('That number looks too short for Nigeria. Check it and try again.'),
    ).toBeDefined();
    expect(document.activeElement).toBe(screen.getByLabelText(/Mobile number/));
    expect(sent).toEqual([]);
  });

  it('saves a typed mobile and opens Verify phone for it', async () => {
    const phone = {
      id: 'p1',
      number: '+2348035550142',
      countryCode: 'NG',
      verified: false,
      primary: true,
    };
    const texted = { ...ACCOUNT, verified: false, phoneNumbers: [phone] };
    const sent = answering({
      'PATCH /api/auth/complete-profile': () => json({ account: texted, verificationNeeded: true }),
      'GET /api/orgs': () => json({ organisations: [] }),
      'GET /api/auth/me': () => json(texted),
      'GET /api/auth/verify/phone/resend': () => json({ cooldownSeconds: 60 }),
    });
    at('/complete-profile', { ...FOLAKE, needsOrganisation: false });

    fireEvent.change(screen.getByLabelText('Code'), { target: { value: 'NG' } });
    fireEvent.change(screen.getByLabelText(/Mobile number/), {
      target: { value: '0803 555 0142' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }));

    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: 'Check your messages' })).toBeDefined(),
    );
    expect(screen.getByText('Carry on without it')).toBeDefined();
    expect(sent.find((request) => request.method === 'PATCH')?.body).toMatchObject({
      phoneCountryCode: 'NG',
      phoneNumber: '0803 555 0142',
    });
  });

  it('says a number verified on another account is taken, under the field', async () => {
    answering({
      'PATCH /api/auth/complete-profile': () =>
        json({ type: 'https://soirely.com/errors/phone_taken', title: 'No.', status: 409 }, 409),
    });
    at('/complete-profile', { ...FOLAKE, needsOrganisation: false });

    fireEvent.change(screen.getByLabelText('Code'), { target: { value: 'NG' } });
    fireEvent.change(screen.getByLabelText(/Mobile number/), {
      target: { value: '0803 555 0142' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }));

    await waitFor(() =>
      expect(screen.getByText(/already linked to another account/)).toBeDefined(),
    );
    expect(screen.getByLabelText(/Mobile number/).getAttribute('aria-invalid')).toBe('true');
  });

  it('sends an unverified account to verify first', async () => {
    answering({});
    at('/complete-profile', { ...FOLAKE, verified: false, awaiting: 'email' });

    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: 'Check your email' })).toBeDefined(),
    );
  });

  it('keeps an incomplete account out of the product', async () => {
    at('/app/settings');

    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: 'A few details' })).toBeDefined(),
    );
  });

  it('follows the API when it says the account is behind the gate after all', async () => {
    answering({
      'GET /api/auth/me': () => json({ ...ACCOUNT, complete: false, needsOrganisation: true }),
      'PATCH /api/orgs/org_1': () =>
        json(
          { type: 'https://soirely.com/errors/profile_incomplete', title: 'No.', status: 403 },
          403,
        ),
    });
    const organisation = membership();
    at('/app/settings', {
      ...FOLAKE,
      complete: true,
      awaiting: null,
      providers: [],
      needsOrganisation: false,
      hasPassword: true,
      organisation,
      organisations: [organisation],
      organisationCountry: null,
      timezone: null,
    });

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Renamed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: 'A few details' })).toBeDefined(),
    );
  });
});

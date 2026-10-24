import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { __setSessionState, type Session } from '../../session.ts';
import { membership } from '../../test-memberships.ts';
import { breaksAnywhere } from '../../test-wrapping.ts';
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
  waitingFor: null,
};

const ACCOUNT = {
  id: 'acc_1',
  name: 'Folake Adeyemi',
  businessName: null,
  countryCode: null,
  organisationCountry: null,
  locale: 'en',
  timezone: null,
  waitingFor: null,
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

function answering(answers: Record<string, (body: unknown) => Response | Promise<Response>>) {
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
      waitingFor: null,
    });

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Renamed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1, name: 'A few details' })).toBeDefined(),
    );
  });
});

describe('an organisation at the domain of the address (sc-561)', () => {
  const ADA: Session = { ...FOLAKE, name: 'Ada Okeke', email: 'ada@ire.events' };
  const OFFERS = {
    domain: 'ire.events',
    offers: [{ id: 'org_ire', name: 'Ìrè Events' }],
    request: null,
  };
  const REQUEST = {
    organisation: { id: 'org_ire', name: 'Ìrè Events' },
    askedAt: '2026-10-17T14:20:00+00:00',
  };

  it('offers each organisation listing it instead of the organisation fields', async () => {
    answering({ 'GET /api/join-offers': () => json(OFFERS) });
    at('/complete-profile', ADA);

    expect(await screen.findByText('Ìrè Events uses Soirely')).toBeDefined();
    expect(
      screen.getByText(
        'Your address is at ire.events. Ask to join your company’s organisation, or start your own.',
      ),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: 'Ask to join Ìrè Events' })).toBeDefined();
    expect(screen.queryByLabelText('Organisation name')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Save and continue' })).toBeNull();
  });

  it('names a 60-character organisation in a title that can break inside the word (sc-486)', async () => {
    const name = 'Événements'.padEnd(60, 'E');
    answering({
      'GET /api/join-offers': () => json({ ...OFFERS, offers: [{ id: 'org_ire', name }] }),
    });
    at('/complete-profile', ADA);

    const title = await screen.findByText(`${name} uses Soirely`);

    expect(breaksAnywhere(title)).toBe(true);
  });

  it('shows the organisation fields after Start my own, with a way back', async () => {
    answering({ 'GET /api/join-offers': () => json(OFFERS) });
    at('/complete-profile', ADA);

    fireEvent.click(await screen.findByRole('button', { name: 'Start my own organisation' }));

    expect(screen.getByLabelText('Organisation name')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Save and continue' })).toBeDefined();

    fireEvent.click(
      screen.getByRole('button', { name: 'Ask to join an organisation at ire.events instead' }),
    );
    expect(screen.getByText('Ìrè Events uses Soirely')).toBeDefined();
  });

  it('checks the name before asking, and sends nothing without it', async () => {
    const sent = answering({ 'GET /api/join-offers': () => json(OFFERS) });
    at('/complete-profile', ADA);

    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: '  ' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Ask to join Ìrè Events' }));

    expect(screen.getByText('Add your name to carry on.')).toBeDefined();
    expect(sent.filter((request) => request.method !== 'GET')).toEqual([]);
  });

  it('saves the details with the request, then waits for approval', async () => {
    const sent = answering({
      'GET /api/join-offers': () => json(OFFERS),
      'PATCH /api/auth/complete-profile': () =>
        json({
          account: { ...ACCOUNT, name: 'Ada Okeke', waitingFor: REQUEST },
          verificationNeeded: false,
        }),
      'GET /api/orgs': () => json({ organisations: [] }),
    });
    at('/complete-profile', ADA);

    fireEvent.click(await screen.findByRole('button', { name: 'Ask to join Ìrè Events' }));

    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Waiting for Ìrè Events to approve you',
      }),
    ).toBeDefined();
    expect(sent.find((request) => request.method === 'PATCH')?.body).toEqual({
      name: 'Ada Okeke',
      askToJoin: 'org_ire',
      phoneCountryCode: expect.any(String) as string,
      phoneNumber: '',
    });
  });

  it('starts their own instead by withdrawing the request', async () => {
    const sent = answering({
      'DELETE /api/join-offers/request': () => new Response(null, { status: 204 }),
      'GET /api/auth/me': () => json(ACCOUNT),
      'GET /api/orgs': () => json({ organisations: [] }),
    });
    at('/complete-profile', {
      ...ADA,
      complete: true,
      awaiting: 'approval',
      waitingFor: REQUEST,
    });

    expect(
      screen.getByText('We’ll email ada@ire.events when somebody there answers.'),
    ).toBeDefined();
    expect(screen.getByText(/Waiting for approval/)).toBeDefined();
    expect(
      screen.getByText(
        'Your details are saved. Until somebody at Ìrè Events approves you, there is nothing of theirs to see.',
      ),
    ).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Start my own organisation instead' }));

    await waitFor(() => expect(sent.some((request) => request.method === 'DELETE')).toBe(true));
  });
});

// Every key InvitationsController::preview writes, as GET /api/invitations lists them.
function preview(id: string, organisation: { id: string; name: string }, inviter: string | null) {
  return {
    id,
    organisation,
    email: 'folake@ire.events',
    role: { id: 'role_3', seededAs: 'event_manager', name: null },
    invitedBy: inviter == null ? null : { name: inviter },
    expiresAt: '2026-10-23T09:00:00+00:00',
    refusal: null,
    forYou: true,
    signedInAs: 'folake@ire.events',
  };
}

const ADUNNI = { id: 'org_7', name: 'Adunni Weddings' };
const KOLA = { id: 'org_9', name: 'Kola Bello Catering' };
const ROLE = { id: 'role_3', seededAs: 'event_manager', name: null };

function invited(...invitations: unknown[]) {
  return { 'GET /api/invitations': () => json({ invitations }) };
}

describe('a few details, with invitations waiting (sc-3353)', () => {
  it('lists each invitation after the name and above the organisation, with a rule between', async () => {
    answering(invited(preview('inv_1', ADUNNI, 'Bisi Adeyemi')));
    at('/complete-profile');

    const group = await screen.findByRole('group', { name: 'Adunni Weddings' });
    expect(within(group).getByText('Invitation from Bisi Adeyemi · Event manager')).toBeDefined();
    expect(
      within(group).getByRole('button', { name: 'Accept and join Adunni Weddings' }),
    ).toBeDefined();
    expect(
      within(group).getByRole('button', { name: 'Decline the invitation to Adunni Weddings' }),
    ).toBeDefined();
    expect(
      screen.getByText(
        'You have an invitation waiting. Accept it to join that organisation, or start your own below.',
      ),
    ).toBeDefined();
    expect(screen.getByText('Or start your own organisation')).toBeDefined();

    const name = screen.getByLabelText('Full name');
    const organisation = screen.getByLabelText('Organisation name');
    expect(name.compareDocumentPosition(group) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(
      group.compareDocumentPosition(organisation) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it('counts two waiting in the plural', async () => {
    answering(
      invited(preview('inv_1', ADUNNI, 'Bisi Adeyemi'), preview('inv_2', KOLA, 'Kola Bello')),
    );
    at('/complete-profile');

    expect(
      await screen.findByText(
        'You have 2 invitations waiting. Accept one to join that organisation, or start your own below.',
      ),
    ).toBeDefined();
  });

  it('asks for an organisation or an invitation when Save is pressed with neither', async () => {
    const sent = answering(invited(preview('inv_1', ADUNNI, 'Bisi Adeyemi')));
    at('/complete-profile');
    await screen.findByRole('group', { name: 'Adunni Weddings' });

    fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }));

    expect(
      screen.getByText('Name your organisation, or accept an invitation above.'),
    ).toBeDefined();
    expect(sent.filter((request) => request.method !== 'GET')).toEqual([]);
  });

  it('accepting drops the organisation fields, keeps the rest, and finishing lands in it', async () => {
    window.localStorage.removeItem('soirely.organisation');
    const sent = answering({
      ...invited(preview('inv_1', ADUNNI, 'Bisi Adeyemi')),
      'POST /api/invitations/inv_1/accept': () =>
        json({ organisation: membership({ ...ADUNNI, role: ROLE }) }),
      'PATCH /api/auth/complete-profile': () =>
        json({ account: ACCOUNT, verificationNeeded: false }),
      'GET /api/orgs': () => json({ organisations: [membership({ ...ADUNNI, role: ROLE })] }),
    });
    at('/complete-profile');

    fireEvent.change(await screen.findByLabelText('Organisation name'), {
      target: { value: 'Typed then dropped' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Accept and join Adunni Weddings' }));

    expect(await screen.findByText('You joined Adunni Weddings as Event manager.')).toBeDefined();
    expect(screen.getByText('Save and continue takes you there.')).toBeDefined();
    expect(screen.getByText('You do not need to start an organisation now.')).toBeDefined();
    expect(screen.queryByLabelText('Organisation name')).toBeNull();
    expect(screen.queryByLabelText('Country')).toBeNull();
    expect(screen.queryByText('Or start your own organisation')).toBeNull();
    expect(screen.getByLabelText('Full name')).toBeDefined();
    expect(screen.getByLabelText(/Mobile number/)).toBeDefined();
    expect(sent.filter((request) => request.path === '/api/invitations')).toHaveLength(1);

    fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }));

    await waitFor(() => expect(screen.getByRole('link', { name: 'Events' })).toBeDefined());
    const saved = sent.find((request) => request.method === 'PATCH');
    expect(saved?.body).toEqual({
      name: 'Folake Adeyemi',
      phoneCountryCode: expect.any(String),
      phoneNumber: '',
    });
    expect(window.localStorage.getItem('soirely.organisation')).toBe('org_7');
  });

  it('holds Save while an accept is in flight, so a typed organisation is never sent beside it', async () => {
    let accepted: (response: Response) => void = () => {};
    const sent = answering({
      ...invited(preview('inv_1', ADUNNI, 'Bisi Adeyemi')),
      'POST /api/invitations/inv_1/accept': () =>
        new Promise<Response>((resolve) => {
          accepted = resolve;
        }),
      'PATCH /api/auth/complete-profile': () =>
        json({ account: ACCOUNT, verificationNeeded: false }),
      'GET /api/orgs': () => json({ organisations: [membership({ ...ADUNNI, role: ROLE })] }),
    });
    at('/complete-profile');

    fireEvent.change(await screen.findByLabelText('Organisation name'), {
      target: { value: 'Typed then dropped' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Accept and join Adunni Weddings' }));
    await waitFor(() => expect(sent.some((request) => request.method === 'POST')).toBe(true));

    const save = screen.getByRole('button', { name: 'Save and continue' });
    expect(save).toHaveProperty('disabled', true);
    fireEvent.submit(save.closest('form')!);
    expect(sent.filter((request) => request.method === 'PATCH')).toEqual([]);

    accepted(json({ organisation: membership({ ...ADUNNI, role: ROLE }) }));
    expect(await screen.findByText('You joined Adunni Weddings as Event manager.')).toBeDefined();
    expect(save).toHaveProperty('disabled', false);

    fireEvent.click(save);

    await waitFor(() => expect(screen.getByRole('link', { name: 'Events' })).toBeDefined());
    expect(sent.find((request) => request.method === 'PATCH')?.body).not.toHaveProperty(
      'organisationName',
    );
  });

  it('with two accepted, finishing lands in the first and the second can be switched to later', async () => {
    window.localStorage.removeItem('soirely.organisation');
    answering({
      ...invited(preview('inv_1', ADUNNI, 'Bisi Adeyemi'), preview('inv_2', KOLA, 'Kola Bello')),
      'POST /api/invitations/inv_2/accept': () =>
        json({ organisation: membership({ ...KOLA, role: ROLE }) }),
      'POST /api/invitations/inv_1/accept': () =>
        json({ organisation: membership({ ...ADUNNI, role: ROLE }) }),
      'PATCH /api/auth/complete-profile': () =>
        json({ account: ACCOUNT, verificationNeeded: false }),
      'GET /api/orgs': () =>
        json({
          organisations: [
            membership({ ...ADUNNI, role: ROLE }),
            membership({ ...KOLA, role: ROLE }),
          ],
        }),
    });
    at('/complete-profile');

    fireEvent.click(
      await screen.findByRole('button', { name: 'Accept and join Kola Bello Catering' }),
    );
    await screen.findByText('You joined Kola Bello Catering as Event manager.');
    fireEvent.click(screen.getByRole('button', { name: 'Accept and join Adunni Weddings' }));
    await screen.findByText('You joined Adunni Weddings as Event manager.');

    const kola = screen.getByRole('group', { name: 'Kola Bello Catering' });
    const adunni = screen.getByRole('group', { name: 'Adunni Weddings' });
    expect(within(kola).getByText('Save and continue takes you there.')).toBeDefined();
    expect(
      within(adunni).getByText('It is in your organisations. You can switch to it later.'),
    ).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }));

    await waitFor(() => expect(screen.getByRole('link', { name: 'Events' })).toBeDefined());
    expect(window.localStorage.getItem('soirely.organisation')).toBe('org_9');
  });

  it('declining every one leaves the organisation fields as they were, and the row says so', async () => {
    answering({
      ...invited(preview('inv_1', ADUNNI, 'Bisi Adeyemi')),
      'POST /api/invitations/inv_1/decline': () => new Response(null, { status: 204 }),
    });
    at('/complete-profile');

    fireEvent.click(
      await screen.findByRole('button', { name: 'Decline the invitation to Adunni Weddings' }),
    );

    expect(
      await screen.findByText('You declined. Bisi Adeyemi will see that you said no.'),
    ).toBeDefined();
    expect(screen.getByText('Nothing is waiting. Name your organisation below.')).toBeDefined();
    expect(screen.queryByText('Or start your own organisation')).toBeNull();
    expect(screen.getByLabelText('Organisation name')).toBeDefined();
    expect(screen.getByRole('group', { name: 'Adunni Weddings' })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }));
    expect(screen.getByText("Add your organisation's name to carry on.")).toBeDefined();
  });

  it('keeps the organisation fields when a press is refused', async () => {
    answering({
      ...invited(preview('inv_1', ADUNNI, 'Bisi Adeyemi')),
      'POST /api/invitations/inv_1/accept': () =>
        json(
          { type: 'https://soirely.com/errors/invitation_expired', title: 'No.', status: 409 },
          409,
        ),
    });
    at('/complete-profile');

    fireEvent.click(await screen.findByRole('button', { name: 'Accept and join Adunni Weddings' }));

    expect(await screen.findByText('Expired')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Accept and join Adunni Weddings' })).toBeNull();
    expect(screen.getByLabelText('Organisation name')).toBeDefined();
  });

  it('with none waiting, shows no invitations group', async () => {
    const sent = answering(invited());
    at('/complete-profile');

    await waitFor(() =>
      expect(sent.some((request) => request.path === '/api/invitations')).toBe(true),
    );
    expect(screen.queryByText('Invitations')).toBeNull();
    expect(screen.queryByText('Or start your own organisation')).toBeNull();
    expect(screen.getByLabelText('Organisation name')).toBeDefined();
  });

  it('does not ask an account that needs no organisation for its invitations', () => {
    const sent = answering(invited(preview('inv_1', ADUNNI, 'Bisi Adeyemi')));
    at('/complete-profile', { ...FOLAKE, needsOrganisation: false });

    expect(sent.filter((request) => request.path === '/api/invitations')).toEqual([]);
  });

  it('stops offering the organisation at the domain once an invitation is accepted', async () => {
    const sent = answering({
      ...invited(preview('inv_1', ADUNNI, 'Bisi Adeyemi')),
      'GET /api/join-offers': () =>
        json({
          domain: 'ire.events',
          offers: [{ id: 'org_ire', name: 'Ìrè Events' }],
          request: null,
        }),
      'POST /api/invitations/inv_1/accept': () =>
        json({ organisation: membership({ ...ADUNNI, role: ROLE }) }),
      'PATCH /api/auth/complete-profile': () =>
        json({ account: ACCOUNT, verificationNeeded: false }),
      'GET /api/orgs': () => json({ organisations: [membership({ ...ADUNNI, role: ROLE })] }),
    });
    at('/complete-profile');

    expect(await screen.findByRole('button', { name: 'Ask to join Ìrè Events' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Accept and join Adunni Weddings' }));

    expect(await screen.findByText('You joined Adunni Weddings as Event manager.')).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Ask to join Ìrè Events' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Start my own organisation' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }));

    await waitFor(() => expect(sent.some((request) => request.method === 'PATCH')).toBe(true));
    expect(sent.find((request) => request.method === 'PATCH')?.body).not.toHaveProperty(
      'askToJoin',
    );
  });
});

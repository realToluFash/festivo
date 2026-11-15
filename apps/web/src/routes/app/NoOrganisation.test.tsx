import { type Account } from '@soirely/api-client';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { followAccount } from '../../accountLanguage.ts';
import { setLanguage } from '../../i18n/index.ts';
import { __setSessionState } from '../../session.ts';
import { membership } from '../../test-memberships.ts';
import { routes } from '../index.tsx';

function inNone(): void {
  __setSessionState({
    status: 'signedIn',
    session: {
      name: 'Chidi Okoro',
      email: 'chidi@ire.events',
      verified: true,
      complete: true,
      awaiting: null,
      providers: [],
      userId: 'u1',
      needsOrganisation: false,
      hasPassword: true,
      organisation: null,
      organisations: [],
      organisationCountry: null,
      timezone: null,
      waitingFor: null,
    },
  });
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function answering(answers: Record<string, () => Response | Promise<Response>>) {
  const sent: { line: string; body: unknown }[] = [];

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const line = `${init?.method ?? 'GET'} ${new URL(String(input)).pathname}`;
    sent.push({ line, body: typeof init?.body === 'string' ? JSON.parse(init.body) : null });

    const answer = answers[line];
    if (answer == null) throw new TypeError('Failed to fetch');

    return answer();
  });

  return sent;
}

function app(path = '/app') {
  return render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />);
}

const CHIDI_ACCOUNT: Account = {
  id: 'acc_1',
  name: 'Chidi Okoro',
  businessName: null,
  countryCode: null,
  organisationCountry: null,
  locale: null,
  timezone: null,
  verified: true,
  complete: true,
  needsOrganisation: false,
  hasPassword: true,
  twoFactorSetupPrompt: false,
  colourScheme: null,
  waitingFor: null,
  providers: [],
  emailAddresses: [],
  phoneNumbers: [],
};

const PRODUCT_LINKS = ['Today', 'Events', 'Calendar', 'Settings'];

afterEach(async () => {
  vi.restoreAllMocks();
  await followAccount(CHIDI_ACCOUNT);
  await setLanguage(null);
});

describe('the page an account in no organisation stands on (sc-13339)', () => {
  it.each(['/app', '/app/events', '/app/guests', '/app/settings'])(
    'offers no product page at %s, only the account and the language',
    async (path) => {
      inNone();
      answering({ 'GET /api/invitations': () => json({ invitations: [] }) });
      app(path);

      await screen.findByRole('heading', { level: 1, name: 'You are not in an organisation' });
      for (const name of PRODUCT_LINKS) expect(screen.queryByRole('link', { name })).toBeNull();
      expect(screen.getByLabelText('Language')).toBeDefined();
      expect(screen.getByRole('link', { name: 'Your account' }).getAttribute('href')).toBe(
        '/app/account/security',
      );
    },
  );

  it('sends the account pages back to this page, with Today and the rest gone (sc-13406)', async () => {
    inNone();
    answering({ 'GET /api/invitations': () => json({ invitations: [] }) });
    app('/app/account');

    const heading = await screen.findByRole('heading', { level: 1, name: 'Your account' });
    const wayBack = screen.getByRole('link', { name: 'Join or start an organisation' });
    expect(wayBack.getAttribute('href')).toBe('/app');
    expect(
      wayBack.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    for (const name of PRODUCT_LINKS) expect(screen.queryByRole('link', { name })).toBeNull();
    expect(screen.getByLabelText('Language')).toBeDefined();

    fireEvent.click(wayBack);

    await screen.findByRole('heading', { level: 1, name: 'You are not in an organisation' });
  });

  it('keeps the same header and way back on the security page (sc-13406)', async () => {
    inNone();
    answering({ 'GET /api/invitations': () => json({ invitations: [] }) });
    app('/app/account/security');

    await screen.findByRole('heading', { level: 1, name: 'Security' });
    expect(screen.getByRole('link', { name: 'Join or start an organisation' })).toBeDefined();
    for (const name of PRODUCT_LINKS) expect(screen.queryByRole('link', { name })).toBeNull();
    expect(screen.getByLabelText('Language')).toBeDefined();
  });

  it.each(['/app/account', '/app/account/security'])(
    'keeps the sidebar and the switcher at %s for an account in an organisation (sc-13406)',
    async (path) => {
      const ire = membership();
      __setSessionState({
        status: 'signedIn',
        session: {
          name: 'Chidi Okoro',
          email: 'chidi@ire.events',
          verified: true,
          complete: true,
          awaiting: null,
          providers: [],
          userId: 'u1',
          needsOrganisation: false,
          hasPassword: true,
          organisation: ire,
          organisations: [ire],
          organisationCountry: 'NG',
          timezone: null,
          waitingFor: null,
        },
      });
      answering({
        'GET /api/invitations': () => json({ invitations: [] }),
        'GET /api/orgs': () => json({ organisations: [ire] }),
      });
      app(path);

      await screen.findByRole('heading', {
        level: 1,
        name: path.endsWith('security') ? 'Security' : 'Your account',
      });
      for (const name of PRODUCT_LINKS) expect(screen.getByRole('link', { name })).toBeDefined();
      expect(screen.getByRole('button', { name: /Organisation: Ìrè Events/ })).toBeDefined();
      expect(screen.queryByRole('link', { name: 'Join or start an organisation' })).toBeNull();
    },
  );

  it('offers the four languages with no Automatic, and redraws in the one picked, saving it (sc-9797)', async () => {
    inNone();
    const sent = answering({
      'GET /api/invitations': () => json({ invitations: [] }),
      'PUT /api/auth/locale': () => new Response(null, { status: 204 }),
    });
    app();

    await screen.findByRole('heading', { level: 1, name: 'You are not in an organisation' });
    const picker = screen.getByRole<HTMLSelectElement>('combobox', { name: 'Language' });
    expect([...picker.options].map((option) => option.textContent)).toEqual([
      'English',
      'Español',
      'Français',
      'Português',
    ]);

    fireEvent.change(picker, { target: { value: 'es' } });

    await screen.findByRole('heading', { level: 1, name: 'No pertenece a ninguna organización' });
    await waitFor(() =>
      expect(sent.find((one) => one.line === 'PUT /api/auth/locale')?.body).toEqual({
        locale: 'es',
      }),
    );
  });
});

const REFUSED_NAME = {
  type: 'https://soirely.com/errors/validation_failed',
  title: 'Some fields need attention.',
  status: 422,
  violations: [{ propertyPath: 'name', message: 'Keep it to 100 characters.', code: 'x' }],
};
const BROKEN = { type: 'about:blank', title: 'Internal Server Error', status: 500 };

async function openWalk(): Promise<HTMLElement> {
  fireEvent.click(await screen.findByRole('button', { name: 'Start organisation' }));

  return screen.findByRole('dialog', { name: 'Create an organisation' });
}

/** Start organisation, then the name, then the country by search, to Ready to create it?. */
async function walkToReady(name: string, country = 'Ghana'): Promise<HTMLElement> {
  const walk = await openWalk();

  fireEvent.change(within(walk).getByLabelText('Organisation name'), { target: { value: name } });
  fireEvent.click(within(walk).getByRole('button', { name: 'Continue' }));
  fireEvent.change(within(walk).getByRole('searchbox', { name: 'Search countries' }), {
    target: { value: country },
  });
  fireEvent.click(within(walk).getByRole('option', { name: new RegExp(`^${country}`) }));
  fireEvent.click(within(walk).getByRole('button', { name: 'Continue' }));
  within(walk).getByRole('heading', { level: 1, name: 'Ready to create it?' });

  return walk;
}

describe('No organisation starts one with the walk (sc-30412)', () => {
  it('opens the walk on the name, and refuses Continue with none before anything is sent', async () => {
    inNone();
    const sent = answering({ 'GET /api/invitations': () => json({ invitations: [] }) });
    app();

    const walk = await openWalk();
    const field = within(walk).getByLabelText('Organisation name');
    expect(document.activeElement).toBe(field);

    fireEvent.click(within(walk).getByRole('button', { name: 'Continue' }));

    expect(within(walk).getByRole('alert').textContent).toBe("Enter the organisation's name.");
    expect(document.activeElement).toBe(field);
    expect(sent.some((one) => one.line === 'POST /api/orgs')).toBe(false);
  });

  it('starts one and opens it, with the account as its owner', async () => {
    inNone();
    const started = membership({ id: 'org_9', name: 'Okoro Weddings', countryCode: 'GH' });
    const sent = answering({
      'GET /api/invitations': () => json({ invitations: [] }),
      'POST /api/orgs': () => json({ organisation: started }, 201),
    });
    app();

    const walk = await walkToReady('  Okoro Weddings ');
    fireEvent.click(within(walk).getByRole('button', { name: 'Create organisation' }));

    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'You are not in an organisation' })).toBeNull(),
    );
    expect(screen.getByText('Now working in Okoro Weddings.')).toBeDefined();
    expect(sent.find((one) => one.line === 'POST /api/orgs')?.body).toMatchObject({
      name: 'Okoro Weddings',
      countryCode: 'GH',
    });
  });

  it('shows the currency the API gives each country, a country with none as none yet', async () => {
    inNone();
    answering({
      'GET /api/invitations': () => json({ invitations: [] }),
      'GET /api/countries': () =>
        json({
          countries: [
            { code: 'GH', currency: 'GHS' },
            { code: 'AQ', currency: null },
          ],
        }),
    });
    app();

    const walk = await walkToReady('Okoro Weddings');

    expect(within(walk).getByText(/Currency, Ghanaian Cedi \(GHS\)\./)).toBeDefined();
    fireEvent.click(within(walk).getByRole('button', { name: 'Back' }));
    fireEvent.change(within(walk).getByRole('searchbox', { name: 'Search countries' }), {
      target: { value: 'Antarctica' },
    });
    expect(within(walk).getByRole('option', { name: 'Antarctica, None yet' })).toBeDefined();
  });

  it('takes a name the server refuses back to the name, with its reason', async () => {
    inNone();
    answering({
      'GET /api/invitations': () => json({ invitations: [] }),
      'POST /api/orgs': () => json(REFUSED_NAME, 422),
    });
    app();

    const walk = await walkToReady('Okoro Weddings');
    fireEvent.click(within(walk).getByRole('button', { name: 'Create organisation' }));

    expect(await within(walk).findByText('Keep it to 100 characters.')).toBeDefined();
    await waitFor(() =>
      expect(document.activeElement).toBe(within(walk).getByLabelText('Organisation name')),
    );
  });

  it('says it did not work on Ready, focus on Create organisation', async () => {
    inNone();
    answering({
      'GET /api/invitations': () => json({ invitations: [] }),
      'POST /api/orgs': () => json(BROKEN, 500),
    });
    app();

    const walk = await walkToReady('Okoro Weddings');
    fireEvent.click(within(walk).getByRole('button', { name: 'Create organisation' }));

    expect(
      await within(walk).findByText(
        'Creating the organisation did not work. Nothing was created. Try again in a moment.',
      ),
    ).toBeDefined();
    expect(document.activeElement).toBe(
      within(walk).getByRole('button', { name: 'Create organisation' }),
    );
  });

  it('holds too many for now on Ready, with the time to try again', async () => {
    inNone();
    answering({
      'GET /api/invitations': () => json({ invitations: [] }),
      'POST /api/orgs': () =>
        new Response(
          JSON.stringify({
            type: 'https://soirely.com/errors/too_many_attempts',
            title: 'Too many',
            status: 429,
          }),
          { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': '600' } },
        ),
    });
    app();

    const walk = await walkToReady('Okoro Weddings');
    fireEvent.click(within(walk).getByRole('button', { name: 'Create organisation' }));

    expect(await within(walk).findByText('Too many new organisations for now.')).toBeDefined();
    expect(within(walk).getByText(/^Try again at /)).toBeDefined();
  });

  it('sends one request while it creates, with no way out, then one more after a failure (sc-8327)', async () => {
    inNone();
    let answer: (response: Response) => void = () => {};
    const sent = answering({
      'GET /api/invitations': () => json({ invitations: [] }),
      'POST /api/orgs': () => new Promise<Response>((resolve) => (answer = resolve)),
    });
    const posts = () => sent.filter(({ line }) => line === 'POST /api/orgs');
    app();

    const walk = await walkToReady('Okoro Weddings');
    fireEvent.click(within(walk).getByRole('button', { name: 'Create organisation' }));
    const creating = within(walk).getByRole('button', { name: 'Creating…' });
    expect(creating.matches(':disabled')).toBe(true);
    expect(within(walk).queryByRole('button', { name: 'Cancel' })).toBeNull();
    fireEvent.click(creating);
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    await waitFor(() => expect(posts()).toHaveLength(1));
    expect(screen.getByRole('dialog', { name: 'Create an organisation' })).toBe(walk);

    answer(json(BROKEN, 500));
    fireEvent.click(await within(walk).findByRole('button', { name: 'Create organisation' }));
    await waitFor(() => expect(posts()).toHaveLength(2));
  });

  it('asks before Cancel throws away a name, and closes at once with nothing entered', async () => {
    inNone();
    answering({ 'GET /api/invitations': () => json({ invitations: [] }) });
    app();

    let walk = await openWalk();
    fireEvent.click(within(walk).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog', { name: 'Create an organisation' })).toBeNull();

    walk = await openWalk();
    fireEvent.change(within(walk).getByLabelText('Organisation name'), {
      target: { value: 'Okoro Weddings' },
    });
    fireEvent.click(within(walk).getByRole('button', { name: 'Cancel' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Discard' }));

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Create an organisation' })).toBeNull(),
    );
  });
});

describe('where focus goes on No organisation (sc-11369)', () => {
  const PREVIEW = {
    id: 'inv_1',
    organisation: { id: 'org_7', name: 'Adunni Weddings' },
    email: 'chidi@ire.events',
    role: { id: 'role_3', seededAs: 'administrator', name: null },
    invitedBy: { name: 'Bisi Adeyemi' },
    expiresAt: '2026-10-23T09:00:00+00:00',
    refusal: null,
    forYou: true,
    signedInAs: 'chidi@ire.events',
  };
  const ADUNNI = membership({
    id: 'org_7',
    name: 'Adunni Weddings',
    role: { id: 'role_3', seededAs: 'administrator', name: null },
  });

  function nowWorkingIn(name: string): HTMLElement | null {
    return screen.getByText(`Now working in ${name}.`).closest('.sw-notice');
  }

  it('takes Start organisation to "Now working in", read once, above Today', async () => {
    inNone();
    const started = membership({ id: 'org_9', name: 'Okoro Weddings', countryCode: 'GH' });
    answering({
      'GET /api/invitations': () => json({ invitations: [] }),
      'POST /api/orgs': () => json({ organisation: started }, 201),
    });
    app();

    const walk = await walkToReady('Okoro Weddings');
    fireEvent.click(within(walk).getByRole('button', { name: 'Create organisation' }));

    await screen.findByRole('heading', { level: 1, name: 'Today' });
    for (const name of PRODUCT_LINKS) expect(screen.getByRole('link', { name })).toBeDefined();
    expect(document.activeElement).toBe(nowWorkingIn('Okoro Weddings'));
    expect(nowWorkingIn('Okoro Weddings')?.getAttribute('role')).toBeNull();
  });

  it('takes Decline to the line that answers it, read once', async () => {
    inNone();
    answering({
      'GET /api/invitations': () => json({ invitations: [PREVIEW] }),
      'POST /api/invitations/inv_1/decline': () => new Response(null, { status: 204 }),
    });
    app();

    fireEvent.click(
      await screen.findByRole('button', { name: 'Decline the invitation to Adunni Weddings' }),
    );

    const line = await screen.findByText('You declined. Bisi Adeyemi will see that you said no.');
    await waitFor(() => expect(document.activeElement).toBe(line.closest('.invitation-row-said')));
    expect(line.closest('[role="status"]')).toBeNull();
  });

  it('takes Accept and join to "You joined", then Open to "Now working in"', async () => {
    inNone();
    answering({
      'GET /api/invitations': () => json({ invitations: [PREVIEW] }),
      'POST /api/invitations/inv_1/accept': () => json({ organisation: ADUNNI }),
    });
    app();

    fireEvent.click(await screen.findByRole('button', { name: 'Accept and join Adunni Weddings' }));

    const line = await screen.findByText('You joined Adunni Weddings as Admin.');
    const said = line.closest('.invitation-row-said');
    await waitFor(() => expect(document.activeElement).toBe(said));
    expect(said?.nextElementSibling?.textContent).toBe('Open Adunni Weddings');

    fireEvent.click(screen.getByRole('button', { name: 'Open Adunni Weddings' }));

    await screen.findByRole('heading', { level: 1, name: 'Today' });
    for (const name of PRODUCT_LINKS) expect(screen.getByRole('link', { name })).toBeDefined();
    expect(document.activeElement).toBe(nowWorkingIn('Adunni Weddings'));
  });

  it('takes a refused Accept and join to its word and sentence', async () => {
    inNone();
    answering({
      'GET /api/invitations': () => json({ invitations: [PREVIEW] }),
      'POST /api/invitations/inv_1/accept': () =>
        json(
          { type: 'https://soirely.com/errors/invitation_revoked', title: 'No.', status: 409 },
          409,
        ),
    });
    app();

    fireEvent.click(await screen.findByRole('button', { name: 'Accept and join Adunni Weddings' }));

    const notice = (await screen.findByText('Withdrawn')).closest('.notice');
    await waitFor(() => expect(document.activeElement).toBe(notice));
    expect(notice?.getAttribute('role')).toBeNull();
  });
});

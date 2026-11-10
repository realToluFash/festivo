import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
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
];

const PRIMARY = { id: 'e1', address: 'folake@ire.events', verified: true, primary: true };
const OTHER = { id: 'e2', address: 'folake.adeyemi@gmail.com', verified: true, primary: false };

const ME = {
  id: 'acc_1',
  name: 'Folake Ire',
  businessName: null,
  countryCode: null,
  organisationCountry: 'NG',
  locale: 'en',
  timezone: 'Africa/Lagos',
  waitingFor: null,
  verified: true,
  complete: true,
  userId: 'u1',
  needsOrganisation: false,
  hasPassword: true,
  providers: [],
  emailAddresses: [PRIMARY, OTHER],
  phoneNumbers: [
    {
      id: 'p1',
      number: '+2348035550142',
      countryCode: 'NG',
      verified: true,
      primary: true,
      pending: false,
    },
  ],
};

interface Sent {
  call: string;
  body: unknown;
}

function answering(answers: Record<string, () => Response | Promise<Response>> = {}): Sent[] {
  const sent: Sent[] = [];
  const all: Record<string, () => Response | Promise<Response>> = {
    'GET /api/auth/me': () => json(ME),
    'GET /api/auth/timezones': () => json({ timezones: ZONES }),
    'GET /api/auth/two-factor': () => json({ on: false }),
    'GET /api/orgs': () => json({ organisations: [MEMBERSHIP] }),
    ...answers,
  };

  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = new URL(String(input));
    const call = `${init?.method ?? 'GET'} ${url.pathname}`;
    sent.push({ call, body: typeof init?.body === 'string' ? JSON.parse(init.body) : null });
    const answer = all[call];
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

function problem(code: string, status: number, extra: Record<string, unknown> = {}): Response {
  return new Response(
    JSON.stringify({ type: `https://soirely.com/errors/${code}`, title: code, status, ...extra }),
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );
}

function open(session: Partial<Session> = {}) {
  __setSessionState({ status: 'signedIn', session: { ...FOLAKE, ...session } });

  return render(
    <RouterProvider router={createMemoryRouter(routes, { initialEntries: ['/app/account'] })} />,
  );
}

function card(): HTMLElement {
  return document.querySelector<HTMLElement>('.desk-card')!;
}

function dialog(): HTMLElement {
  return screen.getByRole('dialog');
}

beforeEach(() => {
  tokens.save({ accessToken: 'live', refreshExpiresAt: '', sessionId: 's' });
});

afterEach(() => {
  vi.restoreAllMocks();
  sessionStorage.clear();
  tokens.clear();
});

describe('Your account at a desk, summary first (sc-30411)', () => {
  it('leads with you, then About you, then the addresses and numbers, the primary first', async () => {
    answering();
    open();

    expect(await screen.findByText('folake.adeyemi@gmail.com')).toBeDefined();
    expect(within(card()).getByText('Folake Ire')).toBeDefined();
    expect(within(card()).getByText('folake@ire.events')).toBeDefined();
    expect(screen.getByRole('heading', { name: 'About you' })).toBeDefined();
    expect(screen.getByRole('button', { name: /Folake Ire\s*Your name/ })).toBeDefined();
    expect(
      screen.getByRole('button', { name: /Lagos \(UTC\+01:00\)\s*Time zone · Africa\/Lagos/ }),
    ).toBeDefined();
    expect(screen.getByText('Primary · signs you in')).toBeDefined();
    expect(screen.getByText('Can reach you, cannot sign you in')).toBeDefined();
    expect(screen.getByText('Primary · on your profile')).toBeDefined();
    expect(
      screen.getByText('You have 2, the most an account can hold. Remove one to add another.'),
    ).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Add an email address' })).toBeNull();
    expect(
      screen.getByText(
        'You can add one more. An account holds up to 2 phone numbers, including the primary.',
      ),
    ).toBeDefined();
  });

  it('draws the page in the desk’s look, beside the Settings list', async () => {
    answering();
    open();

    expect(await screen.findByText('folake.adeyemi@gmail.com')).toBeDefined();
    expect(card().closest('.settings-desk-page .desk')).not.toBeNull();
  });

  it('says what is not verified yet on the card, with Send a code as its one step', async () => {
    answering({
      'GET /api/auth/me': () =>
        json({ ...ME, emailAddresses: [PRIMARY, { ...OTHER, verified: false }] }),
    });
    open();

    expect(
      await within(card()).findByText('folake.adeyemi@gmail.com is not verified yet.'),
    ).toBeDefined();
    expect(within(card()).getByRole('button', { name: 'Send a code' })).toBeDefined();
    expect(screen.getByText('Unverified')).toBeDefined();
  });

  it('opens a row in place with its offers; the primary never opens', async () => {
    answering();
    open();

    const row = await screen.findByRole('button', { name: /folake\.adeyemi@gmail\.com/ });
    expect(row.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(row);
    expect(row.getAttribute('aria-expanded')).toBe('true');
    const offers = screen.getByRole('group', { name: 'folake.adeyemi@gmail.com' });
    expect(within(offers).getByRole('button', { name: 'Make primary' })).toBeDefined();
    expect(within(offers).getByRole('button', { name: 'Remove…' })).toBeDefined();
    expect(screen.queryByRole('button', { name: /^folake@ire\.events/ })).toBeNull();
  });

  it('asks, then proves it is you, before an address becomes the one you sign in with', async () => {
    const sent = answering({
      'POST /api/auth/proof': () =>
        json({ proof: 'p-1', expiresAt: new Date(Date.now() + 300_000).toISOString() }),
      'PATCH /api/auth/emails/e2/primary': () => json({ ...OTHER, primary: true }),
    });
    open();

    fireEvent.click(await screen.findByRole('button', { name: /folake\.adeyemi@gmail\.com/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Make primary' }));
    const ask = screen.getByRole('alertdialog', { name: 'Make this your primary address?' });
    expect(within(ask).getByRole('button', { name: 'Keep folake@ire.events' })).toBeDefined();
    fireEvent.click(within(ask).getByRole('button', { name: 'Make it primary' }));

    expect(within(dialog()).getByRole('heading', { name: "Confirm it's you" })).toBeDefined();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Continue' }));
    expect(within(dialog()).getByText('Enter your password.')).toBeDefined();
    fireEvent.change(within(dialog()).getByLabelText('Your password'), {
      target: { value: 'secret' },
    });
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Continue' }));

    expect(
      await within(card()).findByText(
        'folake.adeyemi@gmail.com is now your primary address. Sign in with it from now on.',
      ),
    ).toBeDefined();
    expect(sent.find((one) => one.call === 'POST /api/auth/proof')?.body).toEqual({
      password: 'secret',
    });
    expect(sent.some((one) => one.call === 'PATCH /api/auth/emails/e2/primary')).toBe(true);
  });

  it('asks before removing a verified address, and says on the card when it is gone', async () => {
    let removed = false;
    const sent = answering({
      'GET /api/auth/me': () => json(removed ? { ...ME, emailAddresses: [PRIMARY] } : ME),
      'DELETE /api/auth/emails/e2': () => {
        removed = true;
        return new Response(null, { status: 204 });
      },
    });
    open();

    fireEvent.click(await screen.findByRole('button', { name: /folake\.adeyemi@gmail\.com/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove…' }));
    const ask = screen.getByRole('alertdialog', { name: 'Remove this address?' });
    fireEvent.click(within(ask).getByRole('button', { name: 'Remove it' }));

    expect(
      await within(card()).findByText('folake.adeyemi@gmail.com has been removed.'),
    ).toBeDefined();
    expect(sent.some((one) => one.call === 'DELETE /api/auth/emails/e2')).toBe(true);
  });

  it('keeps the row open with the refusal under its offers when a remove does not go', async () => {
    answering({
      'GET /api/auth/me': () =>
        json({ ...ME, emailAddresses: [PRIMARY, { ...OTHER, verified: false }] }),
      'DELETE /api/auth/emails/e2': () => problem('server_error', 500),
    });
    open();

    fireEvent.click(await screen.findByRole('button', { name: /folake\.adeyemi@gmail\.com/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));

    const offers = screen.getByRole('group', { name: 'folake.adeyemi@gmail.com' });
    const refusal = await within(offers).findByRole('alert');
    expect(within(offers).getByText('That did not work. Try again.')).toBeDefined();
    await waitFor(() => expect(document.activeElement).toBe(refusal));
  });

  it('takes focus to the refusal once a confirmed Remove it does not go and its Ask has closed', async () => {
    answering({
      'GET /api/auth/me': () => json({ ...ME, emailAddresses: [PRIMARY, OTHER] }),
      'DELETE /api/auth/emails/e2': () => problem('server_error', 500),
    });
    open();

    fireEvent.click(await screen.findByRole('button', { name: /folake\.adeyemi@gmail\.com/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove…' }));
    const ask = screen.getByRole('alertdialog', { name: 'Remove this address?' });
    fireEvent.click(within(ask).getByRole('button', { name: 'Remove it' }));

    const offers = await screen.findByRole('group', { name: 'folake.adeyemi@gmail.com' });
    const refusal = await within(offers).findByRole('alert');
    expect(screen.queryByRole('alertdialog')).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(refusal));
  });

  it('changes the name in its dialog, refusing a blank one, and says so on the card', async () => {
    let name = 'Folake Ire';
    const sent = answering({
      'GET /api/auth/me': () => json({ ...ME, name }),
      'PUT /api/auth/name': () => {
        name = 'Folake Ire-Bello';
        return new Response(null, { status: 204 });
      },
    });
    open();

    fireEvent.click(await screen.findByRole('button', { name: /Your name/ }));
    const field = within(dialog()).getByLabelText('Full name');
    fireEvent.change(field, { target: { value: '  ' } });
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Save' }));
    expect(within(dialog()).getByText('Enter your name.')).toBeDefined();

    fireEvent.change(field, { target: { value: ' Folake Ire-Bello ' } });
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Save' }));

    expect(await within(card()).findByText('Name changed to Folake Ire-Bello.')).toBeDefined();
    expect(sent.find((one) => one.call === 'PUT /api/auth/name')?.body).toEqual({
      name: 'Folake Ire-Bello',
    });
  });

  it('asks before throwing away a changed name', async () => {
    answering();
    open();

    fireEvent.click(await screen.findByRole('button', { name: /Your name/ }));
    fireEvent.change(within(dialog()).getByLabelText('Full name'), {
      target: { value: 'Folake' },
    });
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Cancel' }));

    const ask = screen.getByRole('alertdialog', { name: 'Discard your change?' });
    expect(within(ask).getByText('Your name stays Folake Ire.')).toBeDefined();
    fireEvent.click(within(ask).getByRole('button', { name: 'Discard' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('finds a time zone, sends nothing until one is picked, then saves it', async () => {
    const sent = answering({
      'PUT /api/auth/timezone': () => new Response(null, { status: 204 }),
    });
    open();

    fireEvent.click(await screen.findByRole('button', { name: /Time zone · Africa\/Lagos/ }));
    const field = within(dialog()).getByLabelText('Find your time zone');
    fireEvent.change(field, { target: { value: 'Kin' } });
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Save' }));
    expect(within(dialog()).getByText('Choose a time zone from the list.')).toBeDefined();

    const list = within(dialog()).getByRole('list', { name: 'Time zones' });
    fireEvent.click(within(list).getByRole('button', { name: /Kinshasa/ }));
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Save' }));

    expect(
      await within(card()).findByText(
        'Time zone changed to Kinshasa (UTC+01:00). Times in your emails now use it.',
      ),
    ).toBeDefined();
    expect(sent.find((one) => one.call === 'PUT /api/auth/timezone')?.body).toEqual({
      timezone: 'Africa/Kinshasa',
    });
  });

  it('checks an added address before sending, and keeps it when the server refuses it', async () => {
    answering({
      'GET /api/auth/me': () => json({ ...ME, emailAddresses: [PRIMARY] }),
      'POST /api/auth/emails': () => problem('already_linked', 409),
    });
    open();

    fireEvent.click(await screen.findByRole('button', { name: 'Add an email address' }));
    const field = within(dialog()).getByLabelText('Email address to add');
    fireEvent.change(field, { target: { value: 'folake@gmail' } });
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Add' }));
    expect(field.getAttribute('aria-invalid')).toBe('true');

    fireEvent.change(field, { target: { value: 'folake@lumen.studio' } });
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Add' }));
    expect(
      await within(dialog()).findByText('That address is already linked to an account.'),
    ).toBeDefined();
    expect((field as HTMLInputElement).value).toBe('folake@lumen.studio');
  });

  it('verifies an address in place from the card, and says it stays an alternative', async () => {
    let verified = false;
    const sent = answering({
      'GET /api/auth/me': () => json({ ...ME, emailAddresses: [PRIMARY, { ...OTHER, verified }] }),
      'GET /api/auth/verify/resend': () => json({ cooldownSeconds: 30, codeState: 'live' }),
      'POST /api/auth/verify/email': () => {
        verified = true;
        return json({ ...OTHER, verified: true });
      },
    });
    open();

    fireEvent.click(await within(card()).findByRole('button', { name: 'Send a code' }));
    expect(within(dialog()).getByRole('heading', { name: 'Check your email' })).toBeDefined();
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Verify' }));
    expect(within(dialog()).getByText('Enter the 6-digit code from the email.')).toBeDefined();

    fireEvent.change(within(dialog()).getByLabelText('Code from the email'), {
      target: { value: '123 456' },
    });
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Verify' }));

    expect(
      await within(card()).findByText(
        'folake.adeyemi@gmail.com is verified. It stays an alternative address until you make it primary.',
      ),
    ).toBeDefined();
    expect(sent.find((one) => one.call === 'POST /api/auth/verify/email')?.body).toEqual({
      code: '123456',
      address: 'e2',
    });
  });

  it('says a wrong code on the field, and a spent one in its place', async () => {
    let tries = 0;
    answering({
      'GET /api/auth/me': () =>
        json({ ...ME, emailAddresses: [PRIMARY, { ...OTHER, verified: false }] }),
      'GET /api/auth/verify/resend': () => json({ cooldownSeconds: 0, codeState: 'live' }),
      'POST /api/auth/verify/email': () => {
        tries += 1;
        return problem(
          tries === 1 ? 'verification_code_invalid' : 'verification_code_expired',
          422,
        );
      },
    });
    open();

    fireEvent.click(await within(card()).findByRole('button', { name: 'Send a code' }));
    const field = within(dialog()).getByLabelText('Code from the email');
    fireEvent.change(field, { target: { value: '111111' } });
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Verify' }));
    expect(
      await within(dialog()).findByText(
        'That code does not match. Check the newest email from Soirely and try again.',
      ),
    ).toBeDefined();

    fireEvent.change(field, { target: { value: '222222' } });
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Verify' }));
    expect(await within(dialog()).findByText('That code has expired')).toBeDefined();
    expect(within(dialog()).queryByLabelText('Code from the email')).toBeNull();
  });

  it('says in each section that it did not load, and loads both again from Try again', async () => {
    let fails = true;
    answering({
      'GET /api/auth/me': () => (fails ? problem('server_error', 500) : json(ME)),
    });
    open();

    expect(
      await screen.findByText('Your email addresses did not load. Try again in a moment.'),
    ).toBeDefined();
    expect(
      screen.getByText('Your phone numbers did not load. Try again in a moment.'),
    ).toBeDefined();

    fails = false;
    fireEvent.click(screen.getAllByRole('button', { name: 'Try again' })[0]!);
    expect(await screen.findByText('folake.adeyemi@gmail.com')).toBeDefined();
  });
});

const NEW_PHONE = {
  id: 'p2',
  number: '+2348035550199',
  countryCode: 'NG',
  verified: false,
  primary: false,
  pending: false,
};

describe('codes and proofs at a desk (sc-30411)', () => {
  it('rewords the blank and the wrong code with the label when the code is texted instead (sc-36468)', async () => {
    answering({
      'GET /api/auth/me': () => json({ ...ME, phoneNumbers: [...ME.phoneNumbers, NEW_PHONE] }),
      'GET /api/auth/verify/phone/resend': () =>
        json({ cooldownSeconds: 30, codeState: 'live', route: 'whatsapp' }),
      'POST /api/auth/verify/phone/text-instead': () => json({ route: 'sms_chosen' }),
      'POST /api/auth/verify/phone': () => problem('verification_code_invalid', 422),
    });
    open();

    fireEvent.click(await within(card()).findByRole('button', { name: 'Send a code' }));
    const field = await within(dialog()).findByLabelText<HTMLInputElement>('Code from WhatsApp');
    fireEvent.change(field, { target: { value: '000000' } });
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Verify' }));
    expect(
      await within(dialog()).findByText(
        'That code does not match. Check the newest WhatsApp message from Soirely and try again.',
      ),
    ).toBeDefined();

    fireEvent.click(within(dialog()).getByRole('button', { name: 'Text it to me instead' }));
    expect(
      await within(dialog()).findByText(
        'That code does not match. Check the newest text from Soirely and try again.',
      ),
    ).toBeDefined();
    expect(within(dialog()).getByLabelText('Code from the text')).toBe(field);
    expect(field.value).toBe('000000');

    fireEvent.change(field, { target: { value: '' } });
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Verify' }));
    expect(within(dialog()).getByText('Enter the 6-digit code from the text.')).toBeDefined();
  });

  it('verifies a number from WhatsApp, saying when Text it to me instead fails and when it goes', async () => {
    let verified = false;
    let texts = 0;
    const sent = answering({
      'GET /api/auth/me': () =>
        json({ ...ME, phoneNumbers: [...ME.phoneNumbers, { ...NEW_PHONE, verified }] }),
      'GET /api/auth/verify/phone/resend': () =>
        json({ cooldownSeconds: 30, codeState: 'live', route: 'whatsapp' }),
      'POST /api/auth/verify/phone/text-instead': () => {
        texts += 1;
        return texts === 1 ? problem('server_error', 500) : json({ route: 'sms_chosen' });
      },
      'POST /api/auth/verify/phone': () => {
        verified = true;
        return json({ ...NEW_PHONE, verified: true });
      },
    });
    open();

    fireEvent.click(await within(card()).findByRole('button', { name: 'Send a code' }));
    expect(within(dialog()).getByRole('heading', { name: 'Check your messages' })).toBeDefined();
    expect(await within(dialog()).findByLabelText('Code from WhatsApp')).toBeDefined();

    fireEvent.click(within(dialog()).getByRole('button', { name: 'Text it to me instead' }));
    expect(
      await within(dialog()).findByText('The text could not be sent. Try again in a moment.'),
    ).toBeDefined();

    fireEvent.click(within(dialog()).getByRole('button', { name: 'Text it to me instead' }));
    expect(await within(dialog()).findByText(/^We texted the same code to /)).toBeDefined();
    expect(within(dialog()).queryByRole('button', { name: 'Text it to me instead' })).toBeNull();
    expect(
      within(dialog()).queryByText('The text could not be sent. Try again in a moment.'),
    ).toBeNull();

    fireEvent.change(within(dialog()).getByLabelText('Code from the text'), {
      target: { value: '654321' },
    });
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Verify' }));

    expect(
      await within(card()).findByText(/is verified\. It stays an alternative number until you/),
    ).toBeDefined();
    expect(sent.find((one) => one.call === 'POST /api/auth/verify/phone')?.body).toEqual({
      code: '654321',
      phone: 'p2',
    });
  });

  it('sends one new code for two quick presses, and keeps Send a new code when it fails', async () => {
    let answer: (response: Response) => void = () => {};
    const sent = answering({
      'GET /api/auth/me': () =>
        json({ ...ME, emailAddresses: [PRIMARY, { ...OTHER, verified: false }] }),
      'GET /api/auth/verify/resend': () => json({ cooldownSeconds: 0, codeState: 'live' }),
      'POST /api/auth/verify/resend': () =>
        new Promise<Response>((resolve) => {
          answer = resolve;
        }),
    });
    open();

    fireEvent.click(await within(card()).findByRole('button', { name: 'Send a code' }));
    const resend = await within(dialog()).findByRole('button', { name: 'Send a new code' });
    fireEvent.click(resend);
    fireEvent.click(resend);
    await waitFor(() =>
      expect(sent.filter((one) => one.call === 'POST /api/auth/verify/resend')).toHaveLength(1),
    );
    answer(problem('server_error', 500));

    expect(
      await within(dialog()).findByText('Something went wrong on the way. Try again in a moment.'),
    ).toBeDefined();
    expect(within(dialog()).getByRole('button', { name: 'Send a new code' })).toBeDefined();
    expect(within(dialog()).queryByText(/^Send a new code in /)).toBeNull();
  });

  function backFromGoogle(): void {
    sessionStorage.setItem(
      'soirely.provider.returned',
      JSON.stringify({
        provider: 'google',
        purpose: { kind: 'makePrimary', address: 'e2' },
        signIn: { code: 'the-code', codeVerifier: 'v', redirectUri: 'r', nonce: 'n' },
      }),
    );
  }

  const GOOGLE_ONLY = {
    ...ME,
    hasPassword: false,
    providers: [{ provider: 'google', email: 'folake@gmail.com' }],
  };

  it('asks for the two-factor code after Google, keeping the sign-in, then makes it primary', async () => {
    backFromGoogle();
    const answers = [
      () =>
        problem('two_factor_required', 403, {
          pendingProof: 'kept-1',
          providerEmail: 'folake@gmail.com',
        }),
      () => json({ proof: 'p-g', expiresAt: new Date(Date.now() + 300_000).toISOString() }),
    ];
    const sent = answering({
      'GET /api/auth/me': () => json(GOOGLE_ONLY),
      'GET /api/auth/two-factor': () => json({ on: true }),
      'POST /api/auth/proof': () => answers.shift()!(),
      'PATCH /api/auth/emails/e2/primary': () => json({ ...OTHER, primary: true }),
    });
    open({ hasPassword: false });

    expect(
      await within(await screen.findByRole('dialog')).findByText('Signed in with Google'),
    ).toBeDefined();
    fireEvent.change(within(dialog()).getByLabelText('Code'), { target: { value: '123456' } });
    fireEvent.click(within(dialog()).getByRole('button', { name: 'Continue' }));

    expect(
      await within(card()).findByText(
        'folake.adeyemi@gmail.com is now your primary address. Sign in with it from now on.',
      ),
    ).toBeDefined();
    const proofs = sent.filter((one) => one.call === 'POST /api/auth/proof').map((one) => one.body);
    expect(proofs).toHaveLength(2);
    expect(proofs[0]).toEqual(expect.objectContaining({ provider: 'google' }));
    expect(proofs[1]).toEqual({ pendingProof: 'kept-1', code: '123456' });
    expect(sent.find((one) => one.call === 'PATCH /api/auth/emails/e2/primary')?.body).toEqual({
      proof: 'p-g',
    });
  });

  it('says a Google sign-in that came back too late changed nothing, and offers Google again', async () => {
    backFromGoogle();
    const sent = answering({
      'GET /api/auth/me': () => json(GOOGLE_ONLY),
      'POST /api/auth/proof': () => problem('proof_required', 403),
    });
    open({ hasPassword: false });

    expect(
      await within(await screen.findByRole('dialog')).findByText(
        'Your Google sign-in was more than 5 minutes ago, so nothing has changed yet. Continue with Google again to carry on.',
      ),
    ).toBeDefined();
    expect(within(dialog()).getByRole('button', { name: 'Continue with Google' })).toBeDefined();
    expect(sent.some((one) => one.call === 'PATCH /api/auth/emails/e2/primary')).toBe(false);
  });
});

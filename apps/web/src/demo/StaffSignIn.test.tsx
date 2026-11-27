import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { SAMPLE } from './rules.ts';

const tested = config();

beforeEach(() => __setConfig({ ...tested, environment: 'development' }));

afterEach(() => {
  __setConfig(tested);
  vi.useRealTimers();
});

async function open(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1 }, { timeout: 8000 });

  return router;
}

const wait = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));
const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const press = (name: string) => fireEvent.click(screen.getByRole('button', { name }));

describe('Confirm it’s you on a staff link (sc-4235)', () => {
  it('shows the event, the job and the masked number, and nothing about the shift', async () => {
    await open('/demo/staff-sign-in');

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Confirm it’s you');
    expect(screen.getByText('Staff link')).toBeDefined();
    expect(screen.getByText('Joana & Rui’s wedding')).toBeDefined();
    expect(screen.getByText('Door')).toBeDefined();
    expect(screen.getByText('We’ll send a code to +351 ••• ••• 4512.')).toBeDefined();
    expect(screen.queryByText(/Bisi/u)).toBeNull();
    expect(screen.queryByText(/16:00/u)).toBeNull();
  });

  it('answers Not your number? with the organiser line and sends nothing', async () => {
    await open('/demo/staff-sign-in');

    press('Not your number?');
    expect(screen.getByText('Ask the event’s organiser to change it on the roster.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Send code' }).getAttribute('aria-busy')).toBeNull();
  });

  it('has no way to sign in without a mobile number on the roster', async () => {
    await open('/demo/staff-sign-in?state=no-mobile');

    expect(
      screen.getByText('Ask the event’s organiser to add your mobile number to the roster.'),
    ).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Send code' })).toBeNull();
  });

  it('drops the event on too many tries', async () => {
    await open('/demo/staff-sign-in?state=too-many');

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Too many tries');
    expect(screen.queryByText('Joana & Rui’s wedding')).toBeNull();
  });
});

describe('the phone code, then the shift (sc-4235)', () => {
  it('sends, checks the code before it goes, and opens the shift at once', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const router = await open('/demo/staff-sign-in');

    press('Send code');
    expect(screen.getByRole('button', { name: 'Send code' }).getAttribute('aria-busy')).toBe(
      'true',
    );
    await wait(1000);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Check WhatsApp');
    const field = screen.getByLabelText('Code from WhatsApp');
    expect(field.getAttribute('autocomplete')).toBe('one-time-code');
    await waitFor(() => expect(document.activeElement).toBe(field));

    press('Sign in');
    expect(screen.getByText('Enter the 6-digit code from WhatsApp.')).toBeDefined();
    type('Code from WhatsApp', '4829');
    press('Sign in');
    expect(screen.getByText('The code is 6 digits.')).toBeDefined();

    type('Code from WhatsApp', SAMPLE.code);
    press('Sign in');
    await wait(1000);
    expect(router.state.location.pathname).toBe('/demo/my-night');
  });

  it('asks for the authenticator code next when the account has two-factor', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const router = await open('/demo/staff-sign-in?state=two-factor');

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Enter your code');
    press('Verify and sign in');
    expect(screen.getByText('Enter the 6-digit code from your app.')).toBeDefined();
    type('Code', '714303');
    press('Verify and sign in');
    await wait(1000);
    expect(screen.getByRole('alert').textContent).toBe(
      'That code did not work. Enter the code your app shows now.',
    );
    type('Code', SAMPLE.authenticator);
    press('Verify and sign in');
    await wait(1000);
    expect(router.state.location.pathname).toBe('/demo/my-night');
  });
});

describe('two-factor on an account with no email (sc-4235)', () => {
  it('names the masked number, not an email or a name', async () => {
    await open('/demo/staff-sign-in?state=two-factor-no-email');

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Enter your code');
    expect(
      screen.getByText(
        'Open your authenticator app and enter the 6-digit code for +351 ••• ••• 4512.',
      ),
    ).toBeDefined();
    expect(screen.queryByText(/@/u)).toBeNull();
    expect(screen.queryByText(/Bisi/u)).toBeNull();
  });
});

describe('a second number on an account, after the right code (sc-4235)', () => {
  const said =
    'This is an alternative number on a Soirely account, so it cannot sign you in. Make it that account’s primary number, or ask the event’s organiser to put your primary number on the roster.';

  it('keeps the link’s card and says so in place of the code step, with no Send code', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const router = await open('/demo/staff-sign-in?state=code-alternative');

    type('Code from WhatsApp', SAMPLE.code);
    press('Sign in');
    await wait(1000);

    expect(router.state.location.pathname).toBe('/demo/staff-sign-in');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Confirm it’s you');
    expect(screen.getByText('Staff link')).toBeDefined();
    expect(screen.getByText('Joana & Rui’s wedding')).toBeDefined();
    expect(screen.getByText(said)).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Send code' })).toBeNull();
    expect(screen.queryByLabelText('Code from WhatsApp')).toBeNull();
    expect(screen.queryByText(/@|Bisi|Samuel/u)).toBeNull();
  });

  it('opens on the refusal itself', async () => {
    await open('/demo/staff-sign-in?state=alternative-number');

    expect(screen.getByText(said)).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Send code' })).toBeNull();
  });
});

describe('a member of an organisation that signs in with Google or Apple only (sc-94849)', () => {
  const title = 'Ìrè Events signs in with Google or Apple only';
  const line = (providers: string) =>
    `A code sent to your phone cannot sign you in to this account. Ìrè Events asks everyone in it to use ${providers}.`;

  it('names nothing before the right code, then refuses it in place of the code step', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const router = await open('/demo/staff-sign-in?state=code-provider-only');

    expect(screen.queryByText(/Ìrè|@/u)).toBeNull();
    type('Code from WhatsApp', SAMPLE.code);
    press('Sign in');
    await wait(1000);

    expect(router.state.location.pathname).toBe('/demo/staff-sign-in');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(title);
    expect(screen.getByText('Staff link')).toBeDefined();
    expect(screen.getByText('Joana & Rui’s wedding')).toBeDefined();
    expect(screen.getByText(line('Google'))).toBeDefined();
    expect(screen.getByRole('button', { name: 'Continue with Google' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Continue with Apple' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Send code' })).toBeNull();
    expect(screen.queryByLabelText('Code from WhatsApp')).toBeNull();
    expect(screen.queryByText(/password|@/iu)).toBeNull();
  });

  it('draws only the providers the account has linked, Google before Apple', async () => {
    await open('/demo/staff-sign-in?state=provider-only-apple');

    expect(screen.getByText(line('Apple'))).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Continue with Google' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Continue with Apple' })).toBeDefined();
  });

  it('names both, joined with or, when both are linked', async () => {
    await open('/demo/staff-sign-in?state=provider-only-both');

    expect(screen.getByText(line('Google or Apple'))).toBeDefined();
    const names = screen.getAllByRole('button').map((one) => one.textContent);
    expect(names).toEqual(['Continue with Google', 'Continue with Apple']);
  });

  it('opens the link signed in once a provider signs them in, with no code asked', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const router = await open('/demo/staff-sign-in?state=provider-only');

    press('Continue with Google');
    expect(
      screen.getByRole('button', { name: 'Continue with Google' }).getAttribute('aria-busy'),
    ).toBe('true');
    await wait(1000);

    expect(router.state.location.pathname).toBe('/demo/my-night');
  });
});

describe('signed in as someone else, and signed out (sc-4235)', () => {
  it('names the link’s person and signs out to continue', async () => {
    await open('/demo/staff-sign-in?state=wrong-account');

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'This link is for Bisi Adeyemi.',
    );
    press('Sign out and continue');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Confirm it’s you');
  });

  it('returns Sign out on Your night to Confirm it’s you, with Signed out. as a status', async () => {
    const router = createMemoryRouter(routes, { initialEntries: ['/demo/my-night'] });
    render(<RouterProvider router={router} />);
    await screen.findByText('Your shift', undefined, { timeout: 8000 });

    expect(
      screen.getAllByText(
        'This link is yours alone. You are signed in until Sun, Nov 15, 02:00. Nothing stays on this device.',
      ).length,
    ).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole('button', { name: 'Sign out' })[0]!);
    const status = await screen.findByText('Signed out.', {}, { timeout: 8000 });

    expect(router.state.location.search).toBe('?state=signed-out');
    expect(status.getAttribute('role')).toBe('status');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Confirm it’s you');
  });
});

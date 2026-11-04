import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { demoOpens } from './gate.ts';
import { SAMPLE, TRIES } from './rules.ts';

const tested = config();

function inEnvironment(environment: string): void {
  __setConfig({ ...tested, environment });
}

function at(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);

  return router;
}

async function signInBoard(state = 'first-visit') {
  at(`/demo/sign-in?state=${state}`);
  await screen.findByRole('heading', { level: 1, name: 'Sign in' });
}

function type(label: string, value: string): void {
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
}

/** Sign in pressed, then the demo's pretend wait run out. */
async function press(): Promise<void> {
  fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
  await act(() => vi.advanceTimersByTimeAsync(1000));
}

afterEach(() => {
  __setConfig(tested);
  vi.useRealTimers();
});

describe('the demo opens only where things are tried (sc-28912)', () => {
  it.each(['development', 'dev', 'qa'])('opens in %s', (environment) => {
    expect(demoOpens(environment)).toBe(true);
  });

  it.each(['production', 'staging', 'test', '', 'QA'])('stays shut in "%s"', (environment) => {
    expect(demoOpens(environment)).toBe(false);
  });

  it('shows the way in at the foot of a signed-out page', () => {
    inEnvironment('qa');
    at('/sign-in');

    expect(screen.getByRole('link', { name: 'Design demo' })).toBeDefined();
  });

  it('shows no way in anywhere else', () => {
    inEnvironment('production');
    at('/sign-in');

    expect(screen.queryByRole('link', { name: 'Design demo' })).toBeNull();
  });

  it('answers /demo anywhere else with the not-found page', () => {
    inEnvironment('production');
    at('/demo/sign-in');

    expect(screen.getByRole('heading', { name: 'This page does not exist' })).toBeDefined();
  });
});

describe('the demo', () => {
  beforeEach(() => inEnvironment('development'));

  it('lists the board under its page, with the sample values, and closes back where it opened', async () => {
    const router = at('/register');

    fireEvent.click(screen.getByRole('link', { name: 'Design demo' }));
    await screen.findByRole('heading', { name: 'Design demo' });

    expect(screen.getByRole('heading', { name: '27 · Sign in · desktop polish' })).toBeDefined();
    expect(
      screen.getByRole('heading', { name: '29 · Today · where signing in lands' }),
    ).toBeDefined();
    expect(screen.getByRole('link', { name: /A quiet week/ })).toBeDefined();
    expect(screen.getByRole('link', { name: /Too many tries/ })).toBeDefined();
    expect(screen.getByText(SAMPLE.email)).toBeDefined();
    expect(screen.getByText(SAMPLE.password)).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(router.state.location.pathname).toBe('/register');
  });

  it('checks blank fields before anything is sent, and clears a line once the field is right', async () => {
    await signInBoard();

    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(screen.getByText('Enter your email address.')).toBeDefined();
    expect(screen.getByText('Enter your password.')).toBeDefined();
    expect(document.activeElement).toBe(screen.getByLabelText('Email'));
    expect(screen.getByLabelText('Email').getAttribute('aria-invalid')).toBe('true');

    type('Email', SAMPLE.email);
    expect(screen.queryByText('Enter your email address.')).toBeNull();
    expect(screen.getByText('Enter your password.')).toBeDefined();
  });

  it('refuses another pair under the password, with no field red, and locks at the fifth', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await signInBoard();
    type('Email', SAMPLE.email);
    type('Password', 'not it');

    await press();

    expect(screen.getByText('That email and password do not match.')).toBeDefined();
    expect(document.activeElement).toBe(screen.getByLabelText('Password'));
    expect(screen.getByLabelText('Password').getAttribute('aria-invalid')).toBe('false');
    expect(screen.getByLabelText('Email').getAttribute('aria-invalid')).toBe('false');

    for (let tries = 1; tries < TRIES; tries++) await press();

    expect(screen.getByText('Too many tries')).toBeDefined();
    const locked = screen.getByRole('button', { name: /^Try again at \d\d:\d\d$/ });
    expect(locked.getAttribute('aria-disabled')).toBe('true');

    await act(() => vi.advanceTimersByTimeAsync(61_000));
    expect(screen.queryByText('Too many tries')).toBeNull();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeDefined();
  });

  it('lands the sample pair on Today, and Settings goes back to the list (sc-29092)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await signInBoard();
    type('Email', SAMPLE.email);
    type('Password', SAMPLE.password);

    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByRole('button', { name: 'Signing in…' })).toBeDefined();
    await act(() => vi.advanceTimersByTimeAsync(1000));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Good morning, Folake' }),
    ).toBeDefined();
    fireEvent.click(screen.getByRole('link', { name: 'Settings' }));
    expect(await screen.findByRole('heading', { name: 'Design demo' })).toBeDefined();
  });

  it('lands Google and Apple on Today too', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await signInBoard();

    fireEvent.click(screen.getByRole('button', { name: 'Continue with Apple' }));
    await act(() => vi.advanceTimersByTimeAsync(1000));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Good morning, Folake' }),
    ).toBeDefined();
  });

  it('opens the language menu from the keyboard and returns focus to its button', async () => {
    await signInBoard();
    const button = screen.getByRole('button', { name: 'Language: English' });

    fireEvent.keyDown(button, { key: 'ArrowDown' });
    const english = screen.getByRole('menuitemradio', { name: 'English' });
    expect(document.activeElement).toBe(english);
    expect(english.getAttribute('aria-checked')).toBe('true');

    fireEvent.keyDown(english, { key: 'ArrowDown' });
    const spanish = screen.getByRole('menuitemradio', { name: /Español/ });
    expect(document.activeElement).toBe(spanish);

    fireEvent.click(spanish);
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Language: Español' }));
    expect(screen.getByRole('heading', { name: 'Sign in' })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Language: Español' }));
    fireEvent.keyDown(screen.getByRole('menuitemradio', { name: /Español/ }), { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('opens the create-account board from the header, and the footer pages as stand-ins (sc-28981, sc-29061)', async () => {
    await signInBoard();

    expect(screen.queryByText('New here?')).toBeNull();
    fireEvent.click(screen.getByRole('link', { name: 'Create an account' }));
    expect(await screen.findByRole('heading', { name: 'Create your account' })).toBeDefined();

    fireEvent.click(screen.getByRole('link', { name: 'Terms' }));
    expect(await screen.findByRole('heading', { name: 'Terms' })).toBeDefined();

    fireEvent.click(screen.getByRole('link', { name: 'Privacy' }));
    expect(await screen.findByRole('heading', { name: 'Privacy' })).toBeDefined();
  });

  it('returns focus to the language button when a click outside closes the menu', async () => {
    await signInBoard();
    const button = screen.getByRole('button', { name: 'Language: English' });
    fireEvent.keyDown(button, { key: 'ArrowDown' });

    const pressed = fireEvent.mouseDown(screen.getByRole('heading', { name: 'Sign in' }));
    expect(pressed).toBe(false);
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(button);
  });

  it('answers an unknown demo address with the not-found page (sc-28981)', async () => {
    at('/demo/nope');

    expect(await screen.findByRole('heading', { name: 'This page does not exist' })).toBeDefined();
  });

  it('gives the form way to the providers when password sign-in is off', async () => {
    await signInBoard('provider-only');

    expect(screen.getByText('Ire Events signs in with Google or Apple only')).toBeDefined();
    expect(screen.queryByLabelText('Password')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Sign in with another account' }));
    expect(screen.getByLabelText('Password')).toBeDefined();
  });
});

describe('the demo creates an account (sc-29061)', () => {
  beforeEach(() => {
    inEnvironment('development');
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  async function wait(): Promise<void> {
    await act(() => vi.advanceTimersByTimeAsync(1000));
  }

  async function page(query: string, title: string) {
    const router = at(`/demo/create-account${query}`);
    await screen.findByRole('heading', { level: 1, name: title });

    return router;
  }

  it('lists the board under its own heading on the demo home, with the code', async () => {
    at('/demo');
    await screen.findByRole('heading', { name: 'Design demo' });

    expect(screen.getByRole('heading', { name: 'Create an account · desktop' })).toBeDefined();
    expect(screen.getByRole('heading', { name: 'The phone code' })).toBeDefined();
    expect(screen.getByRole('link', { name: /Too many wrong tries/ })).toBeDefined();
    expect(screen.getByText(SAMPLE.code)).toBeDefined();
  });

  it('checks blank fields first, with focus on Full name', async () => {
    await page('', 'Create your account');
    expect(screen.getByRole('link', { name: 'Sign in' })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));

    expect(screen.getByText('Enter your full name.')).toBeDefined();
    expect(screen.getByText('Enter your email address.')).toBeDefined();
    expect(screen.getByText('Enter a password.')).toBeDefined();
    expect(document.activeElement).toBe(screen.getByLabelText('Full name'));
  });

  it('says a short password is short, and ticks the rule at 15 characters', async () => {
    await page('', 'Create your account');
    type('Full name', SAMPLE.name);
    type('Email', SAMPLE.email);
    type('Password', 'nine char');

    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    expect(screen.getByText('Use at least 15 characters.')).toBeDefined();
    expect(document.activeElement).toBe(screen.getByLabelText('Password'));
    expect(document.querySelector('.demo-rule-met')).toBeNull();

    type('Password', '123456789012345');
    expect(screen.queryByText('Use at least 15 characters.')).toBeNull();
    expect(document.querySelector('.demo-rule-met')).not.toBeNull();
  });

  it('refuses a breached password under the field and under the title', async () => {
    await page('', 'Create your account');
    type('Full name', SAMPLE.name);
    type('Email', SAMPLE.email);
    type('Password', SAMPLE.breachedPassword);

    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    await wait();

    expect(screen.getByText('Creating your account did not work')).toBeDefined();
    expect(screen.queryByText(/we email you a code/)).toBeNull();
    expect(screen.getByText(/appeared in a known data breach. Choose another/)).toBeDefined();
    expect(document.activeElement).toBe(screen.getByLabelText('Password'));
  });

  it('holds the button until too many sign-ups lifts, then lifts itself', async () => {
    await page('?page=register&state=limited', 'Create your account');

    expect(screen.getByText('Too many sign-ups from this network')).toBeDefined();
    const held = screen.getByRole('button', { name: /^Try again at \d\d:\d\d$/ });
    expect(held.getAttribute('aria-disabled')).toBe('true');

    await act(() => vi.advanceTimersByTimeAsync(61_000));
    expect(screen.getByRole('button', { name: 'Create account' })).toBeDefined();
  });

  it('goes from Create account to the email code, and Back keeps the name and email only', async () => {
    await page('', 'Create your account');
    type('Full name', SAMPLE.name);
    type('Email', SAMPLE.email);
    type('Password', SAMPLE.password);
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }));
    await wait();

    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeDefined();
    expect(screen.getByText('Step 1 of 2')).toBeDefined();
    expect(screen.getByRole('link', { name: 'Sign out' })).toBeDefined();

    fireEvent.click(screen.getByRole('link', { name: 'Back' }));
    await screen.findByRole('heading', { name: 'Create your account' });
    expect((screen.getByLabelText('Full name') as HTMLInputElement).value).toBe(SAMPLE.name);
    expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe(SAMPLE.email);
    expect((screen.getByLabelText('Password') as HTMLInputElement).value).toBe('');
  });

  it('takes six digits only when sent, keeps a wrong code selected, and verifies the right one', async () => {
    await page('?page=email', 'Check your email');
    const code = screen.getByLabelText('Code from the email') as HTMLInputElement;
    expect(code.getAttribute('autocomplete')).toBe('one-time-code');
    expect(code.getAttribute('inputmode')).toBe('numeric');

    type('Code from the email', '482 19x3 7');
    expect(code.value).toBe('482193');
    expect(screen.queryByRole('button', { name: 'Verifying…' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Verify email' }));
    await wait();
    expect(screen.getByText(/That code does not match/)).toBeDefined();
    expect(code.value).toBe('482193');
    expect(document.activeElement).toBe(code);
    expect(code.selectionStart).toBe(0);
    expect(code.selectionEnd).toBe(6);

    type('Code from the email', SAMPLE.code);
    fireEvent.click(screen.getByRole('button', { name: 'Verify email' }));
    await wait();
    expect(screen.getByRole('heading', { name: 'Email verified' })).toBeDefined();
  });

  it('gives a dead code one Send a new code button in the field’s place', async () => {
    await page('?page=email&state=expired', 'Check your email');

    expect(screen.getByText('That code has expired')).toBeDefined();
    expect(screen.queryByLabelText('Code from the email')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Send a new code' }));
    await wait();
    expect(document.activeElement).toBe(screen.getByLabelText('Code from the email'));
    expect(screen.getByText('Send a new code in 1:00')).toBeDefined();
  });

  it('ends wrong codes at the fifth try', async () => {
    await page('?page=email', 'Check your email');

    for (let tries = 0; tries < TRIES; tries++) {
      type('Code from the email', '111111');
      fireEvent.click(screen.getByRole('button', { name: 'Verify email' }));
      await wait();
    }

    expect(screen.getByText('Too many wrong tries')).toBeDefined();
  });

  it('counts the resend down to a link, and a new code clears the wrong one', async () => {
    await page('?page=email&state=wrong', 'Check your email');
    expect(screen.getByText('Send a new code in 1:00')).toBeDefined();

    for (let second = 0; second <= 60; second++) await act(() => vi.advanceTimersByTimeAsync(1000));
    fireEvent.click(screen.getByRole('button', { name: 'Send a new code' }));
    expect(screen.getByRole('button', { name: 'Sending…' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Verifying…' })).toBeNull();
    await act(() => vi.advanceTimersByTimeAsync(1000));

    expect(screen.getByText('Send a new code in 1:00')).toBeDefined();
    expect(screen.queryByText(/That code does not match/)).toBeNull();
    expect((screen.getByLabelText('Code from the email') as HTMLInputElement).value).toBe('');
  });

  it('refuses no organisation and a short number on Save, with focus on the organisation', async () => {
    await page('?page=details', 'A few details');
    expect(screen.getByText('Step 2 of 2')).toBeDefined();
    expect(screen.queryByRole('link', { name: 'Back' })).toBeNull();
    type('Mobile number', '7400 12');

    fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }));

    expect(screen.getByText('Add your organisation’s name to carry on.')).toBeDefined();
    expect(screen.getByText(/too short for United Kingdom/)).toBeDefined();
    expect(screen.queryByText(/Your events belong to it/)).toBeNull();
    expect(screen.queryByText(/How you are reached on the night/)).toBeNull();
    expect(document.activeElement).toBe(screen.getByLabelText('Organisation name'));
  });

  it('carries the number to the phone code, texts it instead, and continues to Soirely', async () => {
    await page('?page=details', 'A few details');
    type('Organisation name', SAMPLE.organisation);
    type('Mobile number', SAMPLE.number);
    fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }));
    await wait();

    await screen.findByRole('heading', { name: 'Check your messages' });
    expect(screen.getByText(/your WhatsApp on \+44 7400 123456/)).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Text it to me instead' }));
    await wait();
    expect(screen.getByText(/We texted the same code/)).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Text it to me instead' })).toBeNull();

    type('Code from WhatsApp', SAMPLE.code);
    fireEvent.click(screen.getByRole('button', { name: 'Verify number' }));
    await wait();
    fireEvent.click(screen.getByRole('button', { name: 'Continue to Soirely' }));
    expect(await screen.findByRole('heading', { name: 'Signed in' })).toBeDefined();
  });

  it('changes the number from the code, and Back returns to a code that still works', async () => {
    await page('?page=phone', 'Check your messages');
    fireEvent.click(screen.getByRole('link', { name: 'Change it' }));
    await screen.findByRole('heading', { name: 'Change your mobile number' });
    expect(screen.getByRole('link', { name: 'Sign out' })).toBeDefined();

    fireEvent.click(screen.getByRole('link', { name: 'Back' }));
    await screen.findByRole('heading', { name: 'Check your messages' });
    type('Code from WhatsApp', SAMPLE.code);
    fireEvent.click(screen.getByRole('button', { name: 'Verify number' }));
    await wait();
    expect(screen.getByRole('heading', { name: 'Number verified' })).toBeDefined();
  });

  it('shows Loading… only after 400 ms, with an empty header end', async () => {
    at('/demo/create-account?page=register&state=loading');

    expect(screen.queryByText('Loading…')).toBeNull();
    await act(() => vi.advanceTimersByTimeAsync(450));
    expect(screen.getByText('Loading…')).toBeDefined();
    expect(screen.queryByRole('link', { name: 'Sign in' })).toBeNull();
  });

  it('makes the page the message when Soirely cannot be reached, until the switch brings it back', async () => {
    await page('?page=email&state=offline', 'Cannot reach Soirely');
    expect(screen.getByText(/^You are still signed in\./)).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await wait();
    expect(screen.getByRole('heading', { name: 'Cannot reach Soirely' })).toBeDefined();

    fireEvent.click(screen.getByRole('switch', { name: /connection is back/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await wait();
    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeDefined();
  });
});

describe('the demo gets a password back (sc-29064)', () => {
  beforeEach(() => {
    inEnvironment('development');
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  async function wait(): Promise<void> {
    await act(() => vi.advanceTimersByTimeAsync(1000));
  }

  async function page(query: string, title: string) {
    const router = at(`/demo/get-back-in${query}`);
    await screen.findByRole('heading', { level: 1, name: title });

    return router;
  }

  it('lists the board on the demo home', async () => {
    at('/demo');
    await screen.findByRole('heading', { name: 'Design demo' });

    expect(screen.getByRole('heading', { name: 'Getting back in · desktop' })).toBeDefined();
    expect(screen.getByRole('link', { name: /This link has already been used/ })).toBeDefined();
  });

  it('opens from sign-in with the email typed there, and Back returns to that sign-in', async () => {
    await signInBoard('signed-out');
    type('Email', 'ade@ire.events');
    fireEvent.click(screen.getByRole('link', { name: 'Forgot your password?' }));

    await screen.findByRole('heading', { name: 'Reset your password' });
    expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('ade@ire.events');
    expect(screen.getByText('Remembered it?')).toBeDefined();

    fireEvent.click(screen.getByRole('link', { name: 'Back' }));
    await screen.findByRole('heading', { name: 'Sign in' });
    expect(screen.getByText('You were signed out')).toBeDefined();
  });

  it('says a link already sent still works when there are too many requests', async () => {
    await page('?page=reset&state=limited', 'Reset your password');

    expect(screen.getByText('Too many requests')).toBeDefined();
    expect(screen.getByText(/Any link already sent still works\.$/)).toBeDefined();
  });

  it('sends the link, sends it again on the same page, and Back keeps the address', async () => {
    await page('', 'Reset your password');
    type('Email', '');
    fireEvent.click(screen.getByRole('button', { name: 'Send the link' }));
    expect(screen.getByText('Enter your email address.')).toBeDefined();

    type('Email', 'ade@ire.events');
    fireEvent.click(screen.getByRole('button', { name: 'Send the link' }));
    await wait();
    await screen.findByRole('heading', { name: 'Check your email' });
    expect(screen.queryByRole('link', { name: 'Sign in' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'send it again' }));
    await wait();
    expect(screen.getByRole('heading', { name: 'Check your email' })).toBeDefined();
    expect(screen.getByText('Sent again.')).toBeDefined();

    fireEvent.click(screen.getByRole('link', { name: 'Back' }));
    await screen.findByRole('heading', { name: 'Reset your password' });
    expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('ade@ire.events');
  });

  it('refuses a short new password, ticks the rule at 15, and signs in', async () => {
    await page('?page=new', 'Set a new password');
    expect(screen.queryByRole('link', { name: 'Back' })).toBeNull();
    type('New password', 'nine char');
    fireEvent.click(screen.getByRole('button', { name: 'Set password and sign in' }));

    expect(screen.getByText('Use at least 15 characters.')).toBeDefined();
    expect(document.activeElement).toBe(screen.getByLabelText('New password'));
    expect(document.querySelector('.demo-rule-met')).toBeNull();

    type('New password', SAMPLE.password);
    expect(document.querySelector('.demo-rule-met')).not.toBeNull();
    fireEvent.submit(screen.getByLabelText('New password'));
    await wait();

    await screen.findByRole('heading', { name: 'Password changed' });
    expect(screen.getByRole('link', { name: 'Sign out' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Continue to Soirely' }));
    expect(await screen.findByRole('navigation', { name: 'Soirely' })).toBeDefined();
  });

  it.each([
    ['expired', 'This link has expired'],
    ['used', 'This link has already been used'],
    ['broken', 'This link doesn’t work'],
  ])('gives a %s link its own title and one button for a new link', async (state, title) => {
    await page(`?page=link&state=${state}`, title);

    fireEvent.click(screen.getByRole('button', { name: 'Send a new link' }));
    await wait();
    expect(await screen.findByRole('heading', { name: 'Check your email' })).toBeDefined();
  });

  it('shows Cannot reach Soirely while the link is read, until the switch brings it back', async () => {
    await page('?page=link&state=offline', 'Cannot reach Soirely');

    fireEvent.click(screen.getByRole('switch', { name: /connection is back/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await wait();
    expect(await screen.findByRole('heading', { name: 'Set a new password' })).toBeDefined();
  });

  it('asks for the code first, and changes nothing until it passes', async () => {
    await page('?page=code', 'Enter your code');
    expect(screen.queryByText(/No code\?/)).toBeNull();
    expect(
      screen.getByRole('link', { name: 'Lost your authenticator and your recovery codes?' }),
    ).toBeDefined();

    for (let tries = 0; tries <= TRIES; tries++) {
      type('Code', '111111');
      fireEvent.click(screen.getByRole('button', { name: 'Continue to a new password' }));
      await wait();
    }
    expect(screen.getByText(/That code did not work/)).toBeDefined();

    type('Code', SAMPLE.code);
    fireEvent.click(screen.getByRole('button', { name: 'Continue to a new password' }));
    await wait();
    expect(await screen.findByRole('heading', { name: 'Set a new password' })).toBeDefined();
  });

  it.each([
    ['Use a recovery code instead', 'Enter a recovery code'],
    ['Lost your authenticator and your recovery codes?', 'Get back in without your authenticator'],
  ])('follows “%s” to the two-factor board’s page', async (link, heading) => {
    await page('?page=code', 'Enter your code');
    fireEvent.click(screen.getByRole('link', { name: link }));
    expect(await screen.findByRole('heading', { name: heading })).toBeDefined();
  });
});

describe('the demo signs in with two-factor (sc-29063)', () => {
  beforeEach(() => {
    inEnvironment('development');
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  async function wait(ms = 1000): Promise<void> {
    await act(() => vi.advanceTimersByTimeAsync(ms));
  }

  async function page(query: string, title: string) {
    const router = at(`/demo/two-factor${query}`);
    await screen.findByRole('heading', { level: 1, name: title });

    return router;
  }

  it('lists the board on the demo home, with the authenticator and recovery codes', async () => {
    at('/demo');
    await screen.findByRole('heading', { name: 'Design demo' });

    expect(screen.getByRole('heading', { name: 'Two-factor · desktop' })).toBeDefined();
    expect(screen.getByRole('link', { name: /Too many wrong codes/ })).toBeDefined();
    expect(screen.getByText(SAMPLE.authenticator)).toBeDefined();
    expect(screen.getByText(SAMPLE.recovery)).toBeDefined();
  });

  it('walks from sign-in to the code, and Back returns with the email kept', async () => {
    await signInBoard();
    fireEvent.click(screen.getByRole('switch', { name: /uses two-factor/ }));
    type('Email', SAMPLE.email);
    type('Password', SAMPLE.password);
    await press();

    await screen.findByRole('heading', { name: 'Enter your code' });
    expect(document.querySelector('.demo-page-new')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Back to sign in' })).toBeNull();

    fireEvent.click(screen.getByRole('link', { name: 'Back' }));
    await screen.findByRole('heading', { name: 'Sign in' });
    expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe(SAMPLE.email);
  });

  it('sends the code on Enter, keeps a wrong one selected, and signs in with the right one', async () => {
    await page('?page=code', 'Enter your code');
    type('Code', '1234567');
    expect((screen.getByLabelText('Code') as HTMLInputElement).value).toBe('123456');

    fireEvent.submit(screen.getByLabelText('Code'));
    await wait();
    const field = screen.getByLabelText('Code') as HTMLInputElement;
    expect(screen.getByText(/^That code did not work/)).toBeDefined();
    expect(field.value).toBe('123456');
    expect(document.activeElement).toBe(field);
    expect(field.selectionEnd! - field.selectionStart!).toBe(6);

    type('Code', SAMPLE.authenticator);
    fireEvent.click(screen.getByRole('button', { name: 'Verify and sign in' }));
    await wait();
    expect(await screen.findByRole('heading', { level: 1, name: /Folake/ })).toBeDefined();
  });

  it('pauses after too many wrong codes, with the reset link, and lifts itself', async () => {
    await page('?page=code', 'Enter your code');
    for (let tries = 0; tries < TRIES; tries++) {
      type('Code', '111111');
      fireEvent.submit(screen.getByLabelText('Code'));
      await wait();
    }

    expect(screen.getByText('Too many wrong codes')).toBeDefined();
    expect((screen.getByLabelText('Code') as HTMLInputElement).value).toBe('');
    const paused = screen.getByRole('button', { name: /^Try again at \d\d:\d\d$/ });
    expect(paused.getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByRole('link', { name: 'Reset your password' })).toBeDefined();

    await wait(61_000);
    expect(screen.queryByText('Too many wrong codes')).toBeNull();
    expect(screen.getByRole('button', { name: 'Verify and sign in' })).toBeDefined();
  });

  it('takes a recovery code in any case with the dash put in, and says a used one is used', async () => {
    await page('?page=code', 'Enter your code');
    fireEvent.click(screen.getByRole('link', { name: 'Use a recovery code instead' }));
    await screen.findByRole('heading', { name: 'Enter a recovery code' });

    type('Recovery code', SAMPLE.usedRecovery.toUpperCase().replace('-', ''));
    expect((screen.getByLabelText('Recovery code') as HTMLInputElement).value).toBe(
      SAMPLE.usedRecovery,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Use this code' }));
    await wait();
    expect(screen.getByText(/already been used/)).toBeDefined();

    type('Recovery code', SAMPLE.recovery.toUpperCase());
    fireEvent.click(screen.getByRole('button', { name: 'Use this code' }));
    await wait();
    expect(await screen.findByRole('heading', { level: 1, name: /Folake/ })).toBeDefined();
  });

  it('sends the codes from Start, and Back steps back through it to the code', async () => {
    await page('?page=start', 'Get back in without your authenticator');
    expect(screen.getAllByRole('listitem')).toHaveLength(3);

    fireEvent.click(screen.getByRole('button', { name: 'Send the codes' }));
    await wait();
    await screen.findByRole('heading', { name: 'Enter both codes' });
    expect(screen.getByText(`Sent to ${SAMPLE.email}`)).toBeDefined();

    fireEvent.click(screen.getByRole('link', { name: 'Back' }));
    await screen.findByRole('heading', { name: 'Get back in without your authenticator' });
    fireEvent.click(screen.getByRole('link', { name: 'Back' }));
    expect(await screen.findByRole('heading', { name: 'Enter your code' })).toBeDefined();
  });

  it('says too many requests under the title at the fourth ask in a day', async () => {
    for (let asks = 0; asks < 3; asks++) {
      if (asks === 0) await page('?page=start', 'Get back in without your authenticator');
      else fireEvent.click(screen.getByRole('link', { name: 'Back' }));
      await screen.findByRole('heading', { name: 'Get back in without your authenticator' });
      fireEvent.click(screen.getByRole('button', { name: 'Send the codes' }));
      await wait();
      await screen.findByRole('heading', { name: 'Enter both codes' });
    }

    fireEvent.click(screen.getByRole('link', { name: 'Back' }));
    await screen.findByRole('heading', { name: 'Get back in without your authenticator' });
    fireEvent.click(screen.getByRole('button', { name: 'Send the codes' }));
    await wait();
    expect(screen.getByText('Too many requests')).toBeDefined();
  });

  it('counts every ask toward the fourth, through the code page and back', async () => {
    await page('?page=start', 'Get back in without your authenticator');
    for (let asks = 0; asks < 3; asks++) {
      fireEvent.click(screen.getByRole('button', { name: 'Send the codes' }));
      await wait();
      await screen.findByRole('heading', { name: 'Enter both codes' });
      fireEvent.click(screen.getByRole('link', { name: 'Back' }));
      await screen.findByRole('heading', { name: 'Get back in without your authenticator' });
      fireEvent.click(screen.getByRole('link', { name: 'Back' }));
      await screen.findByRole('heading', { name: 'Enter your code' });
      fireEvent.click(
        screen.getByRole('link', { name: 'Lost your authenticator and your recovery codes?' }),
      );
      await screen.findByRole('heading', { name: 'Get back in without your authenticator' });
    }

    fireEvent.click(screen.getByRole('button', { name: 'Send the codes' }));
    await wait();
    expect(screen.getByText('Too many requests')).toBeDefined();
  });

  it('asks for only the email’s code without a verified phone, and both make the ask', async () => {
    await page('?page=codes', 'Enter both codes');
    fireEvent.click(screen.getByRole('switch', { name: /no verified phone/ }));
    expect(screen.getByRole('heading', { name: 'Enter the code' })).toBeDefined();
    expect(screen.queryByLabelText('Code from WhatsApp')).toBeNull();

    fireEvent.click(screen.getByRole('switch', { name: /no verified phone/ }));
    type('Code from the email', SAMPLE.code);
    type('Code from WhatsApp', '000000');
    fireEvent.click(screen.getByRole('button', { name: 'Ask to get back in' }));
    await wait();
    expect(screen.getByText(/newest WhatsApp message/)).toBeDefined();

    type('Code from WhatsApp', SAMPLE.code);
    fireEvent.click(screen.getByRole('button', { name: 'Ask to get back in' }));
    await wait();
    expect(screen.getByRole('heading', { name: 'Waiting for your organisation' })).toBeDefined();
  });

  it('waits with no Back, and finds the demo’s answer at the next look, 20 seconds on', async () => {
    await page('?page=waiting', 'Waiting for your organisation');
    expect(screen.queryByRole('link', { name: 'Back' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Back to sign in' })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Demo: Turn down' }));
    await wait(5000);
    expect(screen.getByRole('heading', { name: 'Waiting for your organisation' })).toBeDefined();
    await wait(20_000);
    expect(screen.getByRole('heading', { name: 'Your request was turned down' })).toBeDefined();
  });

  it('cancels the request from the waiting page and says nothing changed', async () => {
    await page('?page=waiting', 'Waiting for your organisation');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel the request' }));
    await wait();
    expect(screen.getByRole('heading', { name: 'Request cancelled' })).toBeDefined();
    expect(screen.getByText(/^Nothing changed/)).toBeDefined();
  });

  it.each([
    ['ended', 'Your request ended', 'Ask again'],
    ['replaced', 'A newer request replaced this one', 'Start again'],
  ])('offers to start over when the request %s', async (ending, title, again) => {
    await page(`?page=${ending}`, title);
    fireEvent.click(screen.getByRole('link', { name: again }));
    expect(
      await screen.findByRole('heading', { name: 'Get back in without your authenticator' }),
    ).toBeDefined();
  });

  it('signs in from Two-factor is off with the email filled, then asks to set it up again', async () => {
    await page('?page=off', 'Two-factor is off');
    fireEvent.click(screen.getByRole('link', { name: 'Sign in' }));
    await screen.findByRole('heading', { name: 'Sign in' });
    expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe(SAMPLE.email);

    type('Password', SAMPLE.password);
    await press();
    await screen.findByRole('heading', { name: 'Set up two-factor again' });
    expect(screen.getByText(/Your account › Security/)).toBeDefined();
    expect(screen.getByRole('link', { name: 'Not now' })).toBeDefined();
  });

  it('does nothing on This wasn’t you? until the button, then says it is done', async () => {
    await page('?page=not-me', 'This wasn’t you?');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel and sign out everywhere' }));
    await wait();
    expect(screen.getByRole('heading', { name: 'Cancelled and signed out' })).toBeDefined();
  });
});

describe('the demo’s other ways in (sc-29062)', () => {
  beforeEach(() => {
    inEnvironment('development');
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  async function wait(): Promise<void> {
    await act(() => vi.advanceTimersByTimeAsync(1000));
  }

  async function page(query: string, title: string) {
    const router = at(`/demo/ways-in${query}`);
    await screen.findByRole('heading', { level: 1, name: title });

    return router;
  }

  it('lists the board on the demo home, with its organisation and inviter', async () => {
    at('/demo');
    await screen.findByRole('heading', { name: 'Design demo' });

    expect(screen.getByRole('heading', { name: 'Other ways in · desktop' })).toBeDefined();
    expect(screen.getByRole('heading', { name: 'An invitation' })).toBeDefined();
    expect(screen.getByText(`${SAMPLE.inviter}, ${SAMPLE.role}`)).toBeDefined();
    expect(screen.getByRole('link', { name: /Cooling off/ })).toBeDefined();
  });

  it('offers both ways in on a request link signed out, with the header’s end empty', async () => {
    await page('', 'Ask to join Ire Events');

    expect(screen.getByText('Request link')).toBeDefined();
    const ways = screen.getAllByRole('link').map((link) => link.textContent);
    expect(ways.indexOf('Sign in')).toBeLessThan(ways.indexOf('Create an account'));
    expect(screen.queryByRole('link', { name: 'Sign out' })).toBeNull();
    expect(screen.queryByText('New to Soirely?')).toBeNull();
  });

  it('counts the message live, refuses one over 500, and says the request went', async () => {
    await page('?page=ask&state=signed-in', 'Ask to join Ire Events');
    expect(screen.getByRole('link', { name: 'Sign out' })).toBeDefined();
    expect(screen.getByText('0 of 500 characters.')).toBeDefined();

    type('Message', 'x'.repeat(501));
    expect(screen.getByText('501 of 500 characters.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Ask to join' }));
    expect(screen.getByText('Keep your message to 500 characters or fewer.')).toBeDefined();
    expect(document.activeElement).toBe(screen.getByLabelText('Message'));

    type('Message', 'Hi Ade, it’s Folake from the Lagos team.');
    expect(screen.getByText('40 of 500 characters.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Ask to join' }));
    await wait();
    expect(screen.getByText('Your request has gone to Ire Events')).toBeDefined();
    expect(screen.getByRole('link', { name: 'Continue' })).toBeDefined();
  });

  it('says a dead link once, with one way on', async () => {
    await page('?page=ask&state=dead', 'This link does not work');

    expect(screen.getByText('Ask the organisation for a new one.')).toBeDefined();
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByRole('link', { name: 'Go to Soirely' })).toBeDefined();
  });

  it('joins from an invitation signed out, with the address fixed', async () => {
    await page('?page=invitation', 'Join Ire Events');
    expect(screen.getByText('Already have an account?')).toBeDefined();
    const email = screen.getByLabelText('Email') as HTMLInputElement;
    expect(email.value).toBe(SAMPLE.email);
    expect(email.readOnly).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: 'Create account and join' }));
    expect(screen.getByText('Enter your full name.')).toBeDefined();
    expect(document.activeElement).toBe(screen.getByLabelText('Full name'));

    type('Full name', SAMPLE.name);
    type('Password', SAMPLE.password);
    fireEvent.click(screen.getByRole('button', { name: 'Create account and join' }));
    await wait();
    expect(await screen.findByRole('heading', { name: 'You are in' })).toBeDefined();
    expect(screen.getByRole('link', { name: 'Open Ire Events' })).toBeDefined();
  });

  it('works the pressed answer and holds the other', async () => {
    await page('?page=invitation&state=signed-in', 'Join Ire Events?');

    fireEvent.click(screen.getByRole('button', { name: 'Decline' }));
    expect(screen.getByRole('button', { name: 'Declining…' })).toBeDefined();
    expect(
      screen.getByRole('button', { name: 'Accept and join' }).getAttribute('aria-disabled'),
    ).toBe('true');

    await wait();
    expect(await screen.findByRole('heading', { name: 'Invitation declined' })).toBeDefined();
  });

  it.each([
    ['expired', 'This invitation has expired'],
    ['withdrawn', 'This invitation was withdrawn'],
    ['declined', 'Already declined'],
    ['not-yours', 'This invitation is for someone else'],
    ['deleted', 'This organisation is gone'],
  ])('refuses %s with the title, and a line that does not repeat it', async (state, title) => {
    await page(`?page=invitation&state=${state}`, title);

    const line = document.querySelector('.demo-heading .demo-muted')?.textContent ?? '';
    expect(line).not.toBe('');
    expect(line.includes(title)).toBe(false);
  });

  it('offers Sign out on an invitation that is not yours', async () => {
    await page('?page=invitation&state=not-yours', 'This invitation is for someone else');

    fireEvent.click(screen.getByRole('link', { name: `Sign out and use ${SAMPLE.email}` }));
    expect(await screen.findByRole('heading', { name: 'Join Ire Events' })).toBeDefined();
  });

  it('holds the organisation fields and Save until the company offer is answered', async () => {
    await page('?page=details&state=company', 'A few details');

    expect(screen.getByText('Ire Events uses Soirely')).toBeDefined();
    expect(screen.queryByLabelText('Organisation name')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Save and continue' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Start my own organisation' }));
    expect(screen.getByLabelText('Organisation name')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Save and continue' })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: /^Ask to join an organisation at/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Ask to join Ire Events' }));
    await wait();
    expect(
      await screen.findByRole('heading', { name: 'Waiting for Ire Events to approve you' }),
    ).toBeDefined();
    expect(screen.getByText(`Waiting for approval · asked ${SAMPLE.askedOn}`)).toBeDefined();
  });

  it('answers a waiting invitation on the details page, with the fields under it', async () => {
    await page('?page=details&state=invitation', 'A few details');

    expect(screen.getByText('Or start your own organisation')).toBeDefined();
    expect(screen.getByLabelText('Organisation name')).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Accept and join' }));
    await wait();
    expect(await screen.findByRole('heading', { name: 'You are in' })).toBeDefined();
  });

  it('holds the invitation’s answers while Save and continue is saving', async () => {
    await page('?page=details&state=invitation', 'A few details');
    type('Organisation name', SAMPLE.organisation);
    type('Mobile number', SAMPLE.number);

    fireEvent.click(screen.getByRole('button', { name: 'Save and continue' }));
    const accept = screen.getByRole('button', { name: 'Accept and join' });
    expect(accept.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(accept);

    expect(screen.queryByText('Joining…')).toBeNull();
    await wait();
    expect(screen.queryByRole('heading', { name: 'You are in' })).toBeNull();
  });

  it('says Google signed in under the title, with no Back', async () => {
    await page('?page=details&state=google', 'A few details');

    expect(screen.getByText('Signed in with Google')).toBeDefined();
    expect((screen.getByLabelText('Full name') as HTMLInputElement).value).toBe(SAMPLE.name);
    expect(screen.queryByRole('link', { name: 'Back' })).toBeNull();
  });

  it('opens Apple’s first sign-in with Full name empty and focused', async () => {
    await page('?page=details&state=apple', 'A few details');

    expect(screen.getByText('Signed in with Apple')).toBeDefined();
    const name = screen.getByLabelText('Full name') as HTMLInputElement;
    expect(name.value).toBe('');
    expect(document.activeElement).toBe(name);
  });
});

describe('Today at a desk (sc-29092)', () => {
  beforeEach(() => inEnvironment('development'));

  async function today(moment: string) {
    at(`/demo/today?moment=${moment}`);
    await screen.findByRole('navigation', { name: 'Soirely' });
  }

  it('opens a planning day with Needs you first, its late item in words, and one filled button', async () => {
    await today('plan');

    expect(screen.getByRole('heading', { level: 1, name: 'Good morning, Folake' })).toBeDefined();
    expect(screen.getByText('4 things need you.')).toBeDefined();
    const needs = screen.getByRole('region', { name: 'Needs you' });
    const rows = within(needs).getAllByRole('listitem');
    expect(rows).toHaveLength(4);
    expect(within(rows[0] as HTMLElement).getByText('3 days late')).toBeDefined();
    expect(needs.querySelectorAll('.today-act.is-primary')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Send, Send the invitations' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'New event' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Today' }).getAttribute('aria-current')).toBe('page');
  });

  it('says what a press opens, and ⌘K opens search', async () => {
    await today('plan');

    fireEvent.click(screen.getByRole('button', { name: 'Review, Final numbers to the caterer' }));
    expect(
      screen.getByText('Review opens in Adaeze & Tunde’s wedding, which has its own design.'),
    ).toBeDefined();

    fireEvent.keyDown(window, { key: 'k', metaKey: true });
    expect(screen.getByText('Search has its own design.')).toBeDefined();
  });

  it('shows only what the product can say, built now', async () => {
    await today('planNow');

    expect(screen.queryByRole('region', { name: 'Needs you' })).toBeNull();
    expect(screen.getByText('The wedding starts on Friday.')).toBeDefined();
    expect(screen.queryByText(/replied/)).toBeNull();
  });

  it('makes the banner Now on the event day, with the run of show', async () => {
    await today('day');

    expect(screen.getByRole('heading', { level: 1, name: 'Drinks reception' })).toBeDefined();
    expect(screen.getByText('Live now')).toBeDefined();
    expect(screen.getByRole('img', { name: '141 of 152 arrived' })).toBeDefined();
    expect(screen.getByRole('img', { name: /^2 PM Ceremony, 3 PM Photos/ })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Open run of show' })).toBeDefined();
  });

  it('opens the event from Now, built now', async () => {
    await today('dayNow');

    expect(
      screen.getByRole('heading', { level: 1, name: 'Adaeze & Tunde’s wedding' }),
    ).toBeDefined();
    expect(screen.getByText('Ends tomorrow, Sun, Nov 8 at 2:00 PM')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Open the event' })).toBeDefined();
  });

  it('says so when nothing needs you and nothing is on', async () => {
    await today('quiet');

    expect(screen.getByText('Nothing needs you')).toBeDefined();
    expect(screen.getByText('Nothing on this week')).toBeDefined();
    expect(
      screen.getByRole('button', { name: /^Next up Ire Events end-of-year party/ }),
    ).toBeDefined();
  });

  it('shows a first run how to start, with no events and no New event', async () => {
    await today('first');

    expect(screen.getByRole('heading', { level: 1, name: 'Welcome, Folake' })).toBeDefined();
    expect(screen.getByRole('heading', { name: 'Set up your first event' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Create an event' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'New event' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Your events' })).toBeNull();
  });

  it('opens a planning day for a moment it does not know', async () => {
    await today('nope');

    expect(screen.getByRole('region', { name: 'Needs you' })).toBeDefined();
  });
});

describe('Settings at a desk (sc-29708)', () => {
  beforeEach(() => inEnvironment('development'));

  async function settings(path: string) {
    at(path);
    await screen.findByRole('navigation', { name: 'Settings' });
  }

  it('selects Settings in the sidebar and opens Members beside the list', async () => {
    await settings('/demo/settings');

    const list = screen.getByRole('navigation', { name: 'Settings' });
    expect(within(list).getByRole('link', { name: 'Members' }).getAttribute('aria-current')).toBe(
      'page',
    );
    const side = screen.getByRole('navigation', { name: 'Soirely' });
    expect(within(side).getByRole('link', { name: 'Settings' }).getAttribute('aria-current')).toBe(
      'page',
    );
    expect(within(side).getByRole('link', { name: 'Today' })).toBeDefined();
    expect(screen.getByRole('heading', { level: 1, name: 'Members' })).toBeDefined();
  });

  it('says a section the boards do not draw has its own design, and opens nothing', async () => {
    await settings('/demo/settings');

    fireEvent.click(screen.getByRole('button', { name: 'Security' }));
    expect(screen.getByText('Security has its own design.')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Roles' }));
    expect(screen.getByText('Roles has its own design.')).toBeDefined();
    expect(screen.getByRole('heading', { level: 1, name: 'Members' })).toBeDefined();
  });

  it('names who is looking at the sidebar’s foot', async () => {
    await settings('/demo/settings?as=tom');
    expect(screen.getByRole('button', { name: 'Tom Becker, Door staff' })).toBeDefined();
  });

  it('leaves Members and Roles out of the list for a role that does not read them', async () => {
    await settings('/demo/settings?as=ana');

    const list = screen.getByRole('navigation', { name: 'Settings' });
    expect(within(list).queryByRole('link', { name: 'Members' })).toBeNull();
    expect(within(list).queryByRole('link', { name: 'Roles' })).toBeNull();
    expect(within(list).getByRole('button', { name: 'General' })).toBeDefined();
  });
});

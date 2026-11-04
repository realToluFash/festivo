import { act, fireEvent, render, screen } from '@testing-library/react';
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

  it('lands the sample pair on the stand-in, and Sign out comes back signed out', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await signInBoard();
    type('Email', SAMPLE.email);
    type('Password', SAMPLE.password);

    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByRole('button', { name: 'Signing in…' })).toBeDefined();
    await act(() => vi.advanceTimersByTimeAsync(1000));

    fireEvent.click(await screen.findByRole('link', { name: 'Sign out' }));
    expect(await screen.findByText('You were signed out')).toBeDefined();
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
    expect(screen.getByLabelText('Code from the email')).toBeDefined();
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

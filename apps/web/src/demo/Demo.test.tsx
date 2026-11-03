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

  it('opens an account from the header and the footer pages as stand-ins (sc-28981)', async () => {
    await signInBoard();

    expect(screen.queryByText('New here?')).toBeNull();
    fireEvent.click(screen.getByRole('link', { name: 'Create an account' }));
    expect(await screen.findByRole('heading', { name: 'Create an account' })).toBeDefined();

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

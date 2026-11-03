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

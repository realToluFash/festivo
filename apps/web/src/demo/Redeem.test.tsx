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

async function redeem(state: string) {
  const router = createMemoryRouter(routes, { initialEntries: [`/demo/redeem?state=${state}`] });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1 });
}

const wait = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));
const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const press = (name: string) => fireEvent.click(screen.getByRole('button', { name }));

describe('typing a join code in the browser (sc-72)', () => {
  it('checks the code before anything is sent, then shows the event first', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await redeem('enter-blank');

    expect(screen.getByText('Enter the join code.')).toBeDefined();
    type('Join code', 'q7km 4x');
    press('Continue');
    expect(screen.getByText('A join code is 8 letters and numbers.')).toBeDefined();
    type('Join code', 'q7km-4xp2');
    press('Continue');
    expect(screen.getByRole('button', { name: 'Continue' }).getAttribute('aria-busy')).toBe('true');
    await wait(1000);

    const title = screen.getByRole('heading', { level: 1, name: 'Joana & Rui’s wedding' });
    expect(
      screen.getByText('Sat, Nov 14 · Lumen Feiras · Can check guests in · Bar and drinks'),
    ).toBeDefined();
    await waitFor(() => expect(document.activeElement).toBe(title));
  });

  it('gives one refusal for every bad code, as an alert, with focus kept in the field', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await redeem('enter');

    type('Join code', 'Q7KM 4XP3');
    press('Continue');
    await wait(1000);

    expect(screen.getByRole('alert').textContent).toBe(
      'That code doesn’t work. Check it with whoever gave it to you.',
    );
    expect(document.activeElement).toBe(screen.getByLabelText('Join code'));
  });

  it('stops at ten tries a minute, and says nothing about the event', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await redeem('refused');

    for (let tries = 1; tries < 10; tries += 1) {
      type('Join code', `W3NC 6KP${String(tries)}`);
      press('Continue');
      await wait(1000);
    }

    expect(screen.getByRole('heading', { level: 1, name: 'Too many tries' })).toBeDefined();
    expect(screen.getByText('Try again at 13:32')).toBeDefined();
    expect(screen.queryByText(/Joana/u)).toBeNull();
  });
});

describe('a name, a number and the phone code (sc-4235)', () => {
  it('asks for both in the app’s words, then sends the code by WhatsApp', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await redeem('event-blank');

    press('Send code');
    expect(screen.getByText('Enter your full name.')).toBeDefined();
    expect(screen.getByText('Enter your mobile number.')).toBeDefined();
    type('Your name', 'João Pereira');
    type('Mobile number', '912 345');
    press('Send code');
    expect(
      screen.getByText('That number looks too short for Portugal. Check it and try again.'),
    ).toBeDefined();
    expect(document.activeElement).toBe(screen.getByLabelText('Mobile number'));
    type('Mobile number', '912 345 412');
    press('Send code');
    await wait(1000);

    expect(screen.getByRole('heading', { level: 1, name: 'Check WhatsApp' })).toBeDefined();
    expect(screen.getByText('We sent a code to your WhatsApp on +351 912 345 412.')).toBeDefined();
  });

  it('says a wrong code is wrong, texts it instead, and lets a person in with the right one', async () => {
    await redeem('code');

    type('Code, 6 digits', '713908');
    expect(screen.getByRole('alert').textContent).toBe(
      'That code does not match. Check the newest WhatsApp message from Soirely and try again.',
    );
    press('Text it to me instead');
    expect(screen.getByRole('heading', { level: 1, name: 'Check your messages' })).toBeDefined();
    expect(screen.getByText('Send a new code in 1:00')).toBeDefined();
    type('Code, 6 digits', SAMPLE.code);

    const title = screen.getByRole('heading', {
      level: 1,
      name: 'You’re in for Joana & Rui’s wedding · Bar and drinks',
    });
    expect(screen.getByText('Signed in as João Pereira')).toBeDefined();
    expect(screen.getByText('You’ll be signed out at 23:30.')).toBeDefined();
    await waitFor(() => expect(document.activeElement).toBe(title));
  });

  it('offers a new code once one has expired', async () => {
    await redeem('code-expired');

    expect(screen.getByRole('alert').textContent).toBe(
      'That code has expiredCodes only work for a while. Send a new one and use the code in the newest text.',
    );
    press('Send a new code');
    expect(screen.queryByText('That code has expired')).toBeNull();
  });

  it('refuses a used-up code after the phone code, on the event step', async () => {
    await redeem('used-up');

    expect(screen.getByRole('alert').textContent).toBe(
      'That code doesn’t work. Check it with whoever gave it to you.',
    );
    expect((screen.getByLabelText('Your name') as HTMLInputElement).value).toBe('Hugo Faria');
  });
});

describe('who is not asked again', () => {
  it('joins someone signed in already with one press', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await redeem('join-as');

    press('Join as Kemi Okafor');
    await wait(1000);

    expect(screen.getByText('Signed in as Kemi Okafor')).toBeDefined();
  });

  it('tells a member of the organisation to ask its lead or an admin, and grants nothing', async () => {
    await redeem('member');

    expect(
      screen.getByRole('heading', { level: 1, name: 'You’re already a member of Lumen Feiras' }),
    ).toBeDefined();
    expect(
      screen.getByText(
        'Members reach an event through its People. Ask its lead or an admin to add you.',
      ),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: 'Open Events' })).toBeDefined();
  });

  it('signs out to an empty redeem page that says so, as a status', async () => {
    await redeem('browser-in');

    press('Sign out');

    expect(screen.getByRole('status').textContent).toBe('Signed out.');
    expect(screen.getByRole('heading', { level: 1, name: 'Enter a join code' })).toBeDefined();
    expect((screen.getByLabelText('Join code') as HTMLInputElement).value).toBe('');
  });
});

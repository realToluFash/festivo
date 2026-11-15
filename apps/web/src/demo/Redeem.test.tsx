import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { R } from './redeem.ts';
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
  await screen.findByRole('heading', { level: 1 }, { timeout: 8000 });
}

const wait = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));
const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });
const press = (name: string) => fireEvent.click(screen.getByRole('button', { name }));

describe('typing a door code in the browser (sc-72)', () => {
  it('checks the code before anything is sent, then shows the event first', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await redeem('enter-blank');

    expect(screen.getByText('Enter the door code.')).toBeDefined();
    type('Door code', 'q7km 4x');
    press('Continue');
    expect(screen.getByText('A door code is 8 letters and numbers.')).toBeDefined();
    type('Door code', 'q7km-4xp2');
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

    type('Door code', 'Q7KM 4XP3');
    press('Continue');
    await wait(1000);

    expect(screen.getByRole('alert').textContent).toBe(
      'That code doesn’t work. Check it with whoever gave it to you.',
    );
    expect(document.activeElement).toBe(screen.getByLabelText('Door code'));
  });

  it('stops at ten tries a minute, and says nothing about the event', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await redeem('refused');

    for (let tries = 1; tries < 10; tries += 1) {
      type('Door code', `W3NC 6KP${String(tries)}`);
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

  it('checks the number against the country picked: a +44 mobile sends, a number short for it does not', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await redeem('event-blank');

    type('Your name', 'Amelia Hart');
    fireEvent.change(screen.getByLabelText('Country code'), { target: { value: 'US' } });
    type('Mobile number', '912 345 412');
    press('Send code');
    expect(
      screen.getByText('That number looks too short for United States. Check it and try again.'),
    ).toBeDefined();
    expect(screen.getByRole('heading', { level: 1, name: 'Joana & Rui’s wedding' })).toBeDefined();

    fireEvent.change(screen.getByLabelText('Country code'), { target: { value: 'GB' } });
    type('Mobile number', '7700 900123');
    press('Send code');
    await wait(1000);

    expect(screen.getByRole('heading', { level: 1, name: 'Check WhatsApp' })).toBeDefined();
    expect(screen.getByText('We sent a code to your WhatsApp on +44 7700 900123.')).toBeDefined();
  });

  it('checks the code only on Verify, never as it is typed (WCAG 3.2.2)', async () => {
    await redeem('code');
    const field = screen.getByLabelText('Code from WhatsApp') as HTMLInputElement;

    expect(field.getAttribute('autocomplete')).toBe('one-time-code');
    expect(field.getAttribute('inputmode')).toBe('numeric');
    type('Code from WhatsApp', '');
    press('Verify');
    expect(screen.getByText('Enter the 6-digit code from WhatsApp.')).toBeDefined();
    type('Code from WhatsApp', '7139');
    press('Verify');
    expect(screen.getByText('The code is 6 digits.')).toBeDefined();
    type('Code from WhatsApp', '713908');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Check WhatsApp' })).toBeDefined();
  });

  it('keeps a wrong code, selected, says why under the field, then lets the right one in', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await redeem('code');

    type('Code from WhatsApp', '713908');
    press('Verify');
    expect(screen.getByRole('button', { name: 'Verifying…' })).toBeDefined();
    await wait(1000);
    const field = screen.getByLabelText('Code from WhatsApp') as HTMLInputElement;
    expect(screen.getByRole('alert').textContent).toBe(
      'That code does not match. Check the newest WhatsApp message from Soirely and try again.',
    );
    expect(field.value).toBe('713908');
    await waitFor(() => expect(document.activeElement).toBe(field));
    expect([field.selectionStart, field.selectionEnd]).toEqual([0, 6]);

    press('Text it to me instead');
    expect(screen.getByRole('heading', { level: 1, name: 'Check your messages' })).toBeDefined();
    expect(screen.getByText('Send a new code in 1:00')).toBeDefined();
    type('Code from the text', SAMPLE.code);
    press('Verify');
    await wait(1000);

    const title = screen.getByRole('heading', {
      level: 1,
      name: 'You’re in for Joana & Rui’s wedding · Bar and drinks',
    });
    expect(screen.getByText('Signed in as João Pereira')).toBeDefined();
    expect(screen.getByText('You’ll be signed out at 23:30.')).toBeDefined();
    await waitFor(() => expect(document.activeElement).toBe(title));
  });

  it('opens a wrong code kept and selected from its link', async () => {
    await redeem('code-wrong');
    const field = screen.getByLabelText('Code from WhatsApp') as HTMLInputElement;

    await waitFor(() => expect(document.activeElement).toBe(field));
    expect(field.value).toBe('713908');
    expect([field.selectionStart, field.selectionEnd]).toEqual([0, 6]);
  });

  it('words an expired code on the WhatsApp path for WhatsApp', async () => {
    await redeem('code-expired-whatsapp');

    expect(screen.getByRole('heading', { level: 1, name: 'Check WhatsApp' })).toBeDefined();
    expect(screen.getByRole('alert').textContent).toBe(
      `That code has expired${R.expiredBodyWhatsApp}`,
    );
    expect(R.expiredBodyWhatsApp).toBe(
      'Codes only work for a while. Send a new one and use the code in the newest WhatsApp message.',
    );
  });

  it('offers a new code once one has expired', async () => {
    await redeem('code-expired');

    expect(screen.getByRole('alert').textContent).toBe(
      'That code has expiredCodes only work for a while. Send a new one and use the code in the newest text.',
    );
    expect(screen.queryByLabelText('Code from the text')).toBeNull();
    press('Send a new code');
    expect(screen.queryByText('That code has expired')).toBeNull();
    expect(screen.getByLabelText('Code from the text')).toBeDefined();
  });

  it('refuses a used-up code after the phone code, on the event step', async () => {
    await redeem('used-up');

    expect(screen.getByRole('alert').textContent).toBe(
      'That code doesn’t work. Check it with whoever gave it to you.',
    );
    expect((screen.getByLabelText('Your name') as HTMLInputElement).value).toBe('Hugo Faria');
  });
});

describe('the Soirely wordmark', () => {
  it.each(['enter', 'browser-event', 'code', 'browser-in', 'signed-out'])(
    'sits above the column on %s',
    async (state) => {
      await redeem(state);

      expect(document.querySelector('.rd-column > .rd-brand:first-child')).not.toBeNull();
      expect(screen.getByText('Soirely')).toBeDefined();
    },
  );
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
        'Members open an event from its People page. Ask its lead or an admin to add you.',
      ),
    ).toBeDefined();
    expect(screen.getByRole('button', { name: 'Open Events' })).toBeDefined();
  });

  it('signs out to an empty redeem page that says so, as a status', async () => {
    await redeem('browser-in');

    press('Sign out');

    expect(screen.getByRole('status').textContent).toBe('Signed out.');
    expect(screen.getByRole('heading', { level: 1, name: 'Enter a door code' })).toBeDefined();
    expect((screen.getByLabelText('Door code') as HTMLInputElement).value).toBe('');
  });
});

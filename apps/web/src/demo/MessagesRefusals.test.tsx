import { fireEvent, render, screen } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { resetSample } from './events.ts';
import { resetInbox } from './messages.ts';
import { LONG_SUBJECT, lengthOf } from './messagesRefusals.ts';

const tested = config();
const SLOW = { timeout: 20000 };
const WAIT = { timeout: 8000 };
const AT = '/demo/events/evt-wed-4/messages';
const ENTER = 'Enter a message.';
const CHOOSE = 'Choose at least one guest.';
const SUBJECT = 'Shorten the subject to 150 characters or fewer.';
const MESSAGE = 'Shorten the message to 10,000 characters or fewer.';

async function messages(state: string) {
  const router = createMemoryRouter(routes, { initialEntries: [`${AT}?state=${state}`] });

  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1, name: 'Messages' }, WAIT);
}

async function focused(element: HTMLElement): Promise<void> {
  await vi.waitFor(() => expect(document.activeElement).toBe(element));
}

function subject(): HTMLInputElement {
  return screen.getByRole<HTMLInputElement>('textbox', { name: 'Subject' });
}

function message(): HTMLElement {
  return screen.getByRole('textbox', { name: 'Message' });
}

function says(field: HTMLElement): string[] {
  return (field.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .map((id) => document.getElementById(id)?.textContent ?? '');
}

function check(): HTMLElement | null {
  return screen.queryByRole('alertdialog', { name: /./ });
}

describe('The composer refuses a send that cannot go, at a desk (sc-3942)', () => {
  beforeEach(() => {
    __setConfig({ ...tested, environment: 'development' });
    resetSample();
    resetInbox();
  });

  it(
    'keeps Send lit with a blank Message, and says why on the field (blankMessage)',
    SLOW,
    async () => {
      await messages('blankMessage');
      const send = screen.getByRole('button', { name: 'Send' });

      expect(send.getAttribute('aria-disabled')).toBeNull();
      expect(message().getAttribute('aria-invalid')).toBe('true');
      expect(says(message())).toEqual([ENTER]);
      expect(check()).toBeNull();
      await focused(message());
    },
  );

  it('refuses Send on a blank Message pressed from a written draft (write)', SLOW, async () => {
    await messages('write');
    const field = message();

    field.replaceChildren();
    fireEvent.input(field);
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(check()).toBeNull();
    expect(says(message())).toEqual([ENTER]);
    await focused(message());
  });

  it('refuses a subject over 150 and keeps every character of it (longSubject)', SLOW, async () => {
    await messages('longSubject');

    expect(lengthOf(LONG_SUBJECT)).toBeGreaterThan(150);
    expect(subject().value).toBe(LONG_SUBJECT);
    expect(subject().getAttribute('aria-invalid')).toBe('true');
    expect(says(subject())[0]).toBe(SUBJECT);
    await focused(subject());
  });

  it('keeps the subject sentence while the subject is still too long', SLOW, async () => {
    await messages('longSubject');
    fireEvent.change(subject(), { target: { value: 'x'.repeat(151) } });

    expect(subject().getAttribute('aria-invalid')).toBe('true');
    expect(says(subject())[0]).toBe(SUBJECT);
  });

  it('drops the subject sentence once the subject is short enough', SLOW, async () => {
    await messages('longSubject');
    fireEvent.change(subject(), { target: { value: 'Parking' } });

    expect(subject().getAttribute('aria-invalid')).toBeNull();
    expect(screen.queryByText(SUBJECT)).toBeNull();
  });

  it(
    'refuses a message over 10,000 and keeps the text past the limit (longMessage)',
    SLOW,
    async () => {
      await messages('longMessage');

      expect(lengthOf(message().textContent ?? '')).toBeGreaterThan(10_000);
      expect(says(message())).toEqual([MESSAGE]);
      await focused(message());
    },
  );

  it(
    'says Choose at least one guest. beside the picker, focus on it (chooseNone)',
    SLOW,
    async () => {
      await messages('chooseNone');
      const chip = screen.getByRole('button', { name: 'Choose guests' });

      expect(says(chip)).toEqual([CHOOSE]);
      expect(check()).toBeNull();
      await focused(chip);
    },
  );

  it(
    'shows every sentence at once, focus on the first in the form’s order (allRefused)',
    SLOW,
    async () => {
      await messages('allRefused');
      const chip = screen.getByRole('button', { name: 'Choose guests' });

      expect(says(chip)).toEqual([CHOOSE]);
      expect(says(subject())[0]).toBe(SUBJECT);
      expect(says(message())).toEqual([ENTER]);
      await focused(chip);

      fireEvent.click(screen.getByRole('button', { name: 'Send' }));
      await focused(chip);
      expect(check()).toBeNull();
    },
  );

  it('goes on to the check once every field is right', SLOW, async () => {
    await messages('longSubject');
    fireEvent.change(subject(), { target: { value: 'Parking' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByRole('alertdialog', {}, WAIT)).toBeDefined();
  });
});

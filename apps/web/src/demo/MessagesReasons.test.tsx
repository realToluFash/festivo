import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { resetSample } from './events.ts';
import { resetInbox } from './messages.ts';

const tested = config();
const SLOW = { timeout: 20000 };
const WAIT = { timeout: 8000 };
const AT = '/demo/events/evt-wed-4/messages';
const ENDED =
  'This event finished more than 30 days ago, so you can no longer write to its guests.';

async function messages(state: string) {
  render(
    <RouterProvider
      router={createMemoryRouter(routes, { initialEntries: [`${AT}?state=${state}`] })}
    />,
  );
  await screen.findByRole('heading', { level: 1, name: 'Messages' }, WAIT);
}

function rowOf(name: string) {
  return within(screen.getByText(name).closest('li') as HTMLElement);
}

function said(): string {
  return screen
    .getAllByRole('status')
    .map((one) => one.textContent ?? '')
    .join(' | ');
}

describe('Who it reached: every reason and Try SMS instead at a desk (sc-3966)', () => {
  beforeEach(() => {
    __setConfig({ ...tested, environment: 'development' });
    resetSample();
    resetInbox();
  });

  afterEach(() => {
    cleanup();
  });

  it(
    'offers Try SMS instead beside a bounced, failed, skipped or unsubscribed email',
    SLOW,
    async () => {
      await messages('reasons');

      expect(screen.getByRole('heading', { level: 2, name: 'Reached 133 of 142' })).toBeDefined();
      expect(screen.getAllByRole('button', { name: 'Try SMS instead' })).toHaveLength(5);
      expect(
        rowOf('Sophie Laurent').getByRole('button', { name: 'Try SMS instead' }),
      ).toBeDefined();
      expect(rowOf('Diego Herrera').queryByRole('button', { name: 'Try SMS instead' })).toBeNull();
      expect(rowOf('Tomás Ferreira').queryByRole('button', { name: 'Try SMS instead' })).toBeNull();
      expect(rowOf('Kemi Bankole').getByText('Email · Reported as spam')).toBeDefined();
    },
  );

  it('shows the cost first, Cancel sends nothing, Send by SMS sends it', SLOW, async () => {
    await messages('reasons');

    fireEvent.click(rowOf('Olumide Bello').getByRole('button', { name: 'Try SMS instead' }));
    expect(screen.getByText('SMS · 1 part · GSM-7 · 154 characters')).toBeDefined();
    expect(
      screen.getByText('This text uses 62 credits. Credits after sending: 1,438.'),
    ).toBeDefined();
    const send = screen.getByRole('button', { name: 'Send by SMS' });

    await vi.waitFor(() => expect(document.activeElement).toBe(send));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('button', { name: 'Send by SMS' })).toBeNull();

    fireEvent.click(rowOf('Olumide Bello').getByRole('button', { name: 'Try SMS instead' }));
    fireEvent.click(screen.getByRole('button', { name: 'Send by SMS' }));

    expect(await screen.findByRole('region', { name: 'In progress · 1' })).toBeDefined();
    expect(rowOf('Olumide Bello').getByText('SMS · Sent')).toBeDefined();
    expect(rowOf('Olumide Bello').queryByRole('button', { name: 'Try SMS instead' })).toBeNull();
    expect(
      rowOf('Olumide Bello')
        .getAllByRole('button')
        .map((button) => button.textContent),
    ).toEqual(['Mark as told in person']);
    expect(screen.getByRole('button', { name: 'Resend to the 8 not reached' })).toBeDefined();
    expect(said()).toContain('Sent to Olumide Bello.');
  });

  it('opens each state as its board draws it', SLOW, async () => {
    await messages('trySmsQuiet');
    expect(screen.getByRole('heading', { level: 3, name: 'Failed · 2' })).toBeDefined();
    expect(screen.getByText('This text waits until 09:00, their time.')).toBeDefined();
    cleanup();
    resetInbox();

    await messages('trySmsShort');
    expect(screen.getByRole('heading', { level: 3, name: 'Skipped · 2' })).toBeDefined();
    expect(screen.getByText('1 SMS message will wait for credits.')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Add credits' })).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Send by SMS' }));
    expect(
      await screen.findByRole('heading', { level: 3, name: 'Skipped · 1' }, WAIT),
    ).toBeDefined();
    expect(screen.getByText(/· 1 held ·/u)).toBeDefined();
    cleanup();
    resetInbox();

    await messages('trySmsSent');
    expect(screen.getByRole('heading', { level: 3, name: 'Bounced · 1' })).toBeDefined();
    expect(said()).toContain('Sent to Olumide Bello.');
    cleanup();
    resetInbox();

    await messages('reachedQuiet');
    expect(rowOf('Valentina Restrepo').getByText(/Waiting until 09:00, their time/u)).toBeDefined();
  });

  it(
    'turns the three sends off on an event that can’t send, and keeps the rest',
    SLOW,
    async () => {
      await messages('closedReached');

      expect(screen.getAllByText(ENDED).length).toBeGreaterThan(0);
      for (const name of [
        'Try SMS instead',
        'Send to Tomás Ferreira again',
        'Resend to the 9 not reached',
      ])
        expect(screen.getByRole('button', { name }).getAttribute('aria-disabled'), name).toBe(
          'true',
        );

      expect(
        rowOf('Olumide Bello')
          .getByRole('button', { name: 'Fix email address' })
          .getAttribute('aria-disabled'),
      ).not.toBe('true');
      fireEvent.click(screen.getByRole('button', { name: 'Not now' }));
      expect(screen.queryByRole('button', { name: 'Send to Tomás Ferreira again' })).toBeNull();
    },
  );

  it('says which bounced under Fix email address only when the email bounced', SLOW, async () => {
    await messages('reasons');

    for (const [name, line] of [
      ['Olumide Bello', 'Was olumide.bello@outlook.com, which bounced.'],
      ['Chidi Okeke', 'Was chidi.okeke@gmail.com.'],
      ['Rafael Costa', 'Was rafael.costa@uol.com.br.'],
      ['Yuki Tanaka', 'Was yuki.tanaka@icloud.com.'],
    ] as const) {
      fireEvent.click(rowOf(name).getByRole('button', { name: 'Fix email address' }));
      await screen.findByRole('textbox', { name: 'Email address' });
      expect(screen.getByText(line)).toBeDefined();
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    }
  });
});

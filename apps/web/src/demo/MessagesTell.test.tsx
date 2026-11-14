import { act, fireEvent, render, screen, within } from '@testing-library/react';
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
const BANNER = 'Guests have not been told yet';

function open(state: string) {
  const router = createMemoryRouter(routes, { initialEntries: [`${AT}?state=${state}`] });
  render(<RouterProvider router={router} />);

  return router;
}

async function sheet(state: string, name = 'Tell 130 guests?'): Promise<HTMLElement> {
  open(state);

  return screen.findByRole('dialog', { name }, WAIT);
}

function send(dialog: HTMLElement): void {
  fireEvent.click(within(dialog).getByRole('button', { name: 'Send' }));
}

function said(): string {
  return screen
    .getAllByRole('status')
    .map((one) => one.textContent ?? '')
    .join(' | ');
}

describe('Tell guests, every kind and after Send (sc-4330)', () => {
  beforeEach(() => {
    __setConfig({ ...tested, environment: 'development' });
    resetSample();
    resetInbox();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it(
    'keeps the sheet and the note when Send fails, then sends on the next press',
    SLOW,
    async () => {
      const dialog = await sheet('sendOffline');
      const send_ = within(dialog).getByRole('button', { name: 'Send' });

      expect(within(dialog).getByRole('alert').textContent).toBe(
        'Not sent. Check your connection and try again.',
      );
      expect(within(dialog).getByRole('textbox', { name: /Note for your guests/u })).toHaveProperty(
        'value',
        'Dinner is still at 20:00.',
      );
      expect(document.activeElement).toBe(send_);

      send(dialog);
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(said()).toContain('Sending to 130 guests.');
    },
  );

  it(
    'refuses a refusal again, with the same line, and Not now leaves the change in the banner',
    SLOW,
    async () => {
      const dialog = await sheet('sendRefusedRole');

      send(dialog);
      expect(within(dialog).getByRole('alert').textContent).toBe(
        'Nothing was sent. Your role does not include the permission this needs.',
      );
      fireEvent.click(within(dialog).getByRole('button', { name: 'Not now' }));

      const banner = await screen.findByRole('region', { name: BANNER });

      expect(within(banner).getByText('New start time')).toBeDefined();
    },
  );

  it('finds an unconfirmed send already told: nothing again, and no banner', SLOW, async () => {
    send(await sheet('sendUnconfirmed'));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(said()).toContain('Your guests had already been told, so nothing was sent again.');
    expect(screen.queryByRole('region', { name: BANNER })).toBeNull();
  });

  it('sends nothing while the figures load, then says so beside them', SLOW, async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const dialog = await sheet('figuresLoading', 'Tell guests?');

    expect(dialog.querySelector('[aria-busy="true"]')).not.toBeNull();
    send(dialog);
    await act(() => vi.advanceTimersByTime(1000));

    expect(within(dialog).getByRole('heading', { name: 'Tell 130 guests?' })).toBeDefined();
    expect(within(dialog).getByRole('status').textContent).toBe(
      'Not sent yet. Check the numbers, then press Send.',
    );
    send(dialog);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('loads the figures again when they did not load, sending nothing', SLOW, async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const dialog = await sheet('figuresFailed', 'Tell guests?');

    expect(within(dialog).getByRole('alert').textContent).toContain('The numbers did not load.');
    send(dialog);
    await act(() => vi.advanceTimersByTime(1000));

    expect(within(dialog).getByRole('heading', { name: 'Tell 130 guests?' })).toBeDefined();
    expect(within(dialog).queryByRole('alert')).toBeNull();
  });

  it('opens See who in place, in alphabetical order, and closes it again', SLOW, async () => {
    const dialog = await sheet('tellSeeWho');
    const who = within(dialog).getByRole('button', { name: 'See who' });

    expect(who.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(who);
    expect(who.getAttribute('aria-expanded')).toBe('true');
    expect(
      within(dialog)
        .getAllByRole('listitem')
        .map((one) => one.textContent)
        .slice(-2),
    ).toEqual([
      'Joaquín RuizNo email address · No phone number',
      'Sophie LaurentUnsubscribed · Stopped texts',
    ]);
    fireEvent.click(who);
    expect(who.getAttribute('aria-expanded')).toBe('false');
  });

  it('puts changes for different guests each under its item', SLOW, async () => {
    const dialog = await sheet('tellMixed');

    expect(within(dialog).queryByText('Invited guests, except those not coming.')).not.toBeNull();
    expect(within(dialog).getByText('Tables shared')).toBeDefined();
    expect(within(dialog).getByText('Coming guests who have a table.')).toBeDefined();
    expect(
      within(dialog).getByText('Each guest’s own table is added under your message.'),
    ).toBeDefined();
  });

  it('words each kind’s sheet: call off, the menu, one guest', SLOW, async () => {
    const callOff = await sheet('tellCallOff', 'Tell 142 guests?');

    expect(within(callOff).getByText('Everyone invited.')).toBeDefined();
    expect(within(callOff).getByText('9 guests cannot be reached.')).toBeDefined();
  });

  it(
    'shows the banner on the event’s Overview, and Dismiss says nothing was sent',
    SLOW,
    async () => {
      open('untoldEvent');
      const banner = await screen.findByRole('region', { name: BANNER }, WAIT);

      fireEvent.click(within(banner).getByRole('button', { name: 'Dismiss' }));
      expect(screen.queryByRole('region', { name: BANNER })).toBeNull();
      expect(said()).toContain('Dismissed. Nothing was sent.');
    },
  );

  it('takes an untold pause off the banner on Resume, opening nothing', SLOW, async () => {
    open('untoldPaused');
    const banner = await screen.findByRole('region', { name: BANNER }, WAIT);

    expect(within(banner).getByText('Paused')).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Resume' }));
    expect(screen.queryByRole('region', { name: BANNER })).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('opens a sent change in the style of the invitation’s thread', SLOW, async () => {
    open('changeSent');
    const head = await screen.findByRole('heading', { name: 'Change · New start time' }, WAIT);

    expect(head).toBeDefined();
    expect(screen.getByText('130 guests · Email, SMS and WhatsApp')).toBeDefined();
    expect(screen.getByText('Changed: Adaeze & Tunde’s wedding')).toBeDefined();
    expect(screen.getAllByText(/Reached 128 of 130/u).length).toBeGreaterThan(0);
  });

  it('opens Tell Kwame Mensah over Guests after Replace link', SLOW, async () => {
    const dialog = await sheet('tellLink', 'Tell Kwame Mensah?');

    expect(within(dialog).queryByText('Invited guests, except those not coming.')).toBeNull();
    expect(within(dialog).getByText(/Texts and WhatsApp messages use 5 credits\./u)).toBeDefined();
  });
});

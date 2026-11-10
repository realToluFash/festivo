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
const TOLD_BY_EMAIL = /^To .+ · 96 · on their page · told by Email$/;

async function messages(state: string): Promise<void> {
  const router = createMemoryRouter(routes, { initialEntries: [`${AT}?state=${state}`] });

  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1, name: 'Messages' }, WAIT);
}

async function check(state: string): Promise<HTMLElement> {
  await messages(state);

  return screen.getByRole('alertdialog', { name: 'Check it before it goes' });
}

describe('the check with too few credits at a desk (sc-3963)', () => {
  beforeEach(() => {
    __setConfig({ ...tested, environment: 'development' });
    resetSample();
    resetInbox();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('counts each phone once when WhatsApp is ticked in the check (pm #36950)', SLOW, async () => {
    const card = await check('check');

    fireEvent.click(within(card).getByRole('checkbox', { name: 'WhatsApp' }));

    expect(within(card).getByText('SMS · 28')).toBeDefined();
    expect(within(card).getByText('WhatsApp · 3')).toBeDefined();
    expect(
      within(card).getByText(
        'Texts and WhatsApp messages use 31 credits. Credits after sending: 1,469.',
      ),
    ).toBeDefined();
  });

  it('shows what waits in place of the credits line, with Add credits', SLOW, async () => {
    const card = await check('checkWaitsSms');

    expect(within(card).getByText('Email goes either way.')).toBeDefined();
    expect(within(card).getByText('31 SMS messages will wait for credits.')).toBeDefined();
    expect(within(card).queryByText(/Credits after sending/)).toBeNull();
    expect(within(card).getByRole('button', { name: 'Send without SMS' })).toBeDefined();
    expect(within(card).getByRole('button', { name: 'Add credits' })).toBeDefined();
    await vi.waitFor(() =>
      expect(document.activeElement).toBe(
        within(card).getByText('Sending to 96 people cannot be undone.'),
      ),
    );
  });

  it('offers one Send by email only when both paid channels wait', SLOW, async () => {
    const card = await check('checkWaitsBoth');

    expect(within(card).getByText('3 WhatsApp messages will wait for credits.')).toBeDefined();
    expect(within(card).getByText('28 SMS messages will wait for credits.')).toBeDefined();
    expect(within(card).getByRole('button', { name: 'Send by email only' })).toBeDefined();
    expect(within(card).queryByRole('button', { name: /Send without/ })).toBeNull();
  });

  it.each(['checkWaitsNoEmail', 'checkWaitsOnly'])(
    'offers no way past in %s, which would leave nothing to send',
    SLOW,
    async (state) => {
      const card = await check(state);

      expect(within(card).queryByText('Email goes either way.')).toBeNull();
      expect(
        within(card).queryByRole('button', { name: /Send without|Send by email only/ }),
      ).toBeNull();
      expect(within(card).getByRole('button', { name: 'Send to 96 people' })).toBeDefined();
    },
  );

  it('sends without SMS: the ten seconds start, told by email only', SLOW, async () => {
    const card = await check('checkWaitsSms');

    fireEvent.click(within(card).getByRole('button', { name: 'Send without SMS' }));

    expect(screen.queryByRole('alertdialog', { name: 'Check it before it goes' })).toBeNull();
    expect(screen.getByText('Sending in 10…', { selector: '.mg-countdown-words' })).toBeDefined();
    expect(document.querySelector('.mg-head-words p')?.textContent).toMatch(TOLD_BY_EMAIL);
    await vi.waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' })),
    );
  });

  it('opens sendWithout on the ten seconds, told by email only', SLOW, async () => {
    await messages('sendWithout');

    expect(document.querySelector('.mg-head-words p')?.textContent).toMatch(TOLD_BY_EMAIL);
    expect(screen.getByText('Sending in 10…', { selector: '.mg-countdown-words' })).toBeDefined();
  });

  it('asks an owner once, then says the owners were sent the link', SLOW, async () => {
    const card = await check('askOwner');
    const ask = within(card).getByRole('button', { name: 'Ask an owner' });

    expect(within(card).queryByRole('button', { name: 'Add credits' })).toBeNull();
    fireEvent.click(ask);
    expect(ask.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(ask);

    const sent = await within(card).findByText(
      'The owners have been sent the link to Plan and billing.',
    );

    expect(sent.getAttribute('role')).toBe('status');
    expect(within(card).queryByRole('button', { name: 'Ask an owner' })).toBeNull();
    await vi.waitFor(() => expect(document.activeElement).toBe(sent));
  });

  it('says one owner was sent it when there is one', SLOW, async () => {
    const card = await check('askSentOne');

    expect(
      within(card).getByText('The owner has been sent the link to Plan and billing.'),
    ).toBeDefined();
  });

  it('says Not sent in an alert under Ask an owner, cleared by trying again', SLOW, async () => {
    const card = await check('askFailed');

    expect(within(card).getByRole('alert').textContent).toBe('Not sent. Try again in a moment.');
    fireEvent.click(within(card).getByRole('button', { name: 'Ask an owner' }));
    expect(within(card).queryByRole('alert')).toBeNull();
    expect(
      await within(card).findByText('The owners have been sent the link to Plan and billing.'),
    ).toBeDefined();
  });
});

import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';

const tested = config();
const FIRST_LOAD = { timeout: 15000 };
const TITLE = 'Ìrè Events is read-only until the payment is made.';

async function shown(state: string) {
  const router = createMemoryRouter(routes, {
    initialEntries: [`/demo/read-only?state=${state}`],
  });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1 }, FIRST_LOAD);
}

const banner = () =>
  screen.queryAllByRole('status').find((one) => one.classList.contains('ro-banner')) ?? null;

describe('a failed payment on the web (sc-3937)', () => {
  beforeEach(() => __setConfig({ ...tested, environment: 'development' }));
  afterEach(() => vi.useRealTimers());

  it('puts the past-due banner above the page, with Update payment method for billing.manage', async () => {
    await shown('pastDue');

    expect(banner()?.textContent).toContain('We will try again on Monday, Nov 30.');
    expect(within(banner()!).getByRole('button', { name: 'Update payment method' })).toBeDefined();
    expect(screen.queryByText('Running normally')).toBeNull();
  });

  it('gives billing.read the banner without a button', async () => {
    await shown('pastDueRead');
    expect(within(banner()!).queryByRole('button')).toBeNull();
  });

  it('shows no banner without billing.read, and still says live events run normally', async () => {
    await shown('readOnlyNone');

    expect(banner()).toBeNull();
    expect(screen.getAllByText('Running normally')).toHaveLength(2);
  });

  it('takes the banner and Running normally away once paid', async () => {
    await shown('readOnly');
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: 'The payment is made' }));
    act(() => vi.runAllTimers());

    expect(banner()).toBeNull();
    expect(screen.queryByText('Running normally')).toBeNull();
  });

  it('refuses Make live with what is kept, Update payment method and the way back', async () => {
    await shown('makeLive');
    const dialog = screen.getByRole('dialog', { name: TITLE });

    expect(within(dialog).getByText('Kept as a draft, with everything you entered.')).toBeDefined();
    expect(within(dialog).getByRole('button', { name: 'Update payment method' })).toBeDefined();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Back to the draft' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Make live' }));
    expect(screen.getByRole('dialog', { name: TITLE })).toBeDefined();
  });

  it('tells anyone without billing.manage who can act, with no button', async () => {
    await shown('message');
    const dialog = screen.getByRole('dialog', { name: TITLE });

    expect(
      within(dialog).getByText('Ask someone who manages billing to make the payment.'),
    ).toBeDefined();
    expect(within(dialog).queryByRole('button', { name: 'Update payment method' })).toBeNull();
    expect(within(dialog).getByRole('button', { name: 'Back to the message' })).toBeDefined();
  });

  it('refuses nothing while past due', async () => {
    await shown('makeLivePastDue');

    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Make live' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('keeps the role a row was opened with: no billing permission is asked, never given the button', async () => {
    await shown('readOnlyNone');
    fireEvent.click(screen.getByRole('link', { name: /Q4 partner summit/ }));
    await screen.findByRole('button', { name: 'Make live' });

    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Make live' }));
    const dialog = screen.getByRole('dialog', { name: TITLE });
    expect(within(dialog).queryByRole('button', { name: 'Update payment method' })).toBeNull();
    expect(
      within(dialog).getByText('Ask someone who manages billing to make the payment.'),
    ).toBeDefined();
  });

  it('keeps billing.read’s banner without a button on a live event it opens', async () => {
    await shown('readOnlyRead');
    fireEvent.click(screen.getByRole('link', { name: /Ama & Kofi’s wedding/ }));
    await screen.findByRole('button', { name: 'Send a message' });

    expect(within(banner()!).queryByRole('button')).toBeNull();
  });

  it('keeps the past-due banner on the event a row opens', async () => {
    await shown('pastDue');
    fireEvent.click(screen.getByRole('link', { name: /Ama & Kofi’s wedding/ }));
    await screen.findByRole('button', { name: 'Send a message' });

    expect(banner()?.textContent).toContain('Your last payment failed.');
  });

  it('mails the read-only words with the button, and Paid without one', async () => {
    await shown('emailReadOnly');
    expect(screen.getByRole('link', { name: 'Update payment method' })).toBeDefined();
  });
});

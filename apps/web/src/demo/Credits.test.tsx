import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';

const tested = config();
const FIRST_LOAD = { timeout: 15000 };
const BILLING = '/demo/settings/plan-and-billing';
const LOADS = { timeout: 3000 };

async function open(path: string, title: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1, name: title }, FIRST_LOAD);

  return router;
}

function credits(): HTMLElement {
  return screen
    .getByRole('heading', { level: 2, name: 'Credits' })
    .closest('section') as HTMLElement;
}

const lines = (within_: HTMLElement) => within_.querySelectorAll('.bl-entry:not(.is-bones)');

describe('Plan and billing › the Credits card’s ledger (sc-99054)', () => {
  beforeEach(() => __setConfig({ ...tested, environment: 'development' }));

  it('heads the last 10 lines in the outline, a day’s use above the pack bought between it', async () => {
    await open(BILLING, 'Plan and billing');
    const card = credits();

    expect(
      within(card).getByRole('heading', { level: 3, name: 'Recent credit entries' }),
    ).toBeDefined();
    expect(lines(card)).toHaveLength(10);
    const [first, second] = Array.from(lines(card)).map((line) => line.textContent ?? '');
    expect(first).toMatch(/WhatsApp · 2 messages−6/u);
    expect(second).toMatch(/Credits bought\+5,000/u);
    expect(within(card).getByText('WhatsApp · 120 messages')).toBeDefined();
    expect(within(card).getByText('Credit pack refunded')).toBeDefined();
    expect(within(card).getByText('Added by Soirely support')).toBeDefined();
    expect(within(card).queryByText(/not carried over/u)).toBeNull();
    expect(within(card).getByRole('link', { name: 'All credit entries' })).toBeDefined();
  });

  it('has no All credit entries with 10 lines or fewer', async () => {
    await open(`${BILLING}?state=few`, 'Plan and billing');

    expect(lines(credits())).toHaveLength(3);
    expect(screen.queryByRole('link', { name: 'All credit entries' })).toBeNull();
  });

  it('shows the balance alone with no entry: no heading, no list, no link', async () => {
    await open(`${BILLING}?state=empty`, 'Plan and billing');
    const card = credits();

    expect(within(card).getByText('0 credits')).toBeDefined();
    expect(within(card).queryByRole('heading', { name: 'Recent credit entries' })).toBeNull();
    expect(lines(card)).toHaveLength(0);
    expect(within(card).queryByRole('link')).toBeNull();
  });

  it('fails the card whole and loads it again on Try again', async () => {
    await open(`${BILLING}?state=credits_failed`, 'Plan and billing');
    const card = credits();

    expect(within(card).getByRole('alert').textContent).toContain('Credits did not load.');
    expect(within(card).queryByText('5,920 credits')).toBeNull();

    fireEvent.click(within(card).getByRole('button', { name: 'Try again' }));

    await waitFor(() => expect(within(credits()).getByText('5,920 credits')).toBeDefined(), LOADS);
    expect(lines(credits())).toHaveLength(10);
  });

  it('never shows a new balance beside a list whose re-read failed', async () => {
    await open(`${BILLING}?state=reread_fails`, 'Plan and billing');

    fireEvent.click(within(credits()).getByRole('button', { name: 'Webhook: 1,000 credits paid' }));

    expect(within(credits()).getByRole('alert').textContent).toContain('Credits did not load.');
    expect(within(credits()).queryByText('6,920 credits')).toBeNull();

    fireEvent.click(within(credits()).getByRole('button', { name: 'Try again' }));

    await waitFor(() => expect(within(credits()).getByText('6,920 credits')).toBeDefined(), LOADS);
    expect(lines(credits())[0]?.textContent).toMatch(/Credits bought\+1,000/u);
  });

  it('loads with the page under Loading plan and billing…', async () => {
    await open(`${BILLING}?state=loading`, 'Plan and billing');

    expect(screen.getByRole('status', { name: 'Loading plan and billing…' })).toBeDefined();
    expect(screen.queryByRole('heading', { name: 'Credits' })).toBeNull();
  });
});

describe('Plan and billing › All credit entries (sc-99054)', () => {
  beforeEach(() => __setConfig({ ...tested, environment: 'development' }));

  it('opens from the card, and Back returns to Plan and billing', async () => {
    const router = await open(BILLING, 'Plan and billing');

    fireEvent.click(screen.getByRole('link', { name: 'All credit entries' }));
    await screen.findByRole('heading', { level: 1, name: 'All credit entries' });
    expect(router.state.location.pathname).toBe(`${BILLING}/credits`);

    fireEvent.click(screen.getByRole('button', { name: 'Plan and billing' }));
    await screen.findByRole('heading', { level: 1, name: 'Plan and billing' });
    expect(router.state.location.pathname).toBe(BILLING);
  });

  it('shows 50 lines, adds 50 on Show more and says so, and drops Show more at the oldest', async () => {
    const container = document.body;
    await open(`${BILLING}/credits`, 'All credit entries');
    expect(lines(container)).toHaveLength(50);

    let shown = 50;
    let before = shown;
    while (screen.queryByRole('button', { name: 'Show more' }) != null) {
      fireEvent.click(screen.getByRole('button', { name: 'Show more' }));
      before = shown;
      await waitFor(() => expect(lines(container).length).toBeGreaterThan(before), LOADS);
      shown = lines(container).length;
    }

    expect(shown).toBeGreaterThan(100);
    await waitFor(() => expect(document.activeElement).toBe(lines(container)[before]));
    expect(screen.getByText(/^\d+ more credit entr(y|ies) shown\.$/u)).toBeDefined();
  });

  it('keeps the lines shown when more fail, and tries again on Show more', async () => {
    await open(`${BILLING}/credits?state=more_fails`, 'All credit entries');

    fireEvent.click(screen.getByRole('button', { name: 'Show more' }));

    expect((await screen.findByRole('alert', {}, LOADS)).textContent).toContain(
      'More credit entries did not load. Try again in a moment.',
    );
    expect(lines(document.body)).toHaveLength(50);

    fireEvent.click(screen.getByRole('button', { name: 'Show more' }));

    await waitFor(() => expect(lines(document.body)).toHaveLength(100), LOADS);
    expect(screen.getByText('50 more credit entries shown.')).toBeDefined();
  });

  it('shows 10 lines or fewer with no Show more, and says No credit entries yet with none', async () => {
    await open(`${BILLING}/credits?state=few`, 'All credit entries');
    expect(lines(document.body)).toHaveLength(3);
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull();
  });

  it('says No credit entries yet with none', async () => {
    await open(`${BILLING}/credits?state=empty`, 'All credit entries');
    expect(screen.getByText('No credit entries yet.')).toBeDefined();
  });

  it('fails in an alert with Try again, then loads', async () => {
    await open(`${BILLING}/credits?state=failed`, 'All credit entries');
    const alert = screen.getByRole('alert');
    expect(
      within(alert).getByRole('heading', { name: 'Credit entries did not load.' }),
    ).toBeDefined();
    expect(alert.textContent).toContain('Nothing about your plan has changed.');

    fireEvent.click(within(alert).getByRole('button', { name: 'Try again' }));

    await waitFor(() => expect(lines(document.body)).toHaveLength(50), LOADS);
  });

  it('loads over placeholder lines', async () => {
    await open(`${BILLING}/credits?state=loading`, 'All credit entries');
    expect(screen.getByRole('status', { name: 'Loading credit entries…' })).toBeDefined();
  });
});

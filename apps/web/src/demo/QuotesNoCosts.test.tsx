import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { forgetBudget } from './quotes.ts';

const tested = config();
const SLOW = { timeout: 20000 };
const BUDGET = '/demo/events/evt-wed-4?area=budget';
const NOT_LOADED = 'Quotes and payments did not load. Check your connection and try again.';
const NO_LINES = 'This event has no costs yet, so there are no budget lines to agree.';

function main(): HTMLElement {
  return screen.getByRole('main');
}

async function open(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1 }, SLOW);

  return router;
}

function section(name: string): HTMLElement {
  const found = within(main()).getByRole('heading', { name }).closest('section');
  if (found == null) throw new Error(`${name} is not drawn`);

  return found;
}

function titles(): string[] {
  return within(main())
    .getAllByRole('heading', { level: 2 })
    .map((one) => one.textContent ?? '');
}

async function settle(ms = 1000) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe('An event with no costs keeps its quotes on the Budget page (sc-74361)', () => {
  beforeEach(() => {
    __setConfig({ ...tested, environment: 'development' });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    forgetBudget();
  });

  it(
    'draws Due next and Vendors quoted under the first-time card, Who is paying at the left',
    SLOW,
    async () => {
      await open(`${BUDGET}&state=quotes_no_costs`);

      expect(screen.getByText('No costs yet')).toBeDefined();
      expect(screen.getByRole('button', { name: 'Start from an earlier budget' })).toBeDefined();
      expect(titles()).toEqual(['Who is paying', 'Due next', 'Vendors quoted', 'Share']);
      expect(section('Who is paying').closest('.ev-left')).not.toBeNull();
      expect(section('Vendors quoted').closest('.ev-right')).not.toBeNull();
      expect(within(section('Due next')).getByText('Nothing is due.')).toBeDefined();
      expect(
        within(section('Vendors quoted')).getByText('No quotes on this event yet.'),
      ).toBeDefined();
      const first = screen.getByRole('button', { name: 'Add the first cost' });
      const quote = within(section('Vendors quoted')).getByRole('button', { name: 'Add a quote' });
      expect(first.compareDocumentPosition(quote) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    },
  );

  it(
    'adds a quote with no lines, which shows under Vendors quoted and opens its page',
    SLOW,
    async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      await open(`${BUDGET}&state=quotes_no_costs`);
      fireEvent.click(
        within(section('Vendors quoted')).getByRole('button', { name: 'Add a quote' }),
      );
      const dialog = screen.getByRole('dialog', { name: 'Add a quote' });
      const lines = within(dialog).getByRole('group', { name: 'Budget lines it agrees' });
      expect(within(lines).getByText(NO_LINES)).toBeDefined();
      expect(within(lines).queryAllByRole('checkbox')).toHaveLength(0);

      fireEvent.focus(within(dialog).getByRole('combobox', { name: 'Vendor' }));
      fireEvent.click(within(dialog).getByRole('option', { name: /^The Landmark/ }));
      fireEvent.change(within(dialog).getByLabelText('What it covers'), {
        target: { value: 'The ballroom from Thursday to Saturday' },
      });
      fireEvent.change(within(dialog).getByLabelText('Amount'), { target: { value: '6,300.00' } });
      fireEvent.change(within(dialog).getByLabelText('Date quoted'), {
        target: { value: '2026-11-02' },
      });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Add' }));
      await settle();

      expect(screen.queryByRole('dialog')).toBeNull();
      expect(screen.getByText('No costs yet')).toBeDefined();
      const row = within(section('Vendors quoted')).getByRole('link', { name: /^The Landmark/ });
      expect(row.getAttribute('href')).toContain('vendor=v5');
      fireEvent.click(row);
      await screen.findByRole('heading', { level: 1, name: 'The Landmark' }, SLOW);
      fireEvent.click(within(main()).getAllByRole('link', { name: 'Budget' })[0] as HTMLElement);
      await screen.findByRole('heading', { level: 1, name: 'Budget' }, SLOW);
      expect(screen.getByText('No costs yet')).toBeDefined();
      expect(within(section('Vendors quoted')).getByText('The Landmark')).toBeDefined();
    },
  );

  it(
    'shows a payment due on a quote with no lines, one before today as Overdue',
    SLOW,
    async () => {
      await open(`${BUDGET}&state=quotes_no_costs_due`);

      expect(screen.getByText('No costs yet')).toBeDefined();
      const due = within(section('Due next')).getAllByRole('listitem');
      expect(due.map((one) => one.textContent)).toEqual([
        'The LandmarkOverdueDeposit · Due Wed, Oct 28£3,150.00Mark paid',
        'The LandmarkBalance · Due Thu, Nov 5£3,150.00Mark paid',
      ]);
      expect(within(section('Vendors quoted')).getByText('The Landmark')).toBeDefined();
    },
  );

  it('says the event has no costs in Correct, with no list', SLOW, async () => {
    await open(`${BUDGET}&state=quotes_no_costs_due`);
    fireEvent.click(within(section('Vendors quoted')).getByRole('link', { name: /^The Landmark/ }));
    await screen.findByRole('heading', { level: 1, name: 'The Landmark' }, SLOW);
    fireEvent.click(screen.getByRole('button', { name: 'Correct the quote' }));
    const dialog = screen.getByRole('dialog', { name: 'Correct the quote' });
    const lines = within(dialog).getByRole('group', { name: 'Budget lines it agrees' });

    expect(within(lines).getByText(NO_LINES)).toBeDefined();
    expect(within(lines).queryAllByRole('checkbox')).toHaveLength(0);
  });

  it(
    'keeps both blocks when the last cost is removed, and in the right column after Undo',
    SLOW,
    async () => {
      await open(`${BUDGET}&state=quotes_removed_last`);
      const bar = screen.getByRole('button', { name: 'Undo' });
      const card = screen.getByText('No costs yet');
      expect(bar.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(within(section('Vendors quoted')).getByText('The Landmark')).toBeDefined();
      expect(within(section('Due next')).getAllByRole('listitem')).toHaveLength(2);

      fireEvent.click(bar);
      expect(screen.queryByText('No costs yet')).toBeNull();
      expect(within(section('Vendors quoted')).getByText('The Landmark')).toBeDefined();
      expect(within(section('Due next')).getAllByRole('listitem')).toHaveLength(2);
      expect(section('Vendors quoted').closest('.ev-right')).not.toBeNull();
      expect(section('Due next').closest('.ev-right')).not.toBeNull();
    },
  );

  it('reads only on a plan without vendors, every quote readable and no action', SLOW, async () => {
    await open(`${BUDGET}&state=quotes_read_only_no_costs`);

    expect(
      screen.getByText(
        'Quotes and payment schedules are read-only because this organisation’s plan no longer includes them. Nothing has been removed.',
      ),
    ).toBeDefined();
    expect(screen.getByText('No costs yet')).toBeDefined();
    expect(within(section('Vendors quoted')).getByText('The Landmark')).toBeDefined();
    for (const name of ['Due next', 'Vendors quoted'])
      expect(within(section(name)).queryAllByRole('button')).toHaveLength(0);
    const row = within(section('Vendors quoted')).getByRole('link', { name: /^The Landmark/ });
    expect(row.getAttribute('href')).toContain('state=quotes_read_only_no_costs');
    fireEvent.click(row);
    await screen.findByRole('heading', { level: 1, name: 'The Landmark' }, SLOW);
    for (const name of [
      'Add a payment',
      'Revise the quote',
      'Correct the quote',
      'Change',
      'Remove',
      'Mark paid',
    ])
      expect(screen.queryByRole('button', { name })).toBeNull();
  });

  it('keeps each block’s title when quotes did not load, the first-time card as it is', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await open(`${BUDGET}&state=quotes_failed_no_costs`);

    expect(screen.getByRole('button', { name: 'Add the first cost' })).toBeDefined();
    for (const name of ['Due next', 'Vendors quoted']) {
      expect(within(section(name)).getByText(NOT_LOADED)).toBeDefined();
      expect(within(section(name)).getByRole('button', { name: 'Try again' })).toBeDefined();
    }
    fireEvent.click(within(section('Vendors quoted')).getByRole('button', { name: 'Try again' }));
    await settle();
    expect(within(section('Vendors quoted')).getByText('The Landmark')).toBeDefined();
  });

  it('leaves sc-85’s first-time page as it was: no plan with vendors, no quote', SLOW, async () => {
    await open(`${BUDGET}&state=first_time`);

    expect(titles()).toEqual(['Who is paying', 'Share']);
  });
});

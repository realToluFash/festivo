import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { forgetBudget } from './quotes.ts';

const tested = config();
const SLOW = { timeout: 20000 };
const BUDGET = '/demo/events/evt-wed-4?area=budget';
const READ_ONLY =
  'Quotes and payment schedules are read-only because this organisation’s plan no longer includes them. Nothing has been removed.';
const NO_LINES =
  'This event has no costs yet, so the quote agrees none. Once it has some, correct the quote to add them.';

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

function drawn(name: string): boolean {
  return within(main()).queryByRole('heading', { name }) != null;
}

async function settle(ms = 1000) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe('An event with no costs yet keeps its quotes on Budget (sc-74361)', () => {
  beforeEach(() => {
    __setConfig({ ...tested, environment: 'development' });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    forgetBudget();
  });

  it(
    'shows the first-time card with Due next and Vendors quoted empty beside it',
    SLOW,
    async () => {
      await open(`${BUDGET}&state=empty_no_quote`);
      expect(within(main()).getByText('No costs yet')).toBeDefined();
      expect(within(main()).getByRole('button', { name: 'Add the first cost' })).toBeDefined();
      expect(within(section('Due next')).getByText('Nothing is due.')).toBeDefined();
      const quoted = section('Vendors quoted');
      expect(within(quoted).getByText('No quotes on this event yet.')).toBeDefined();
      expect(within(quoted).getByRole('button', { name: 'Add a quote' })).toBeDefined();
      expect(within(main()).queryByText(READ_ONLY)).toBeNull();
    },
  );

  it('keeps sc-85’s first-time page and adds the quotes beside it', SLOW, async () => {
    await open(`${BUDGET}&state=first_time`);
    expect(within(main()).getByText('No costs yet')).toBeDefined();
    expect(
      within(section('Vendors quoted')).getByText('No quotes on this event yet.'),
    ).toBeDefined();
    expect(drawn('Who is paying')).toBe(true);
    expect(drawn('Share')).toBe(true);
  });

  it(
    'says the event has no lines to agree, saves the quote with none, and lists it',
    SLOW,
    async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      await open(`${BUDGET}&state=empty_add_quote`);
      const dialog = screen.getByRole('dialog', { name: 'Add a quote' });
      expect(within(dialog).getByText(NO_LINES)).toBeDefined();
      expect(within(dialog).queryByRole('checkbox')).toBeNull();

      fireEvent.focus(within(dialog).getByRole('combobox', { name: 'Vendor' }));
      fireEvent.click(within(dialog).getByRole('option', { name: /^Beat Collective/ }));
      fireEvent.change(within(dialog).getByLabelText('What it covers'), {
        target: { value: 'DJ for Saturday' },
      });
      fireEvent.change(within(dialog).getByLabelText('Amount'), { target: { value: '900' } });
      fireEvent.change(within(dialog).getByLabelText('Date quoted'), {
        target: { value: '2026-11-02' },
      });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Add' }));
      await settle();

      expect(screen.queryByRole('dialog')).toBeNull();
      const beat = within(section('Vendors quoted')).getByRole('link', {
        name: /^Beat Collective/,
      });
      expect(beat.getAttribute('href')).toBe(`${BUDGET}&vendor=v2&costs=none`);
      expect(within(main()).getByText('No costs yet')).toBeDefined();

      fireEvent.click(beat);
      await within(main()).findByRole('heading', { level: 1, name: 'Beat Collective' });
      const lines = within(section('The quote'))
        .getAllByRole('listitem')
        .find((item) => item.textContent?.startsWith('Budget lines'))?.textContent;
      expect(lines).toBe('Budget linesNone');

      fireEvent.click(within(main()).getAllByRole('link', { name: 'Budget' })[0]!);
      await within(main()).findByRole('heading', { level: 1, name: 'Budget' });
      expect(within(main()).getByText('No costs yet')).toBeDefined();
      expect(
        within(section('Vendors quoted')).getByRole('link', { name: /^Beat Collective/ }),
      ).toBeDefined();
    },
  );

  it('shows the quote and its overdue balance under Due next', SLOW, async () => {
    await open(`${BUDGET}&state=empty_quoted`);
    expect(within(main()).getByText('No costs yet')).toBeDefined();
    const due = within(section('Due next')).getAllByRole('listitem');
    expect(due.map((one) => one.textContent)).toEqual([
      'Bloom & CoOverdueBalance · Due Fri, Oct 30£840.00Mark paid',
    ]);
    expect(
      within(section('Vendors quoted')).getByRole('link', { name: /^Bloom & Co/ }),
    ).toBeDefined();
  });

  it(
    'leaves the quotes when the last cost goes, the Undo bar above No costs yet',
    SLOW,
    async () => {
      await open(`${BUDGET}&state=removed_last_quoted`);
      const undo = within(main()).getByRole('button', { name: 'Undo' });
      const first = within(main()).getByText('No costs yet');
      expect(undo.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(
        within(section('Vendors quoted')).getByRole('link', { name: /^Bloom & Co/ }),
      ).toBeDefined();
      expect(within(section('Due next')).getByText('Overdue')).toBeDefined();

      fireEvent.click(undo);
      expect(within(main()).queryByText('No costs yet')).toBeNull();
      expect(within(main()).getByRole('heading', { name: 'Costs' })).toBeDefined();
      expect(
        within(section('Vendors quoted')).getByRole('link', { name: /^Bloom & Co/ }),
      ).toBeDefined();
      expect(within(section('Due next')).getByText('Overdue')).toBeDefined();
    },
  );

  it(
    'reads only with a quote and no costs, and shows nothing of quotes without one',
    SLOW,
    async () => {
      await open(`${BUDGET}&state=empty_read_only`);
      expect(within(main()).getByText(READ_ONLY)).toBeDefined();
      expect(within(main()).getByText('No costs yet')).toBeDefined();
      for (const verb of ['Add a quote', 'Mark paid', 'Add a payment'])
        expect(within(main()).queryByRole('button', { name: verb })).toBeNull();
      const bloom = within(section('Vendors quoted')).getByRole('link', { name: /^Bloom & Co/ });
      expect(bloom.getAttribute('href')).toBe(`${BUDGET}&vendor=v3&state=empty_read_only`);
      expect(within(section('Due next')).getByText('Overdue')).toBeDefined();

      fireEvent.click(bloom);
      await within(main()).findByRole('heading', { level: 1, name: 'Bloom & Co' });
      expect(within(main()).getByText(READ_ONLY)).toBeDefined();
      for (const verb of ['Add a payment', 'Mark paid', 'Change', 'Remove', 'Revise the quote'])
        expect(within(main()).queryByRole('button', { name: verb })).toBeNull();
      cleanup();

      await open(`${BUDGET}&state=empty_read_only_none`);
      expect(within(main()).getByText('No costs yet')).toBeDefined();
      expect(within(main()).queryByText(READ_ONLY)).toBeNull();
      expect(drawn('Due next')).toBe(false);
      expect(drawn('Vendors quoted')).toBe(false);
    },
  );

  it(
    'keeps both titles in place when the quotes did not load, the card unaffected',
    SLOW,
    async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      await open(`${BUDGET}&state=empty_quotes_failed`);
      expect(within(main()).getByRole('button', { name: 'Add the first cost' })).toBeDefined();
      for (const name of ['Due next', 'Vendors quoted'])
        expect(
          within(section(name)).getByText(
            'Quotes and payments did not load. Check your connection and try again.',
          ),
        ).toBeDefined();
      fireEvent.click(within(section('Vendors quoted')).getByRole('button', { name: 'Try again' }));
      await settle();
      expect(
        within(section('Vendors quoted')).getByRole('link', { name: /^Bloom & Co/ }),
      ).toBeDefined();
    },
  );

  it('reaches Add the first cost before Add a quote by Tab', SLOW, async () => {
    await open(`${BUDGET}&state=empty_no_quote`);
    const first = within(main()).getByRole('button', { name: 'Add the first cost' });
    const quote = within(section('Vendors quoted')).getByRole('button', { name: 'Add a quote' });
    expect(first.compareDocumentPosition(quote) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

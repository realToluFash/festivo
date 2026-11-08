import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { forgetBudget } from './quotes.ts';

const tested = config();
const SLOW = { timeout: 15000 };
const at = (state: string, more = '') => `/demo/events/evt-wed-4?area=budget&state=${state}${more}`;

async function open(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  render(<RouterProvider router={router} />);
  await screen.findByRole('heading', { level: 1 }, SLOW);

  return router;
}

function section(name: string): HTMLElement {
  const found = within(screen.getByRole('main')).getByRole('heading', { name }).closest('section');
  if (found == null) throw new Error(`${name} is not drawn`);

  return found;
}

const pence = (text: string) => Math.round(Number(text.replace(/[£,]/g, '')) * 100);

describe('the Budget page at a desk in A (sc-31779)', () => {
  beforeEach(() => __setConfig({ ...tested, environment: 'development' }));
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    forgetBudget();
  });

  it(
    'leads with the card: the range, the ceiling, the count and what needs you',
    SLOW,
    async () => {
      await open(at('populated'));
      const card = screen.getByRole('region', { name: 'Budget' });

      expect(card.textContent).toContain('£19,730 to £23,060');
      expect(card.textContent).toContain('Over if all come');
      expect(card.textContent).toContain('2 costs not priced yet');
      expect(card.textContent).toContain('£206');
      expect(card.textContent).toContain('Bloom & Co’s balance, £840, was due Fri, Oct 30.');
      expect(within(card).getByRole('button', { name: /Mark paid/ })).toBeTruthy();
    },
  );

  it(
    'shows its cost rows in the minor unit, adding up to the card’s lower figure exactly',
    SLOW,
    async () => {
      await open(at('populated'));
      const amounts = [...section('Costs').querySelectorAll('.bud-amount-value')].map(
        (one) => one.textContent ?? '',
      );

      expect(amounts).toContain('£6,528.00');
      expect(amounts.every((one) => /\.\d{2}$/.test(one))).toBe(true);
      expect(amounts.reduce((sum, one) => sum + pence(one), 0)).toBe(1973000);
    },
  );

  it(
    'opens a rate in place, refuses letters at the field, and saves with Enter',
    SLOW,
    async () => {
      await open(at('populated'));
      fireEvent.click(within(section('Costs')).getByRole('button', { name: /^Dinner/ }));
      const rate = screen.getByLabelText('Rate for Dinner');

      fireEvent.change(rate, { target: { value: 'seventy' } });
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      expect(screen.getByText('Enter a rate of 0 or more, in numbers only.')).toBeTruthy();
      expect(document.activeElement).toBe(rate);

      vi.useFakeTimers();
      fireEvent.change(rate, { target: { value: '70' } });
      fireEvent.keyDown(rate, { key: 'Enter' });
      expect(screen.getByRole('button', { name: 'Saving…' })).toBeTruthy();
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
      expect(screen.getByText('Saved.')).toBeTruthy();
      expect(screen.getByRole('region', { name: 'Budget' }).textContent).toContain(
        '£19,922 to £23,326',
      );
    },
  );

  it(
    'warns under the field when a rate takes the event over its ceiling, and still saves',
    SLOW,
    async () => {
      await open(at('rate_warning'));

      expect(screen.getByText('£72 takes the event over its ceiling.')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Save' }).getAttribute('aria-disabled')).not.toBe(
        'true',
      );
    },
  );

  it('removes a cost with Undo and no timer, and Undo puts it back', SLOW, async () => {
    await open(at('removed_priced'));

    expect(screen.getByText('DJ removed. The settled total fell by £900.')).toBeTruthy();
    expect(within(section('Costs')).queryByRole('button', { name: /^DJ/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(within(section('Costs')).getByRole('button', { name: /^DJ/ })).toBeTruthy();
  });

  it('refuses Add a cost with three blank fields, sending nothing', SLOW, async () => {
    await open(at('add_cost_blank'));
    const dialog = await screen.findByRole('dialog', {}, SLOW);

    expect(within(dialog).getByText('3 fields need fixing, so nothing was sent.')).toBeTruthy();
    expect(within(dialog).getByText('Enter what it is.')).toBeTruthy();
    expect(within(dialog).getByText('Choose a category.')).toBeTruthy();
    expect(within(dialog).getByText('Choose how it is counted.')).toBeTruthy();
  });

  it('refuses a ceiling below 0, then saves it once fixed', SLOW, async () => {
    await open(at('ceiling_negative'));
    const dialog = await screen.findByRole('dialog', {}, SLOW);

    expect(
      within(dialog).getByText('The ceiling cannot be below 0. Enter 0 or more.'),
    ).toBeTruthy();
    vi.useFakeTimers();
    fireEvent.change(within(dialog).getByLabelText('Transport'), { target: { value: '640' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save the ceiling' }));
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText('Ceiling saved.')).toBeTruthy();
    expect(section('Ceiling').textContent).toContain('Transport · £640.00');
  });

  it(
    'starts first time from what the event knows, with Start from an earlier budget',
    SLOW,
    async () => {
      await open(at('first_time'));

      expect(screen.getByText('No costs yet')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Start from an earlier budget' })).toBeTruthy();
      cleanup();
      await open(at('nothing_to_start'));
      expect(screen.queryByRole('button', { name: 'Start from an earlier budget' })).toBeNull();
    },
  );

  it('carries margin on the card for Enterprise, and advises below cost', SLOW, async () => {
    await open(at('margin'));

    expect(screen.getByRole('region', { name: 'Budget' }).textContent).toContain('Client total');
    expect(screen.getByText('Below cost: margin −£100.')).toBeTruthy();
    cleanup();
    await open(at('margin_before_paid'));
    const card = screen.getByRole('region', { name: 'Budget' }).textContent ?? '';
    expect(card).toContain('Client total');
    expect(card).not.toContain('Margin after payments');
    cleanup();
    await open(at('free', '&plan=free'));
    expect(screen.getByRole('region', { name: 'Budget' }).textContent).not.toContain(
      'Client total',
    );
  });

  it('is not available to someone who can only edit the event', SLOW, async () => {
    await open(at('populated', '&as=kemi'));

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'This event is not available',
    );
    const sidebar = screen.getByRole('navigation', { name: 'Adaeze & Tunde’s wedding' });
    expect(within(sidebar).queryByRole('link', { name: 'Budget' })).toBeNull();
    expect(within(sidebar).getByRole('link', { name: 'Guests' })).toBeTruthy();
  });

  it('opens Due now from the reminder: Paid in one tap, with Undo (sc-1331)', SLOW, async () => {
    await open(at('due_now'));
    const dialog = await screen.findByRole('dialog', {}, SLOW);

    expect(within(dialog).getByText('From the reminder sent Nov 1 · 2 payments')).toBeTruthy();
    fireEvent.click(within(dialog).getAllByRole('button', { name: 'Paid' })[0]!);
    expect(within(dialog).getByText('Marked paid · £840.00')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Undo' }));
    expect(within(dialog).getAllByRole('button', { name: 'Paid' })).toHaveLength(2);
    fireEvent.click(within(dialog).getAllByRole('button', { name: 'Paid' })[0]!);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Paid' }));
    expect(within(dialog).getByText('Nothing left to pay from this reminder')).toBeTruthy();
    cleanup();
    await open(at('due_read_only'));
    expect(
      within(await screen.findByRole('dialog', {}, SLOW)).queryByRole('button', { name: 'Paid' }),
    ).toBeNull();
  });

  it('opens Save as template over the page, from its row and from save_taken', SLOW, async () => {
    await open(at('save_taken'));
    const dialog = await screen.findByRole('dialog', {}, SLOW);

    expect(
      within(dialog).getByText('A template with that name already exists. Choose another name.'),
    ).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    fireEvent.click(
      within(section('From other events')).getByRole('button', { name: /Save as template/ }),
    );
    expect(await screen.findByRole('dialog', {}, SLOW)).toBeTruthy();
  });

  it(
    'says the card’s one thing: a payment due, else early on Add a price, else the ceiling',
    SLOW,
    async () => {
      await open(at('populated'));
      let card = screen.getByRole('region', { name: 'Budget' });
      expect(within(card).getByRole('button', { name: /Mark paid/ })).toBeTruthy();
      cleanup();

      await open(at('early_on'));
      card = screen.getByRole('region', { name: 'Budget' });
      expect(card.textContent).toContain('2 costs not priced yet.');
      fireEvent.click(within(card).getByRole('button', { name: /Add a price/ }));
      expect(screen.getByLabelText('Amount for Aisle arch')).toBeTruthy();
      cleanup();

      await open(at('nothing_due'));
      card = screen.getByRole('region', { name: 'Budget' });
      expect(card.textContent).toContain(
        'Settled, it is £19,730. If everyone comes, it would be £23,060 against £22,000.',
      );
      expect(within(card).queryByRole('button')).toBeNull();
    },
  );

  it(
    'says a saved template and applies a saved markup to the card and the rows',
    SLOW,
    async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      await open(at('save_blank'));
      let dialog = await screen.findByRole('dialog', {}, SLOW);
      fireEvent.change(within(dialog).getByLabelText('Name'), {
        target: { value: 'Garden wedding' },
      });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
      await act(async () => {
        vi.advanceTimersByTime(1500);
      });
      expect(screen.getByText('Template saved.')).toBeTruthy();
      cleanup();

      await open(at('markup'));
      dialog = await screen.findByRole('dialog', {}, SLOW);
      fireEvent.change(within(dialog).getByLabelText('Markup'), { target: { value: '25' } });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Save' }));
      expect(screen.getByText('Markup saved.')).toBeTruthy();
      const card = screen.getByRole('region', { name: 'Budget' }).textContent ?? '';
      expect(card).toContain('£25,848 to £30,010');
      expect(section('Costs').textContent).toContain('25% markup, the event’s');
    },
  );

  it(
    'refuses 8OO or an empty Charged at, and says a ceiling saved in another currency changes nothing',
    SLOW,
    async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      await open(at('margin'));
      const field = screen.getByLabelText('Charged at');
      fireEvent.change(field, { target: { value: '8OO' } });
      fireEvent.click(within(section('Costs')).getByRole('button', { name: 'Save' }));
      expect(screen.getByText('Enter a rate of 0 or more, in numbers only.')).toBeTruthy();
      expect(field.getAttribute('aria-invalid')).toBe('true');
      expect(document.activeElement).toBe(field);
      fireEvent.change(field, { target: { value: '' } });
      fireEvent.click(within(section('Costs')).getByRole('button', { name: 'Save' }));
      expect(screen.getByText('Enter the amount.')).toBeTruthy();
      expect(document.activeElement).toBe(field);
      cleanup();

      await open(at('ceiling_decimals', '&currency=KWD'));
      const dialog = await screen.findByRole('dialog', {}, SLOW);
      fireEvent.change(within(dialog).getByLabelText('Transport'), {
        target: { value: '640.555' },
      });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Save the ceiling' }));
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
      expect(screen.getByText('The sample stays in pounds, so nothing changed.')).toBeTruthy();
    },
  );
});

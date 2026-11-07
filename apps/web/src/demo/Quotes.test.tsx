import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { QUOTES_PAGES } from './quotes.ts';

const tested = config();
const SLOW = { timeout: 20000 };
const BUDGET = '/demo/events/evt-wed-4?area=budget';
const SAVOUR = `${BUDGET}&vendor=v4`;

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

function card(name: string): HTMLElement {
  return within(main()).getByRole('region', { name });
}

function rowOf(what: string): HTMLElement {
  const found = within(section('Schedule'))
    .getAllByRole('listitem')
    .find((item) => item.textContent?.startsWith(what));
  if (found == null) throw new Error(`${what} is not on the schedule`);

  return found;
}

async function settle(ms = 1000) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe('Quotes and what is due on the wedding’s Budget, in A (sc-87, sc-88)', () => {
  beforeEach(() => {
    __setConfig({ ...tested, environment: 'development' });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it(
    'shows Due next, three soonest with Overdue, and Vendors quoted with the difference',
    SLOW,
    async () => {
      await open(BUDGET);

      expect(within(main()).getByRole('heading', { level: 1, name: 'Budget' })).toBeDefined();
      expect(within(main()).getByText('AC, not yet built · sc-85')).toBeDefined();
      const due = within(section('Due next')).getAllByRole('listitem');
      expect(due.map((one) => one.textContent)).toEqual([
        'Bloom & CoOverdueBalance · Due Fri, Oct 30£840.00',
        'Savour KitchenDeposit · Due Wed, Nov 4£4,500.00',
        'The LandmarkBalance · Due Thu, Nov 5£3,150.00',
      ]);
      expect(
        within(section('Due next'))
          .getByRole('link', { name: 'Everything due · 5' })
          .getAttribute('href'),
      ).toBe(`${BUDGET}&view=due`);

      const quoted = within(section('Vendors quoted')).getAllByRole('link');
      expect(quoted.map((one) => one.getAttribute('href'))).toEqual([
        `${BUDGET}&vendor=v4`,
        `${BUDGET}&vendor=v5`,
        `${BUDGET}&vendor=v6`,
        `${BUDGET}&vendor=v3`,
      ]);
      expect(quoted[0]?.textContent).toBe(
        'Savour KitchenCatering · Kofi Mensah£9,000.00£1,500.00 not scheduled',
      );
      expect(quoted[3]?.textContent).toBe(
        'Bloom & CoFlowers · Ngozi Eze£1,200.00Matches the quote',
      );
    },
  );

  it(
    'opens the whole list at Everything due, soonest first, each row to its vendor',
    SLOW,
    async () => {
      await open(`${BUDGET}&view=due`);

      expect(
        within(main()).getByRole('heading', { level: 1, name: 'Everything due' }),
      ).toBeDefined();
      expect(screen.getByRole('navigation', { name: 'Breadcrumb' }).textContent).toBe(
        'EventsAdaeze & Tunde’s weddingBudgetEverything due',
      );
      const rows = within(main())
        .getAllByRole('link')
        .filter((one) => one.closest('.qt-list') != null);
      expect(rows.map((one) => one.textContent?.split('£')[0])).toEqual([
        'Bloom & CoOverdueBalance · Due Fri, Oct 30',
        'Savour KitchenDeposit · Due Wed, Nov 4',
        'The LandmarkBalance · Due Thu, Nov 5',
        'Savour KitchenSecond instalment · Due Mon, Nov 9',
        'Lens & LightBalance · Due Mon, Nov 30',
      ]);
      expect(rows[4]?.getAttribute('href')).toBe(`${BUDGET}&vendor=v6`);
    },
  );

  it('says each empty state in one line', SLOW, async () => {
    await open(`${BUDGET}&state=no_quotes`);
    expect(
      within(section('Vendors quoted')).getByText('No quotes on this event yet.'),
    ).toBeDefined();
    expect(
      within(section('Vendors quoted')).getByRole('button', { name: 'Add a quote' }),
    ).toBeDefined();
    expect(within(section('Due next')).getByText('Nothing is due.')).toBeDefined();
    expect(within(section('Due next')).queryByRole('link')).toBeNull();
    cleanup();

    await open(`${BUDGET}&state=nothing_due`);
    expect(within(section('Due next')).getByText('Nothing is due.')).toBeDefined();
    cleanup();

    await open(`${SAVOUR}&state=no_payments`);
    expect(within(section('Schedule')).getByText('No payments scheduled yet.')).toBeDefined();
    expect(
      within(section('Schedule')).getByRole('button', { name: 'Add a payment' }),
    ).toBeDefined();
    expect(card('Savour Kitchen').textContent).toContain(
      'Quoted on Tue, Oct 13. £9,000 of the quote is not scheduled yet.',
    );
  });

  it('leads a vendor’s page with A’s card, then its schedule and the quote', SLOW, async () => {
    await open(`${SAVOUR}&state=vendor`);

    const name = within(main()).getByRole('heading', { level: 1, name: 'Savour Kitchen' });
    expect(name.querySelector('a')?.getAttribute('href')).toBe(
      '/demo/settings/vendors?state=from_event&vendor=v4',
    );
    expect(within(main()).getByText('Catering · Kofi Mensah')).toBeDefined();
    expect(screen.getByRole('navigation', { name: 'Breadcrumb' }).textContent).toBe(
      'EventsAdaeze & Tunde’s weddingBudgetSavour Kitchen',
    );
    const top = card('Savour Kitchen');
    expect(top.textContent).toBe(
      'CateringKofi MensahQuoted£9,000Quoted on Tue, Oct 13. £1,500 of the quote is not scheduled yet.Add a payment',
    );

    expect(rowOf('Deposit').textContent).toBe(
      'DepositDue Wed, Nov 4£4,500.00Mark paidChangeRemove',
    );
    expect(
      within(section('Schedule')).getByText('£1,500.00 of the quote is not scheduled yet.'),
    ).toBeDefined();
    expect(
      within(section('Schedule')).getByText('Quoted £9,000.00 · Scheduled £7,500.00'),
    ).toBeDefined();

    const quote = section('The quote');
    expect(within(quote).getByRole('button', { name: 'Revise the quote' })).toBeDefined();
    expect(within(quote).getByRole('button', { name: 'Correct the quote' })).toBeDefined();
    expect(within(quote).getByText('Dinner and Drinks package')).toBeDefined();
    const earlier = within(quote).getByRole('button', { name: /^Show the earlier quote/ });
    expect(earlier.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(earlier);
    expect(within(quote).getByText('£8,400.00, quoted on Mon, Sep 21 · No. SK-0398')).toBeDefined();
  });

  it('opens the earlier quote, and keeps the name plain for the event’s Lead', SLOW, async () => {
    await open(`${SAVOUR}&state=earlier`);
    expect(within(section('The quote')).getByText('The earlier quote')).toBeDefined();
    cleanup();

    for (const path of [`${SAVOUR}&state=lead`, `${SAVOUR}&as=ana`]) {
      await open(path);
      const name = within(main()).getByRole('heading', { level: 1, name: 'Savour Kitchen' });
      expect(name.querySelector('a')).toBeNull();
      expect(within(main()).getAllByRole('button', { name: 'Mark paid' })).toHaveLength(2);
      cleanup();
    }

    await open(`${SAVOUR}&as=julien`);
    expect(within(main()).getByRole('link', { name: 'Savour Kitchen' }).getAttribute('href')).toBe(
      '/demo/settings/vendors?state=from_event&vendor=v4&as=julien',
    );
  });

  it('reads only after a downgrade, with See plans only for billing.manage', SLOW, async () => {
    const line =
      'Quotes and payment schedules are read-only because this organisation’s plan no longer includes them. Nothing has been removed.';
    await open(`${SAVOUR}&state=read_only`);
    expect(within(main()).getByText(line)).toBeDefined();
    expect(within(main()).getByRole('button', { name: 'See plans' })).toBeDefined();
    for (const verb of ['Add a payment', 'Mark paid', 'Change', 'Remove', 'Revise the quote'])
      expect(within(main()).queryByRole('button', { name: verb })).toBeNull();
    cleanup();

    await open(`${BUDGET}&state=read_only&as=julien`);
    expect(within(main()).getByText(line)).toBeDefined();
    expect(within(main()).queryByRole('button', { name: 'See plans' })).toBeNull();
    expect(within(main()).queryByRole('button', { name: 'Add a quote' })).toBeNull();
  });

  it(
    'marks Bloom & Co’s overdue balance paid from the card, with Undo in the row',
    SLOW,
    async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      await open(`${BUDGET}&vendor=v3`);
      const top = card('Bloom & Co');
      expect(within(top).getByText('The balance, £840.00, was due Fri, Oct 30.')).toBeDefined();
      expect(rowOf('Deposit').textContent).toBe(
        'DepositPaid £360.00 on Tue, Oct 6 · Marked by Folake Adeyemi',
      );

      fireEvent.click(within(top).getByRole('button', { name: 'Mark paid' }));
      const dialog = screen.getByRole('dialog', { name: 'Mark paid' });
      expect(
        within(dialog).getByText('Bloom & Co · Balance · Adaeze & Tunde’s wedding'),
      ).toBeDefined();
      expect(within(dialog).getByText('Scheduled')).toBeDefined();
      const amount = within(dialog).getByLabelText('Amount paid') as HTMLInputElement;
      expect(amount.value).toBe('840.00');
      expect((within(dialog).getByLabelText('Date paid') as HTMLInputElement).value).toBe(
        '2026-11-03',
      );

      fireEvent.change(amount, { target: { value: '0' } });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Mark paid' }));
      expect(
        within(dialog).getByText('Enter the amount paid, above 0, like 840.00.'),
      ).toBeDefined();

      fireEvent.change(amount, { target: { value: '840.00' } });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Mark paid' }));
      await settle();

      expect(screen.queryByRole('dialog')).toBeNull();
      expect(rowOf('Balance').textContent).toBe(
        'BalancePaid £840.00 on Tue, Nov 3 · Marked by Folake AdeyemiUndo',
      );
      expect(
        within(main()).getByText('Marked paid: £840.00 on Tuesday, November 3.'),
      ).toBeDefined();
      expect(within(top).queryByText('The balance, £840.00, was due Fri, Oct 30.')).toBeNull();

      fireEvent.click(within(rowOf('Balance')).getByRole('button', { name: 'Undo' }));
      expect(within(rowOf('Balance')).getByRole('button', { name: 'Mark paid' })).toBeDefined();
    },
  );

  it('marks a payment paid from its row, and Due next counts one fewer', SLOW, async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await open(SAVOUR);
    fireEvent.click(within(rowOf('Deposit')).getByRole('button', { name: 'Mark paid' }));
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Mark paid' })).getByRole('button', {
        name: 'Mark paid',
      }),
    );
    await settle();
    expect(rowOf('Deposit').textContent).toContain('Paid £4,500.00 on Tue, Nov 3');

    fireEvent.click(within(main()).getAllByRole('link', { name: 'Budget' })[0]!);
    expect(await within(main()).findByRole('link', { name: 'Everything due · 4' })).toBeDefined();
  });

  it('opens Mark paid from a Due next row; the row stays lit with Undo', SLOW, async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await open(BUDGET);
    fireEvent.click(
      within(section('Due next')).getByRole('button', {
        name: 'Mark paid: Bloom & Co, Balance, £840.00',
      }),
    );
    const dialog = screen.getByRole('dialog', { name: 'Mark paid' });
    expect(within(dialog).getByText(/Bloom & Co · Balance/)).toBeDefined();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Mark paid' }));
    await settle();
    expect(section('Due next').textContent).toContain(
      'Marked paid: £840.00 on Tuesday, November 3.',
    );
    expect(
      within(section('Due next')).getByRole('link', { name: 'Everything due · 4' }),
    ).toBeDefined();
    fireEvent.click(within(section('Due next')).getByRole('button', { name: 'Undo' }));
    expect(
      within(section('Due next')).getByRole('link', { name: 'Everything due · 5' }),
    ).toBeDefined();
  });

  it('refuses a blank date paid at its field, sending nothing', SLOW, async () => {
    await open(BUDGET);
    fireEvent.click(
      within(section('Due next')).getByRole('button', { name: /^Mark paid: Savour Kitchen/ }),
    );
    const dialog = screen.getByRole('dialog', { name: 'Mark paid' });
    fireEvent.change(within(dialog).getByLabelText('Date paid'), { target: { value: '' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Mark paid' }));
    expect(within(dialog).getByText('Enter the date it was paid.')).toBeDefined();
  });

  it('offers vendors by name, one already quoted that cannot be chosen', SLOW, async () => {
    await open(`${BUDGET}&state=add`);
    const dialog = screen.getByRole('dialog', { name: 'Add a quote' });
    const field = within(dialog).getByRole('combobox', { name: 'Vendor' });
    fireEvent.focus(field);
    const bloom = within(dialog).getByRole('option', { name: /^Bloom & Co/ });
    expect(bloom.textContent).toBe('Bloom & CoFlowers · Ngozi EzeAlready quoted on this event');
    expect(bloom.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(bloom);
    expect((field as HTMLInputElement).value).toBe('');
    cleanup();

    await open(`${BUDGET}&state=vendor_typed`);
    const typed = screen.getByRole('dialog', { name: 'Add a quote' });
    fireEvent.focus(within(typed).getByRole('combobox', { name: 'Vendor' }));
    const beat = within(typed).getByRole('option', { name: /^Beat Collective/ });
    expect(beat.textContent).toBe('Beat CollectiveMusic · Ade Ojo');
    fireEvent.click(beat);
    expect(
      (within(typed).getByRole('combobox', { name: 'Vendor' }) as HTMLInputElement).value,
    ).toBe('Beat Collective');
  });

  it('tells an owner where to add a vendor, and a Lead whom to ask', SLOW, async () => {
    await open(`${BUDGET}&state=vendor_none`);
    let dialog = screen.getByRole('dialog', { name: 'Add a quote' });
    expect(within(dialog).getByText('No vendor matches “eclat”.')).toBeDefined();
    expect(
      within(dialog)
        .getByRole('link', { name: 'Add the vendor on the Vendors page first.' })
        .getAttribute('href'),
    ).toBe('/demo/settings/vendors');
    cleanup();

    await open(`${BUDGET}&state=vendor_none&as=ana`);
    dialog = screen.getByRole('dialog', { name: 'Add a quote' });
    expect(within(dialog).getByText('Ask an owner or admin to add the vendor.')).toBeDefined();
    expect(within(dialog).queryByRole('link')).toBeNull();
    cleanup();

    await open(`${BUDGET}&state=no_vendors`);
    dialog = screen.getByRole('dialog', { name: 'Add a quote' });
    expect(within(dialog).getByText('There are no vendors to choose from.')).toBeDefined();
  });

  it('adds Beat Collective’s quote for the DJ, at 800 in two columns', SLOW, async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await open(`${BUDGET}&state=add_filled`);
    const dialog = screen.getByRole('dialog', { name: 'Add a quote' });
    expect(dialog.querySelector('.bud-width.is-800')).not.toBeNull();
    const dj = within(dialog).getByRole('checkbox', { name: /^DJ/ }) as HTMLInputElement;
    expect(dj.checked).toBe(true);
    expect(
      within(dialog)
        .getByRole('checkbox', { name: /^Dinner/ })
        .hasAttribute('disabled'),
    ).toBe(true);
    expect(within(dialog).getAllByText('Agreed in the quote from Savour Kitchen')).toHaveLength(2);

    fireEvent.click(within(dialog).getByRole('button', { name: 'Add' }));
    await settle();

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(within(section('Vendors quoted')).getAllByRole('link')).toHaveLength(5);
    expect(
      screen.getByText('Quote added: Beat Collective, £1,250.00, quoted on Monday, November 2.'),
    ).toBeDefined();
  });

  it(
    'marks each required field before sending, and the server’s refusals at the top',
    SLOW,
    async () => {
      await open(`${BUDGET}&state=add_blank`);
      let dialog = screen.getByRole('dialog', { name: 'Add a quote' });
      expect(within(dialog).getByText('4 fields need fixing, so nothing was sent.')).toBeDefined();
      for (const line of [
        'Choose the vendor.',
        'Enter what the quote covers.',
        'Enter the date quoted.',
      ])
        expect(within(dialog).getByText(line)).toBeDefined();
      cleanup();

      const words: Record<string, string> = {
        invalid_amount: 'Enter the amount as a number above 0, like 3,500.50.',
        future_date: 'The date quoted cannot be in the future. Choose today or an earlier date.',
        too_long: 'Shorten what the quote covers to 500 characters or fewer.',
        second_quote:
          'That vendor already has a quote on this event, so this quote was not saved. To give a new price, revise that quote.',
        vendor_gone:
          'That vendor is no longer one of this organisation’s vendors, so the quote was not saved.',
        line_taken:
          'Aisle arch is already agreed in the quote from Bloom & Co, so this quote was not saved. Untick it in that quote first.',
      };
      for (const [state, line] of Object.entries(words)) {
        await open(`${BUDGET}&state=${state}`);
        dialog = screen.getByRole('dialog', { name: 'Add a quote' });
        expect(within(dialog).getByText(line)).toBeDefined();
        cleanup();
      }
    },
  );

  it('revises Savour Kitchen’s quote and keeps the earlier one', SLOW, async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await open(`${SAVOUR}&state=revise`);
    const dialog = screen.getByRole('dialog', { name: 'Revise the quote' });
    expect((within(dialog).getByLabelText('Amount') as HTMLInputElement).value).toBe('9,400.00');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Revise' }));
    await settle();

    expect(card('Savour Kitchen').textContent).toContain('£9,400');
    fireEvent.click(
      within(section('The quote')).getByRole('button', { name: /^Show the earlier quote/ }),
    );
    expect(
      within(section('The quote')).getByText('£9,000.00, quoted on Tue, Oct 13 · No. SK-0412'),
    ).toBeDefined();
  });

  it('refuses a revise with nothing changed and offers Correct instead', SLOW, async () => {
    await open(`${SAVOUR}&state=revise_unchanged`);
    const dialog = screen.getByRole('dialog', { name: 'Revise the quote' });
    expect(within(dialog).getAllByText(/^Change the amount or the date quoted/)).toHaveLength(2);

    fireEvent.click(within(dialog).getByRole('button', { name: 'Correct the quote instead' }));
    const correct = screen.getByRole('dialog', { name: 'Correct the quote' });
    expect(within(correct).getByRole('button', { name: 'Revise the quote instead' })).toBeDefined();
    cleanup();

    await open(`${SAVOUR}&state=correct`);
    expect(screen.getByRole('dialog', { name: 'Correct the quote' })).toBeDefined();
  });

  it('adds a payment at 700, and refuses one due before the quote', SLOW, async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await open(`${SAVOUR}&state=payment_refused`);
    let dialog = screen.getByRole('dialog', { name: 'Add a payment' });
    expect(within(dialog).getByText('Enter what the payment is for.')).toBeDefined();
    expect(
      within(dialog).getByText(
        'The date due cannot be before the quote from Savour Kitchen on Tuesday, October 13. Choose that date or a later one.',
      ),
    ).toBeDefined();
    cleanup();

    await open(`${SAVOUR}&state=add_payment`);
    dialog = screen.getByRole('dialog', { name: 'Add a payment' });
    expect(dialog.querySelector('.bud-width.is-700')).not.toBeNull();
    fireEvent.change(within(dialog).getByLabelText('What the payment is for'), {
      target: { value: 'Balance' },
    });
    fireEvent.change(within(dialog).getByLabelText('Amount'), { target: { value: '1,500' } });
    fireEvent.change(within(dialog).getByLabelText('Date due'), {
      target: { value: '2026-11-20' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add' }));
    await settle();

    expect(rowOf('Balance').textContent).toContain('£1,500.00');
    expect(within(section('Schedule')).getByText('The schedule matches the quote.')).toBeDefined();
  });

  it('changes a payment in place, and asks once in the row before removing one', SLOW, async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await open(`${SAVOUR}&state=amend`);
    const amount = within(section('Schedule')).getByLabelText('Amount') as HTMLInputElement;
    expect(amount.value).toBe('3,500.00');
    fireEvent.click(within(section('Schedule')).getByRole('button', { name: 'Save' }));
    await settle();
    expect(rowOf('Second instalment').textContent).toContain('£3,500.00');
    expect(
      within(section('Schedule')).getByText('£1,000.00 of the quote is not scheduled yet.'),
    ).toBeDefined();
    cleanup();

    await open(`${SAVOUR}&state=remove`);
    const ask = within(rowOf('Second instalment')).getByRole('group', {
      name: 'Remove this payment?',
    });
    expect(document.activeElement?.textContent).toBe('Keep');
    fireEvent.click(within(ask).getByRole('button', { name: 'Remove' }));
    expect(within(section('Schedule')).queryByText('Second instalment')).toBeNull();
    expect(
      within(section('Schedule')).getByText('£4,500.00 of the quote is not scheduled yet.'),
    ).toBeDefined();
  });

  it(
    'stays closed after Cancel, and keeps its marks after Add, once the vendor field blurs',
    SLOW,
    async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      await open(`${BUDGET}&state=add`);
      let dialog = screen.getByRole('dialog', { name: 'Add a quote' });
      let field = within(dialog).getByRole('combobox', { name: 'Vendor' });

      fireEvent.focus(field);
      fireEvent.blur(field);
      fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
      await settle(300);
      expect(screen.queryByRole('dialog')).toBeNull();

      fireEvent.click(within(main()).getByRole('button', { name: 'Add a quote' }));
      dialog = screen.getByRole('dialog', { name: 'Add a quote' });
      field = within(dialog).getByRole('combobox', { name: 'Vendor' });
      fireEvent.focus(field);
      fireEvent.blur(field);
      fireEvent.click(within(dialog).getByRole('button', { name: 'Add' }));
      await settle(300);
      expect(within(dialog).getByText('Choose the vendor.')).toBeDefined();
      expect(field.getAttribute('aria-invalid')).toBe('true');
    },
  );

  it('gives each payment added its own row, after one is removed', SLOW, async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await open(`${SAVOUR}&state=no_payments`);
    const add = async (what: string, amount: string) => {
      fireEvent.click(within(main()).getAllByRole('button', { name: 'Add a payment' })[0]!);
      const dialog = screen.getByRole('dialog', { name: 'Add a payment' });
      fireEvent.change(within(dialog).getByLabelText('What the payment is for'), {
        target: { value: what },
      });
      fireEvent.change(within(dialog).getByLabelText('Amount'), { target: { value: amount } });
      fireEvent.change(within(dialog).getByLabelText('Date due'), {
        target: { value: '2026-11-10' },
      });
      fireEvent.click(within(dialog).getByRole('button', { name: 'Add' }));
      await settle();
    };
    const rows = () =>
      within(section('Schedule'))
        .getAllByRole('listitem')
        .filter((one) => one.hasAttribute('data-payment'));
    const removeFirst = () => {
      fireEvent.click(within(rows()[0]!).getByRole('button', { name: 'Remove' }));
      fireEvent.click(within(rows()[0]!).getByRole('button', { name: 'Remove' }));
    };

    await add('First', '100');
    await add('Second', '200');
    removeFirst();
    await add('Third', '300');
    expect(rows().map((one) => one.textContent?.split('Due')[0])).toEqual(['Second', 'Third']);

    removeFirst();
    expect(rows().map((one) => one.textContent?.split('Due')[0])).toEqual(['Third']);
  });

  it('opens every state the demo’s home lists, each on its page', SLOW, async () => {
    for (const link of QUOTES_PAGES.flatMap((page) => page.states)) {
      await open(link.to);
      const vendor = new URLSearchParams(link.to.split('?')[1]).get('vendor');
      const title = within(main()).getByRole('heading', { level: 1 }).textContent;
      expect(title === 'Budget' || title === 'Everything due' || vendor != null).toBe(true);
      cleanup();
    }
  });
});

import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { __setConfig, config } from '../config.ts';
import { routes } from '../routes/index.tsx';
import { budgetAt } from './budgetSample.ts';
import { PAYMENTS_PAGES } from './payments.ts';

const tested = config();
const SLOW = { timeout: 20000 };
const BLOOM = '/demo/events/evt-wed-4?area=budget&vendor=v3';
const SAVOUR = '/demo/events/evt-wed-4?area=budget&vendor=v4';
const REMINDERS = '/demo/settings/payment-reminders';

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

function rowOf(what: string): HTMLElement {
  const found = within(section('Schedule'))
    .getAllByRole('listitem')
    .find((item) => item.textContent?.startsWith(what));
  if (found == null) throw new Error(`${what} is not on the schedule`);

  return found;
}

function dialog(name: string): HTMLElement {
  return screen.getByRole('dialog', { name });
}

function type(within_: HTMLElement, label: string, value: string): void {
  fireEvent.change(within(within_).getByLabelText(label), { target: { value } });
}

async function settle(ms = 1000) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe('payments on a vendor’s page, shapes and the reminder setting, in A (sc-88, sc-1332, sc-95)', () => {
  beforeEach(() => {
    __setConfig({ ...tested, environment: 'development' });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it(
    'draws Bloom & Co’s schedule: the deposit paid, the balance with Mark paid and Cancel payment',
    SLOW,
    async () => {
      await open(`${BLOOM}&state=schedule`);
      expect(rowOf('Deposit').textContent).toBe(
        'DepositPaid £360.00 on Tue, Oct 6 · Marked by Folake Adeyemi',
      );
      expect(rowOf('Balance').textContent).toBe(
        'BalanceOverdueDue Fri, Oct 30£840.00Mark paidCancel paymentChangeRemove',
      );
      expect(
        within(section('Schedule')).getByRole('button', { name: 'Add a payment already made' }),
      ).toBeDefined();
    },
  );

  it(
    'opens Mark paid from the Budget card’s step and Due now’s Paid a different amount',
    SLOW,
    async () => {
      await open(budgetAt('mark_paid', { vendor: 'v3' }));
      let marking = dialog('Mark paid');
      expect(
        within(marking).getByText('Bloom & Co · Balance · Adaeze & Tunde’s wedding'),
      ).toBeDefined();
      expect((within(marking).getByLabelText('Amount paid') as HTMLInputElement).value).toBe(
        '840.00',
      );
      cleanup();

      await open(budgetAt('paid_more', { vendor: 'v4' }));
      marking = dialog('Mark paid');
      expect(
        within(marking).getByText('Savour Kitchen · Deposit · Adaeze & Tunde’s wedding'),
      ).toBeDefined();
      expect(document.activeElement).toBe(within(marking).getByLabelText('Amount paid'));
    },
  );

  it(
    'marks the balance paid for more than scheduled, says the difference, and undoes it',
    SLOW,
    async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      await open(`${BLOOM}&state=paid_more`);
      const marking = dialog('Mark paid');
      expect(
        within(marking).getByText(
          '£60.00 more than scheduled. The difference stays visible; nothing absorbs it.',
        ),
      ).toBeDefined();
      type(marking, 'Amount paid', '800.00');
      expect(
        within(marking).getByText(
          '£40.00 less than scheduled. The difference stays visible; nothing absorbs it.',
        ),
      ).toBeDefined();
      type(marking, 'Amount paid', '900.00');
      fireEvent.click(within(marking).getByRole('button', { name: 'Mark paid' }));
      await settle();

      expect(screen.queryByRole('dialog')).toBeNull();
      expect(rowOf('Balance').textContent).toBe(
        'BalancePaid £900.00 on Tue, Nov 3 · £60.00 more than scheduled · Marked by Folake AdeyemiUndo',
      );
      expect(
        within(main()).getByText('Marked paid: £900.00 on Tuesday, November 3.'),
      ).toBeDefined();
      fireEvent.click(within(rowOf('Balance')).getByRole('button', { name: 'Undo' }));
      expect(within(rowOf('Balance')).getByRole('button', { name: 'Mark paid' })).toBeDefined();
    },
  );

  it(
    'refuses 0 and a reference over 100 at the fields, then marks once both are fixed',
    SLOW,
    async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      await open(`${BLOOM}&state=mark_refused`);
      const marking = dialog('Mark paid');
      const amount = within(marking).getByLabelText('Amount paid');
      const reference = within(marking).getByLabelText('Reference');
      expect(amount.getAttribute('aria-invalid')).toBe('true');
      expect(reference.getAttribute('aria-invalid')).toBe('true');
      expect(
        within(marking).getByText('Enter the amount paid, above 0, like 840.00.'),
      ).toBeDefined();
      expect(
        within(marking).getByText('Shorten the reference to 100 characters or fewer.'),
      ).toBeDefined();

      fireEvent.click(within(marking).getByRole('button', { name: 'Mark paid' }));
      expect(within(marking).getByText('2 fields need fixing, so nothing was sent.')).toBeDefined();
      type(marking, 'Amount paid', '840.00');
      type(marking, 'Reference', 'FP-2210-AB8');
      expect(
        within(marking).queryByText('Shorten the reference to 100 characters or fewer.'),
      ).toBeNull();
      fireEvent.click(within(marking).getByRole('button', { name: 'Mark paid' }));
      await settle();
      expect(rowOf('Balance').textContent).toContain('Paid £840.00 on Tue, Nov 3 · Marked by');
    },
  );

  it(
    'answers a payment marked or cancelled meanwhile with Close only, the row as it now stands',
    SLOW,
    async () => {
      await open(`${BLOOM}&state=already_paid`);
      let marking = dialog('Mark paid');
      expect(within(marking).getByRole('alert').textContent).toBe(
        'Julien Moreau has already marked this paid, so nothing has changed.',
      );
      expect(within(marking).queryByRole('button', { name: 'Cancel' })).toBeNull();
      expect(within(marking).queryByLabelText('Amount paid')).toBeNull();
      expect(rowOf('Balance').textContent).toBe(
        'BalancePaid £840.00 on Mon, Nov 2 · Marked by Julien Moreau',
      );
      fireEvent.click(within(marking).getByRole('button', { name: 'Close' }));
      expect(screen.queryByRole('dialog')).toBeNull();
      cleanup();

      await open(`${BLOOM}&state=already_cancelled`);
      marking = dialog('Mark paid');
      expect(within(marking).getByRole('alert').textContent).toBe(
        'This payment has been cancelled, so it cannot be marked paid.',
      );
      expect(rowOf('Balance').textContent).toContain('Cancelled · Not owed');
    },
  );

  it(
    'cancels the balance with a reason, keeps it on the schedule, and restores it',
    SLOW,
    async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      await open(`${BLOOM}&state=schedule`);
      fireEvent.click(within(rowOf('Balance')).getByRole('button', { name: 'Cancel payment' }));
      const cancel = dialog('Cancel payment');
      expect(
        within(cancel).getByText('Bloom & Co · Balance · £840.00 · Due Fri, Oct 30'),
      ).toBeDefined();
      expect(within(cancel).getByRole('button', { name: 'Keep it' })).toBeDefined();
      type(cancel, 'Why it is not owed', 'x'.repeat(201));
      fireEvent.click(within(cancel).getByRole('button', { name: 'Cancel payment' }));
      expect(
        within(cancel).getByText('Shorten the reason to 200 characters or fewer.'),
      ).toBeDefined();
      type(cancel, 'Why it is not owed', 'The venue supplies the arch flowers');
      fireEvent.click(within(cancel).getByRole('button', { name: 'Cancel payment' }));
      await settle();

      expect(rowOf('Balance').textContent).toBe(
        'BalanceCancelled · Not owed: the venue supplies the arch flowers · £840.00Restore',
      );
      expect(within(main()).getByRole('region', { name: 'Bloom & Co' }).textContent).toContain(
        '£840 of the quote is not scheduled yet.',
      );
      fireEvent.click(within(rowOf('Balance')).getByRole('button', { name: 'Restore' }));
      expect(rowOf('Balance').textContent).toContain('OverdueDue Fri, Oct 30£840.00Mark paid');
    },
  );

  it('adds a payment already made, paid in one action, and Undo deletes it', SLOW, async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    await open(`${BLOOM}&state=schedule`);
    fireEvent.click(
      within(section('Schedule')).getByRole('button', { name: 'Add a payment already made' }),
    );
    const made = dialog('Add a payment already made');
    expect((within(made).getByLabelText('Vendor') as HTMLSelectElement).value).toBe('v3');
    expect(within(made).getByText('Only vendors quoted on this event.')).toBeDefined();
    fireEvent.click(within(made).getByRole('button', { name: 'Add' }));
    expect(within(made).getByText('Enter what it was for.')).toBeDefined();
    type(made, 'What it was for', 'Buttonholes');
    type(made, 'Amount paid', '120.00');
    fireEvent.change(within(made).getByLabelText('Date paid'), { target: { value: '2026-11-02' } });
    fireEvent.click(within(made).getByRole('button', { name: 'Add' }));
    await settle();

    expect(rowOf('Buttonholes').textContent).toBe(
      'ButtonholesPaid £120.00 on Mon, Nov 2 · Marked by Folake AdeyemiUndo',
    );
    expect(within(main()).getByText('Marked paid: £120.00 on Monday, November 2.')).toBeDefined();
    fireEvent.click(within(rowOf('Buttonholes')).getByRole('button', { name: 'Undo' }));
    expect(within(section('Schedule')).queryByText('Buttonholes')).toBeNull();
  });

  it('refuses a payment already made dated before the vendor’s first quote', SLOW, async () => {
    await open(`${BLOOM}&state=made_early`);
    const made = dialog('Add a payment already made');
    const date = within(made).getByLabelText('Date paid');
    expect(date.getAttribute('aria-invalid')).toBe('true');
    expect(
      within(made).getByText(
        'A payment cannot be dated before the vendor’s first quote, Tue, Oct 6.',
      ),
    ).toBeDefined();
    fireEvent.change(date, { target: { value: '2026-10-06' } });
    expect(date.getAttribute('aria-invalid')).toBe('false');
  });

  it(
    'offers five shapes only while the vendor has no payments, and saves one as ordinary rows',
    SLOW,
    async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      await open(`${SAVOUR}&state=vendor`);
      fireEvent.click(within(main()).getByRole('button', { name: 'Add a payment' }));
      expect(within(dialog('Add a payment')).queryByRole('radiogroup')).toBeNull();
      expect(within(dialog('Add a payment')).queryByRole('radio')).toBeNull();
      cleanup();

      await open(`${SAVOUR}&state=add_payment`);
      const add = dialog('Add a payment');
      const group = within(add).getByRole('group', { name: 'How it is paid' });
      expect(
        within(group)
          .getAllByRole('radio')
          .map((one) => one.closest('label')?.textContent),
      ).toEqual([
        'Deposit and balance',
        'Three instalments',
        'In full before the event',
        'In full after the event',
        'Enter rows yourself',
      ]);
      fireEvent.click(within(group).getByRole('radio', { name: 'In full after the event' }));
      expect(within(add).getByText('100% · 7 days after the event · Sat, Nov 14')).toBeDefined();
      fireEvent.click(within(group).getByRole('radio', { name: 'Deposit and balance' }));
      expect(within(add).getByText('50% · on the date quoted · Tue, Oct 13')).toBeDefined();
      expect(within(add).getByText('50% · 14 days before the event · Thu, Oct 22')).toBeDefined();
      expect(
        within(add).getByText(
          'Each row is saved as an ordinary payment; change any of them after saving.',
        ),
      ).toBeDefined();
      fireEvent.click(within(add).getByRole('button', { name: 'Add' }));
      await settle();

      expect(screen.queryByRole('dialog')).toBeNull();
      expect(rowOf('Deposit').textContent).toContain('Due Tue, Oct 13£4,500.00');
      expect(rowOf('Balance').textContent).toContain('Due Thu, Oct 22£4,500.00');
      expect(
        within(section('Schedule')).getByText('The schedule matches the quote.'),
      ).toBeDefined();
    },
  );

  it(
    'says a shape set to the date quoted and short of the quote, and refuses a raced save',
    SLOW,
    async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      await open(`${SAVOUR}&state=shape_clamped`);
      let add = dialog('Add a payment');
      expect(
        within(add).getByText(
          '30% · 60 days before the event · Set to the date quoted, Tue, Oct 13',
        ),
      ).toBeDefined();
      expect(
        within(add).getByText(
          'The percentages come to 95%. The schedule is £450.00 short of the quote; it saves, and the vendor’s page says so.',
        ),
      ).toBeDefined();
      cleanup();

      await open(`${SAVOUR}&state=shape_raced`);
      add = dialog('Add a payment');
      const raced =
        'Payments were added to this vendor’s schedule while you were filling this in, so none of yours were saved. Check the payments it has now before adding more.';
      expect(within(add).getByRole('alert').textContent).toBe(raced);
      fireEvent.click(within(add).getByRole('button', { name: 'Add' }));
      await settle();
      expect(within(dialog('Add a payment')).getByRole('alert').textContent).toBe(raced);
      fireEvent.click(within(dialog('Add a payment')).getByRole('button', { name: 'Cancel' }));
      await settle(300);
      const rows = within(section('Schedule'))
        .getAllByRole('listitem')
        .filter((one) => one.hasAttribute('data-payment'));
      expect(rows.map((one) => one.textContent?.split('Due')[0])).toEqual([
        'Deposit',
        'Second instalment',
      ]);
    },
  );

  it(
    'refuses a shape row at its field, then saves every row or none, and sends all again',
    SLOW,
    async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      await open(`${SAVOUR}&state=shape_refused`);
      let add = dialog('Add a payment');
      const what = within(add).getAllByRole('textbox', { name: 'What the payment is for' });
      expect(what.map((one) => one.getAttribute('aria-invalid'))).toEqual([
        'true',
        'true',
        'false',
      ]);
      expect(within(add).getByText('Enter what the payment is for.')).toBeDefined();
      expect(
        within(add).getByText('Shorten what the payment is for to 100 characters or fewer.'),
      ).toBeDefined();
      expect(
        within(add).getByText('Enter a percentage from 0 to 100, with up to two decimals.'),
      ).toBeDefined();
      expect(within(add).getByText('Enter a whole number of days from 0 to 730.')).toBeDefined();
      fireEvent.click(within(add).getByRole('button', { name: 'Add' }));
      await settle();
      expect(dialog('Add a payment')).toBeDefined();
      expect(document.activeElement).toBe(what[0]);

      fireEvent.change(what[0]!, { target: { value: 'Deposit' } });
      expect(within(add).queryByText('Enter what the payment is for.')).toBeNull();
      fireEvent.change(what[1]!, { target: { value: 'Second instalment' } });
      const share = within(add).getAllByRole('textbox', { name: 'Percentage of the quote' });
      fireEvent.change(share[1]!, { target: { value: '30' } });
      const before = within(add).getAllByRole('textbox', { name: 'Days before the event' });
      fireEvent.change(before[1]!, { target: { value: '14' } });
      expect(add.querySelector('[aria-invalid="true"]')).toBeNull();
      fireEvent.click(within(add).getByRole('button', { name: 'Add' }));
      await settle();
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(rowOf('Second instalment').textContent).toContain('£2,700.00');
      cleanup();

      await open(`${SAVOUR}&state=shape_failed`);
      add = dialog('Add a payment');
      expect(within(add).getByRole('alert').textContent).toBe(
        'None of these payments were saved, because they could not be sent. The rows are as you filled them; press Add to send all of them again.',
      );
      expect(
        within(section('Schedule'))
          .queryAllByRole('listitem')
          .filter((one) => one.hasAttribute('data-payment')),
      ).toEqual([]);
      fireEvent.click(within(add).getByRole('button', { name: 'Add' }));
      await settle();
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(
        within(section('Schedule'))
          .getAllByRole('listitem')
          .filter((one) => one.hasAttribute('data-payment')),
      ).toHaveLength(3);
      for (const [what, amount] of [
        ['Deposit', '£4,500.00'],
        ['Second instalment', '£2,700.00'],
        ['Balance', '£1,800.00'],
      ])
        expect(rowOf(what!).textContent).toContain(amount);
    },
  );

  it(
    'shows the reminder setting in Settings with Vendors lit, and changes the days',
    SLOW,
    async () => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
      await open(`${REMINDERS}?state=reminders`);
      expect(screen.getByRole('heading', { level: 1, name: 'Payment reminders' })).toBeDefined();
      expect(
        within(screen.getByRole('navigation', { name: 'Settings' }))
          .getByRole('link', { name: 'Vendors' })
          .getAttribute('aria-current'),
      ).toBe('page');
      expect(
        within(main()).getByText(
          '3 days before a payment is due, and once the day after, then silence.',
        ),
      ).toBeDefined();
      expect(
        within(main()).getByText('The organisation’s owners and admins, and each event’s lead.'),
      ).toBeDefined();
      expect(within(main()).getByRole('link', { name: /^How/ }).getAttribute('href')).toBe(
        '/demo/settings/notifications',
      );

      fireEvent.click(within(main()).getByRole('button', { name: 'Change' }));
      const change = dialog('Payment reminders');
      const days = within(change).getByLabelText(
        'Days before a payment is due',
      ) as HTMLInputElement;
      expect(days.value).toBe('3');
      expect(
        within(change).getByText('From 1 to 30. A change applies to reminders not yet sent.'),
      ).toBeDefined();
      fireEvent.change(days, { target: { value: '31' } });
      fireEvent.click(within(change).getByRole('button', { name: 'Save' }));
      expect(within(change).getByText('Enter a whole number of days from 1 to 30.')).toBeDefined();
      fireEvent.change(days, { target: { value: '5' } });
      fireEvent.click(within(change).getByRole('button', { name: 'Save' }));
      await settle();
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(
        within(main()).getByText(
          '5 days before a payment is due, and once the day after, then silence.',
        ),
      ).toBeDefined();
    },
  );

  it('opens the refused change, and refuses a Member as Vendors does', SLOW, async () => {
    await open(`${REMINDERS}?state=reminders_bad`);
    const days = within(dialog('Payment reminders')).getByLabelText('Days before a payment is due');
    expect((days as HTMLInputElement).value).toBe('31');
    expect(days.getAttribute('aria-invalid')).toBe('true');
    cleanup();

    await open(`${REMINDERS}?as=ana&state=reminders`);
    expect(within(main()).getByRole('alert')).toBeDefined();
    expect(within(main()).queryByText('Payment reminders')).toBeNull();
    expect(within(main()).getByRole('link', { name: 'Back to Settings' })).toBeDefined();
  });

  it('opens every state the demo’s home lists', SLOW, async () => {
    for (const link of PAYMENTS_PAGES.flatMap((page) => page.states)) {
      await open(link.to);
      expect(screen.getByRole('heading', { level: 1 }).textContent).not.toBe('');
      cleanup();
    }
  });
});

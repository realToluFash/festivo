import { describe, expect, it } from 'vitest';

import { TODAY, longDay, money, whole } from './budget.ts';
import {
  BLANK_QUOTE,
  QUOTES_PAGES,
  QUOTES_STATES,
  REVISE_UNCHANGED,
  amountProblem,
  differenceLine,
  differenceShort,
  draftOfQuote,
  draftToMark,
  everythingDue,
  firstOverdue,
  markProblems,
  markedPaid,
  nextPaymentId,
  offered,
  owedBy,
  pageVendor,
  parsedAmount,
  paymentProblems,
  quoteProblems,
  quotesStart,
  sampleBudget,
  usedOn,
} from './quotes.ts';
import { sampleVendors } from './vendors.ts';

const SPEC_NAMES = [
  'no_quotes',
  'vendor',
  'no_payments',
  'earlier',
  'lead',
  'read_only',
  'add',
  'vendor_typed',
  'vendor_none',
  'no_vendors',
  'add_filled',
  'add_blank',
  'invalid_amount',
  'future_date',
  'second_quote',
  'vendor_gone',
  'revise',
  'revise_unchanged',
  'correct',
  'add_payment',
  'payment_refused',
  'amend',
  'remove',
];

const linked = QUOTES_PAGES.flatMap((page) => page.states).map(
  (link) => new URLSearchParams(link.to.split('?')[1]),
);

describe('quotes and payment schedules’ rules on the wedding (sc-87)', () => {
  it('reads the four vendors quoted from the directory by id', () => {
    const budget = sampleBudget();
    expect(budget.quotes.map((one) => `${one.vendor.id} ${one.vendor.name}`)).toEqual([
      'v4 Savour Kitchen',
      'v5 The Landmark',
      'v6 Lens & Light',
      'v3 Bloom & Co',
    ]);
    expect(budget.quotes[0]?.vendor).toMatchObject({
      category: 'Catering',
      contact: 'Kofi Mensah',
    });
    expect(budget.quotes[0]?.earlier).toEqual([
      { amount: 840000, quotedOn: '2026-09-21', number: 'SK-0398' },
    ]);
  });

  it('takes a new payment’s id past the highest in use, not from the count', () => {
    const payments = sampleBudget().payments.filter((one) => one.id !== 'p2');
    expect(nextPaymentId(payments)).toBe('p9');
    expect(nextPaymentId([])).toBe('p1');
  });

  it('counts the directory’s events from the wedding, and the other events by hand', () => {
    const budget = sampleBudget();
    expect(['v1', 'v2', 'v3', 'v4', 'v6', 'v7'].map((id) => usedOn(id, budget))).toEqual([
      'Used on 1 event',
      null,
      'Used on 2 events',
      'Used on 4 events',
      'Used on 3 events',
      'Used on 1 event',
    ]);
    expect(owedBy('v3', budget).map((one) => one.name)).toEqual([
      'Adaeze & Tunde’s wedding',
      'Ireti at 40',
    ]);

    const balance = budget.payments.find((one) => one.id === 'p6')!;
    const paid = {
      ...budget,
      payments: budget.payments.map((one) =>
        one.id === 'p6' ? markedPaid(one, draftToMark(balance), 'Folake Adeyemi') : one,
      ),
    };
    expect(owedBy('v3', paid).map((one) => one.name)).toEqual(['Ireti at 40']);

    const unquoted = { ...budget, quotes: budget.quotes.filter((one) => one.vendor.id !== 'v4') };
    expect(usedOn('v4', unquoted)).toBe('Used on 3 events');
  });

  it('words the difference as en settled it: the minor unit in rows, whole on the card', () => {
    expect(differenceLine(900_000, 750_000, money)).toBe(
      '£1,500.00 of the quote is not scheduled yet.',
    );
    expect(differenceLine(900_000, 750_000, whole)).toBe(
      '£1,500 of the quote is not scheduled yet.',
    );
    expect(differenceLine(120_000, 145_000, money)).toBe('The schedule is £250.00 over the quote.');
    expect(differenceLine(120_000, 120_000, money)).toBe('The schedule matches the quote.');
    expect(differenceShort(900_000, 750_000, money)).toBe('£1,500.00 not scheduled');
    expect(differenceShort(120_000, 120_000, money)).toBe('Matches the quote');
  });

  it('reads an amount at the currency’s minor unit, and refuses one more decimal or zero', () => {
    expect(parsedAmount('1,250.50')).toBe(125_050);
    expect(parsedAmount('1250')).toBe(125_000);
    expect(parsedAmount('1,250.505')).toBeNull();
    expect(parsedAmount('0')).toBeNull();
    expect(parsedAmount('£12')).toBeNull();
    expect(parsedAmount('3500', 'JPY')).toBe(3500);
    expect(parsedAmount('3500.5', 'JPY')).toBeNull();
    expect(amountProblem()).toBe('Enter the amount as a number above 0, like 3,500.50.');
    expect(amountProblem('JPY')).toBe('Enter the amount as a number above 0, like 3,500.');
  });

  it('offers vendors not archived, A to Z, narrowing as typed with accents as typed', () => {
    const vendors = sampleVendors();
    expect(offered(vendors, '').some((one) => one.archivedOn != null)).toBe(false);
    expect(offered(vendors, '')[0]?.name).toBe('Àbẹ̀ní Flowers');
    expect(offered(vendors, 'be').map((one) => one.name)).toContain('Beat Collective');
    expect(offered(vendors, 'eclat')).toEqual([]);
  });

  it('checks the quote form before it sends, in en’s words', () => {
    expect(quoteProblems(BLANK_QUOTE, 'add', TODAY)).toEqual({
      vendor: 'Choose the vendor.',
      covers: 'Enter what the quote covers.',
      amount: amountProblem(),
      quotedOn: 'Enter the date quoted.',
    });
    const ahead = {
      ...BLANK_QUOTE,
      vendorId: 'v2',
      covers: 'DJ',
      amount: '10',
      quotedOn: '2026-11-12',
    };
    expect(quoteProblems(ahead, 'add', TODAY).quotedOn).toBe(
      'The date quoted cannot be in the future. Choose today or an earlier date.',
    );
    const long = { ...ahead, quotedOn: TODAY, covers: 'x'.repeat(501), number: 'n'.repeat(65) };
    expect(quoteProblems(long, 'add', TODAY)).toEqual({
      covers: 'Shorten what the quote covers to 500 characters or fewer.',
      number: 'Shorten the quote number to 64 characters or fewer.',
    });
  });

  it('refuses a revise that changes neither the amount nor the date, on both fields', () => {
    const savour = sampleBudget().quotes[0]!;
    expect(quoteProblems(draftOfQuote(savour), 'revise', TODAY, savour)).toEqual({
      amount: REVISE_UNCHANGED,
      quotedOn: REVISE_UNCHANGED,
    });
    expect(
      quoteProblems({ ...draftOfQuote(savour), amount: '9,400.00' }, 'revise', TODAY, savour),
    ).toEqual({});
    expect(quoteProblems(draftOfQuote(savour), 'correct', TODAY, savour)).toEqual({});
  });

  it('refuses a payment due before the date quoted, naming the vendor and the date', () => {
    const savour = sampleBudget().quotes[0]!;
    expect(
      paymentProblems(
        { what: 'Deposit', amount: '1,000.00', dueOn: '2026-10-12' },
        savour,
        longDay,
      ),
    ).toEqual({
      dueOn:
        'The date due cannot be before the quote from Savour Kitchen on Tuesday, October 13. Choose that date or a later one.',
    });
    expect(paymentProblems({ what: '', amount: '', dueOn: '' }, savour, longDay)).toEqual({
      what: 'Enter what the payment is for.',
      amount: amountProblem(),
      dueOn: 'Enter the date due.',
    });
  });

  it('lists everything owed soonest first, then by vendor name; only before today is Overdue', () => {
    const budget = sampleBudget();
    const lens = { ...budget.payments[3]!, id: 'p9', dueOn: '2026-11-09' };
    const due = everythingDue({ ...budget, payments: [...budget.payments, lens] });
    expect(due.map((one) => `${one.payment.dueOn} ${one.vendor.name} ${one.payment.what}`)).toEqual(
      [
        '2026-10-30 Bloom & Co Balance',
        '2026-11-04 Savour Kitchen Deposit',
        '2026-11-05 The Landmark Balance',
        '2026-11-09 Lens & Light Balance',
        '2026-11-09 Savour Kitchen Second instalment',
        '2026-11-30 Lens & Light Balance',
      ],
    );
    expect(due.filter((one) => one.overdue).map((one) => one.vendor.name)).toEqual(['Bloom & Co']);
    expect(firstOverdue(budget, 'v3')?.id).toBe('p6');
    expect(firstOverdue(budget, 'v4')).toBeNull();
  });

  it('marks paid with the amount scheduled and today, and refuses an amount of 0', () => {
    const balance = sampleBudget().payments.find((one) => one.id === 'p6')!;
    const draft = draftToMark(balance);
    expect(draft).toEqual({ amount: '840.00', paidOn: TODAY, reference: '' });
    expect(markProblems({ ...draft, amount: '0' }, balance)).toEqual({
      amount: 'Enter the amount paid, above 0, like 840.00.',
    });
    expect(markedPaid(balance, draft, 'Julien Moreau').paid).toEqual({
      amount: 84000,
      on: TODAY,
      by: 'Julien Moreau',
      reference: '',
    });
  });

  it('opens every listed state, and lists every name the spec gives', () => {
    for (const query of linked) {
      const state = query.get('state') ?? '';
      expect(() =>
        quotesStart(state, pageVendor(state, query.get('vendor')), longDay),
      ).not.toThrow();
    }
    const listed = new Set(linked.map((query) => query.get('state')));
    expect(SPEC_NAMES.filter((name) => !listed.has(name))).toEqual([]);
    expect(QUOTES_STATES.filter((name) => !listed.has(name))).toEqual([]);
  });

  it('starts each state on the sample it names', () => {
    const at = (state: string) => quotesStart(state, pageVendor(state, null), longDay);
    expect(pageVendor('amend', null)).toBe('v4');
    expect(pageVendor('add', null)).toBeNull();
    expect(at('no_quotes').budget.quotes).toEqual([]);
    expect(everythingDue(at('nothing_due').budget)).toEqual([]);
    expect(at('no_payments').budget.payments.some((one) => one.vendorId === 'v4')).toBe(false);
    expect(at('amend').amending).toMatchObject({ id: 'p8', draft: { amount: '3,500.00' } });
    expect(at('remove').removing).toBe('p8');
    expect(at('vendor_typed').quote?.draft.typed).toBe('be');
    expect(Object.keys(at('add_blank').quote?.problems ?? {})).toHaveLength(4);
    expect(at('payment_refused').payment?.problems).toMatchObject({
      what: 'Enter what the payment is for.',
    });
    expect(at('no_vendors').vendors.every((one) => one.archivedOn != null)).toBe(true);
    expect(at('line_taken').quote?.refusal).toBe('line_taken');
  });
});

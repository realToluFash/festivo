import { describe, expect, it } from 'vitest';

import {
  BLANK_QUOTE,
  QUOTES_PAGES,
  REVISE_UNCHANGED,
  TODAY,
  amountProblem,
  budgetStart,
  differenceLine,
  draftOfQuote,
  everythingDue,
  offered,
  parsedAmount,
  paymentProblems,
  quoteProblems,
  sampleBudget,
} from './quotes.ts';
import { sampleVendors } from './vendors.ts';

const day = (iso: string) => iso;

describe('quotes and payment schedules’ rules (sc-87)', () => {
  it('words the difference as en settled it, in the event’s currency', () => {
    expect(differenceLine(100_000, 40_000, 'en')).toBe(
      '€600.00 of the quote is not scheduled yet.',
    );
    expect(differenceLine(100_000, 125_000, 'en')).toBe('The schedule is €250.00 over the quote.');
    expect(differenceLine(100_000, 100_000, 'en')).toBe('The schedule matches the quote.');
  });

  it('reads an amount at the currency’s minor unit, and refuses one more decimal or zero', () => {
    expect(parsedAmount('1,450.50', 'EUR')).toBe(145_050);
    expect(parsedAmount('1450', 'EUR')).toBe(145_000);
    expect(parsedAmount('1,450.505', 'EUR')).toBeNull();
    expect(parsedAmount('0', 'EUR')).toBeNull();
    expect(parsedAmount('€12', 'EUR')).toBeNull();
    expect(parsedAmount('3500', 'JPY')).toBe(3500);
    expect(parsedAmount('3500.5', 'JPY')).toBeNull();
    expect(amountProblem('EUR')).toBe('Enter the amount as a number above 0, like 3,500.50.');
    expect(amountProblem('JPY')).toBe('Enter the amount as a number above 0, like 3,500.');
  });

  it('offers vendors not archived, A to Z, narrowing as typed with accents as typed', () => {
    const vendors = sampleVendors();
    expect(offered(vendors, '').some((one) => one.archivedOn != null)).toBe(false);
    expect(offered(vendors, 'bl').map((one) => one.name)).toEqual([
      'Bloom & Co',
      'Blue Gate Transport',
    ]);
    expect(offered(vendors, 'eclat')).toEqual([]);
    expect(offered(vendors, 'Éclat').map((one) => one.name)).toEqual(['Éclat Catering']);
  });

  it('checks the quote form before it sends', () => {
    expect(quoteProblems(BLANK_QUOTE, 'add', TODAY)).toEqual({
      vendor: 'Choose the vendor.',
      covers: 'Enter what the quote covers.',
      amount: amountProblem('EUR'),
      quotedOn: 'Enter the date quoted.',
    });
    const future = {
      ...BLANK_QUOTE,
      vendorId: 'v13',
      covers: 'Shuttles',
      amount: '10',
      quotedOn: '2026-11-04',
    };
    expect(quoteProblems(future, 'add', TODAY).quotedOn).toBe(
      'The date quoted cannot be in the future. Choose today or an earlier date.',
    );
    const long = { ...future, quotedOn: TODAY, covers: 'x'.repeat(501), number: 'n'.repeat(65) };
    expect(quoteProblems(long, 'add', TODAY)).toEqual({
      covers: 'Shorten what the quote covers to 500 characters or fewer.',
      number: 'Shorten the quote number to 64 characters or fewer.',
    });
  });

  it('refuses a revise that changes neither the amount nor the date, on both fields', () => {
    const quote = sampleBudget().quotes[0]!;
    expect(quoteProblems(draftOfQuote(quote), 'revise', TODAY, quote)).toEqual({
      amount: REVISE_UNCHANGED,
      quotedOn: REVISE_UNCHANGED,
    });
    expect(
      quoteProblems({ ...draftOfQuote(quote), amount: '18,000.00' }, 'revise', TODAY, quote),
    ).toEqual({});
    expect(quoteProblems(draftOfQuote(quote), 'correct', TODAY, quote)).toEqual({});
  });

  it('refuses a payment due before the date quoted, naming the vendor and the date', () => {
    const bloom = sampleBudget().quotes.find((one) => one.vendor.name === 'Bloom & Co')!;
    expect(
      paymentProblems({ description: 'Balance', amount: '600', dueOn: '2026-10-01' }, bloom, day),
    ).toEqual({
      dueOn:
        'The date due cannot be before the quote from Bloom & Co on 2026-10-20. Choose that date or a later one.',
    });
    expect(paymentProblems({ description: '', amount: '', dueOn: '' }, bloom, day)).toEqual({
      description: 'Enter what the payment is for.',
      amount: amountProblem('EUR'),
      dueOn: 'Enter the date due.',
    });
  });

  it('lists everything due soonest first, then by vendor name, and only before today is Overdue', () => {
    const budget = sampleBudget();
    const due = everythingDue(
      {
        ...budget,
        payments: [
          ...budget.payments,
          { id: 'px', vendorId: 'v4', description: 'Balance', amount: 60_000, dueOn: '2026-11-14' },
        ],
      },
      TODAY,
    );
    expect(due.map((one) => `${one.payment.dueOn} ${one.vendor.name}`)).toEqual([
      '2026-10-15 Éclat Catering',
      '2026-10-28 Bloom & Co',
      '2026-11-03 Fola Strings',
      '2026-11-06 Éclat Catering',
      '2026-11-14 Bloom & Co',
      '2026-11-14 Éclat Catering',
      '2026-11-14 Fola Strings',
    ]);
    expect(due.filter((one) => one.overdue).map((one) => one.payment.dueOn)).toEqual([
      '2026-10-15',
      '2026-10-28',
    ]);
  });

  it('opens every listed state', () => {
    for (const page of QUOTES_PAGES)
      for (const link of page.states) {
        const query = new URLSearchParams(link.to.split('?')[1]);
        expect(() => budgetStart(query.get('state') ?? '', query.get('vendor'), day)).not.toThrow();
      }
    expect(budgetStart('no_quotes', null, day).budget.quotes).toEqual([]);
    expect(
      budgetStart('no_vendors', null, day).vendors.every((one) => one.archivedOn != null),
    ).toBe(true);
  });
});

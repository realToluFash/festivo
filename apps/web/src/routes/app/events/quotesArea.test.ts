import {
  type BudgetLine,
  type DuePayment,
  type EventQuote,
  type OfferedVendor,
} from '@soirely/api-client';
import i18next from 'i18next';
import { describe, expect, it } from 'vitest';

import '../../../i18n/index.ts';
import {
  agreedElsewhere,
  budgetView,
  cancelledLine,
  cardDifference,
  cardGap,
  differenceLine,
  differenceOf,
  differenceShort,
  draftOfQuote,
  dueInOrder,
  firstOverdue,
  firstQuoteOn,
  keptOf,
  madeProblems,
  markProblems,
  paidDifference,
  paidLine,
  reasonProblem,
  lineLine,
  linesWords,
  offered,
  paymentProblems,
  quoteProblems,
  quoteRefusedAt,
  paymentRefusedAt,
  scheduleOf,
  sentAmount,
  todayIn,
  vendorLine,
  vendorPagePath,
} from './quotesArea.ts';

const t = i18next.getFixedT('en');
const EN = 'en-GB';
const AT = { language: 'en' as const, currency: 'GBP', today: '2026-11-19' };

function quote(fields: Partial<EventQuote> = {}): EventQuote {
  return {
    id: 'q1',
    vendor: {
      id: 'v1',
      name: 'Bloom & Co',
      category: 'flowers',
      contactName: 'Ngozi Eze',
      archived: false,
    },
    quote: {
      id: 'qv1',
      covers: 'Table flowers',
      amount: '1200.00',
      currency: 'GBP',
      quotedOn: '2026-10-01',
      reference: null,
      supersededAt: null,
    },
    earlier: [],
    lines: [],
    payments: [],
    scheduled: '1200.00',
    difference: '0.00',
    ...fields,
  } as EventQuote;
}

function due(fields: Partial<DuePayment>): DuePayment {
  return {
    id: 'p',
    quoteId: 'q1',
    vendor: 'Bloom & Co',
    description: 'Deposit',
    amount: '100.00',
    dueOn: '2026-12-01',
    overdue: false,
    ...fields,
  };
}

function line(fields: Partial<BudgetLine> = {}): BudgetLine {
  return {
    id: 'flowers',
    label: 'Flowers',
    category: 'flowers',
    basis: 'fixed',
    rate: null,
    amount: '900.00',
    currency: 'GBP',
    note: null,
    quantity: { count: 1, source: 'fixed', reason: null },
    cost: { confirmed: '900.00', potential: '900.00' },
    ...fields,
  } as BudgetLine;
}

describe('the difference between the schedule and the quote', () => {
  it('matches, falls short or goes over by the sign of the API’s difference', () => {
    expect(differenceOf(quote())).toBe('matches');
    expect(differenceOf(quote({ difference: '-200.00' }))).toBe('short');
    expect(differenceOf(quote({ difference: '50.00' }))).toBe('over');
  });

  it('says the gap in the currency’s minor unit', () => {
    expect(differenceLine(t, quote(), 'GBP', EN)).toBe('The schedule matches the quote.');
    expect(differenceLine(t, quote({ difference: '-200.50' }), 'GBP', EN)).toBe(
      '£200.50 of the quote is not scheduled yet.',
    );
    expect(differenceShort(t, quote({ difference: '50.00' }), 'GBP', EN)).toBe(
      '£50.00 over the quote',
    );
  });

  it('rounds the card’s gap to whole units, but never a gap under one unit to 0', () => {
    expect(cardGap('200.50', 'GBP', EN)).toBe('£201');
    expect(cardGap('0.40', 'GBP', EN)).toBe('£0.40');
    expect(cardDifference(t, quote({ difference: '-0.40' }), 'GBP', EN)).toBe(
      '£0.40 of the quote is not scheduled yet.',
    );
  });
});

describe('payments in order', () => {
  it('lists everything due soonest first, then by vendor', () => {
    const list = dueInOrder(
      [
        due({ id: 'c', dueOn: '2026-12-05', vendor: 'Alder' }),
        due({ id: 'b', dueOn: '2026-12-01', vendor: 'Zest' }),
        due({ id: 'a', dueOn: '2026-12-01', vendor: 'Alder' }),
      ],
      EN,
    );

    expect(list.map((one) => one.id)).toEqual(['a', 'b', 'c']);
  });

  it('orders a schedule by its due dates and finds the first overdue payment', () => {
    const owed = { addedAsPaid: false, paid: null, cancelled: null };
    const payments = [
      {
        id: 'late',
        description: 'Balance',
        amount: '1.00',
        dueOn: '2026-11-10',
        overdue: true,
        ...owed,
      },
      {
        id: 'early',
        description: 'Deposit',
        amount: '1.00',
        dueOn: '2026-10-10',
        overdue: true,
        ...owed,
      },
      {
        id: 'next',
        description: 'Final',
        amount: '1.00',
        dueOn: '2026-12-10',
        overdue: false,
        ...owed,
      },
    ];

    expect(scheduleOf(quote({ payments })).map((one) => one.id)).toEqual(['early', 'late', 'next']);
    expect(firstOverdue(quote({ payments }))?.id).toBe('early');
    expect(firstOverdue(quote())).toBeNull();
  });
});

describe('the words beside a vendor', () => {
  it('puts the contact after the category, or the category alone', () => {
    expect(vendorLine(t, quote())).toBe('Flowers · Ngozi Eze');
    expect(vendorLine(t, quote({ vendor: { ...quote().vendor, contactName: null } }))).toBe(
      'Flowers',
    );
  });

  it('joins the budget lines a quote agrees, or says none', () => {
    expect(linesWords(t, quote(), 'en')).toBe('None');
    expect(
      linesWords(
        t,
        quote({
          lines: [
            { id: 'a', label: 'Table flowers' },
            { id: 'b', label: 'Bouquets' },
          ],
        }),
        'en',
      ),
    ).toBe('Table flowers and Bouquets');
  });
});

describe('the vendor field', () => {
  const vendors: OfferedVendor[] = [
    {
      id: 'a',
      name: 'Bloom & Co',
      category: 'flowers',
      contactName: null,
      archived: false,
      quoted: true,
    },
    {
      id: 'b',
      name: 'Bluebell Catering',
      category: 'catering',
      contactName: null,
      archived: false,
      quoted: false,
    },
    {
      id: 'c',
      name: 'Old Blooms',
      category: 'flowers',
      contactName: null,
      archived: true,
      quoted: false,
    },
  ];

  it('offers the vendors not archived whose name holds what was typed, quoted ones included', () => {
    expect(offered(vendors, '', EN).map((one) => one.id)).toEqual(['a', 'b']);
    expect(offered(vendors, ' BLOOM ', EN).map((one) => one.id)).toEqual(['a']);
  });
});

describe('budget lines in the quote form', () => {
  it('names the vendor whose other quote already agrees a line', () => {
    const quotes = [quote({ lines: [{ id: 'flowers', label: 'Flowers' }] })];

    expect(agreedElsewhere(quotes, 'flowers', null)).toBe('Bloom & Co');
    expect(agreedElsewhere(quotes, 'flowers', 'q1')).toBeNull();
    expect(lineLine(t, line(), 'Bloom & Co', EN)).toBe('Agreed in the quote from Bloom & Co');
  });

  it('says a line’s price and category, or that it is not priced', () => {
    expect(lineLine(t, line(), null, EN)).toBe('£900.00 · Flowers');
    expect(
      lineLine(
        t,
        line({ amount: '0.00', cost: { confirmed: '0.00', potential: '0.00' } }),
        null,
        EN,
      ),
    ).toBe('Not priced · Flowers');
  });
});

describe('the quote form’s checks', () => {
  it('takes an amount above 0 in the currency’s minor unit', () => {
    expect(sentAmount('1,200.5', 'en', 'GBP')).toBe('1200.50');
    expect(sentAmount('0', 'en', 'GBP')).toBeNull();
    expect(sentAmount('ten', 'en', 'GBP')).toBeNull();
  });

  it('asks for every field Add needs', () => {
    const problems = quoteProblems(
      t,
      {
        vendorId: '',
        typed: '',
        covers: ' ',
        amount: '',
        quotedOn: '',
        reference: '',
        lineIds: [],
      },
      'add',
      AT,
    );

    expect(Object.keys(problems).sort()).toEqual(['amount', 'covers', 'quotedOn', 'vendor']);
    expect(problems.amount).toBe('Enter the amount as a number above 0, like 3,500.50.');
  });

  it('refuses a date quoted in the future', () => {
    const draft = { ...draftOfQuote(quote(), 'en', 'GBP'), quotedOn: '2026-11-20' };

    expect(quoteProblems(t, draft, 'revise', AT, quote()).quotedOn).toBe(
      'The date quoted cannot be in the future. Choose today or an earlier date.',
    );
  });

  it('refuses a revision that changes neither the amount nor the date', () => {
    const draft = draftOfQuote(quote(), 'en', 'GBP');
    const problems = quoteProblems(t, draft, 'revise', AT, quote());

    expect(problems.amount).toBe(problems.quotedOn);
    expect(problems.amount).toContain('Change the amount or the date quoted');
    expect(quoteProblems(t, { ...draft, amount: '1,250' }, 'revise', AT, quote())).toEqual({});
  });

  it('checks only the wording when correcting', () => {
    const draft = { ...draftOfQuote(quote(), 'en', 'GBP'), amount: '', reference: 'x'.repeat(65) };

    expect(Object.keys(quoteProblems(t, draft, 'correct', AT, quote()))).toEqual(['reference']);
  });
});

describe('the payment form’s checks', () => {
  it('refuses a date due before the quote', () => {
    const problems = paymentProblems(
      t,
      { description: 'Deposit', amount: '100', dueOn: '2026-09-30' },
      quote(),
      AT,
      EN,
    );

    expect(problems).toEqual({
      dueOn:
        'The date due cannot be before the quote from Bloom & Co on Thursday 1 October. Choose that date or a later one.',
    });
  });

  it('keeps only the problems already shown, as they now stand', () => {
    expect(keptOf({ amount: 'old' }, { amount: 'new', dueOn: 'unseen' })).toEqual({
      amount: 'new',
    });
  });
});

describe('the API’s refusals', () => {
  it('puts each violation beside its field, and one with no field at the top', () => {
    expect(
      quoteRefusedAt({ vendorId: 'Gone', lineIds: 'Agreed elsewhere', currency: 'Wrong' }),
    ).toEqual({ fields: { vendor: 'Gone', amount: 'Wrong' }, top: 'Agreed elsewhere' });
    expect(paymentRefusedAt({ dueOn: 'Too early' })).toEqual({
      fields: { dueOn: 'Too early' },
      top: null,
    });
  });
});

describe('Budget’s pages', () => {
  it('reads the page from the path under budget/', () => {
    expect(budgetView('')).toEqual({ kind: 'home' });
    expect(budgetView('due')).toEqual({ kind: 'due' });
    expect(budgetView('vendors/v1')).toEqual({ kind: 'vendor', vendorId: 'v1' });
    expect(budgetView('vendors')).toEqual({ kind: 'unknown' });
    expect(budgetView('due/more')).toEqual({ kind: 'unknown' });
  });

  it('builds a vendor’s page path', () => {
    expect(vendorPagePath('e 1', 'v/1')).toBe('/app/events/e%201/budget/vendors/v%2F1');
  });

  it('reads today in the event’s time zone', () => {
    const late = new Date('2026-11-19T23:30:00Z');

    expect(todayIn('Europe/London', late)).toBe('2026-11-19');
    expect(todayIn('Asia/Tokyo', late)).toBe('2026-11-20');
  });
});

describe('marking paid', () => {
  const scheduled = {
    id: 'p1',
    description: 'Deposit',
    amount: '3200.00',
    dueOn: '2026-11-01',
    overdue: false,
    addedAsPaid: false,
    paid: null,
    cancelled: null,
  };
  const marked = (amount: string, by: { id: string; name: string } | null) => ({
    ...scheduled,
    paid: { amount, paidOn: '2026-11-09', reference: null, at: '', by, difference: '0' },
  });

  it('refuses a blank or zero amount, a day ahead and a reference over 100', () => {
    const problems = markProblems(
      t,
      { amount: '0', paidOn: '2026-11-20', reference: 'r'.repeat(101) },
      AT,
    );

    expect(Object.keys(problems)).toEqual(['amount', 'paidOn', 'reference']);
    expect(problems.paidOn).toBe(
      'The date paid cannot be in the future. Choose today or an earlier date.',
    );
    expect(problems.reference).toBe('Shorten the reference to 100 characters or fewer.');
    expect(
      markProblems(t, { amount: '3,200.50', paidOn: '2026-11-19', reference: '' }, AT),
    ).toEqual({});
  });

  it('says by how much the amount paid differs, or nothing when it matches', () => {
    expect(paidDifference(t, '3200.00', '3200.00', 'GBP', EN)).toBeNull();
    expect(paidDifference(t, '3200.00', '3250.50', 'GBP', EN)).toBe('£50.50 more than scheduled');
    expect(paidDifference(t, '3200.00', '3000.00', 'GBP', EN)).toBe('£200.00 less than scheduled');
  });

  it('names who marked it, and leaves the name out once they have gone', () => {
    expect(paidLine(t, marked('3200.00', { id: 'u1', name: 'Ada Obi' }), 'GBP', EN)).toBe(
      'Paid £3,200.00 on Mon 9 Nov · Marked by Ada Obi',
    );
    expect(paidLine(t, marked('3000.00', null), 'GBP', EN)).toBe(
      'Paid £3,000.00 on Mon 9 Nov · £200.00 less than scheduled',
    );
  });

  it('keeps a cancelled payment with its reason, which may be over 200 only before sending', () => {
    expect(reasonProblem(t, 'w'.repeat(200))).toBeNull();
    expect(reasonProblem(t, 'w'.repeat(201))).toBe(
      'Shorten the reason to 200 characters or fewer.',
    );
    const cancelled = {
      ...scheduled,
      cancelled: { at: '', by: null, reason: 'Venue includes it' },
    };
    expect(cancelledLine(t, cancelled, 'GBP', EN)).toBe(
      'Cancelled · Not owed: Venue includes it · £3,200.00',
    );
  });

  it('dates a payment already made no earlier than the first quote, before any revision', () => {
    const revised = quote({
      quote: { ...quote().quote, quotedOn: '2026-10-20' },
      earlier: [{ ...quote().quote, id: 'qv0', quotedOn: '2026-10-01' }],
    });
    const draft = {
      quoteId: 'q1',
      description: '  ',
      amount: '180',
      paidOn: '2026-09-30',
      reference: '',
    };

    expect(firstQuoteOn(revised)).toBe('2026-10-01');
    const problems = madeProblems(t, draft, revised, AT, EN);
    expect(problems.description).toBe('Enter what it was for.');
    expect(problems.paidOn).toBe(
      'The date paid cannot be before the quote from Bloom & Co on Thursday 1 October. Choose that date or a later one.',
    );
    expect(
      madeProblems(t, { ...draft, description: 'Stems', paidOn: '2026-10-01' }, revised, AT, EN),
    ).toEqual({});
  });
});

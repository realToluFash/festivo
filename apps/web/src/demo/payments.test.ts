import { describe, expect, it } from 'vitest';

import { TODAY, longDay, money } from './budget.ts';
import { sampleEvent } from './events.ts';
import {
  PAYMENTS_PAGES,
  PAYMENTS_STATES,
  REMINDER_STATES,
  SHAPE_STATES,
  SHAPE_TERMS,
  cancelledLine,
  cancelledOf,
  daysProblem,
  differenceWords,
  eventDays,
  madeProblems,
  offersShapes,
  paidLineOf,
  paymentsStart,
  paymentsVendor,
  reasonProblem,
  scheduleOf,
  shapeLine,
  shapePayments,
  shapeProblems,
  shapeRows,
  shapingOf,
  sharesLine,
  typedShapeDays,
  typedShare,
  typedTerms,
  toMark,
  typedDifference,
} from './payments.ts';
import { draftToMark, markProblems, quotesStart, sampleBudget } from './quotes.ts';

const SPEC_NAMES = [
  'schedule',
  'mark_paid',
  'paid_more',
  'mark_refused',
  'already_paid',
  'marked',
  'cancel',
  'cancelled',
  'already_made',
  'made_early',
  'add_payment',
  'shape_deposit',
  'shape_clamped',
  'shape_short',
  'shape_refused',
  'shape_failed',
  'shape_raced',
  'reminders',
  'reminders_bad',
];

const linked = PAYMENTS_PAGES.flatMap((page) => page.states).map(
  (link) => new URLSearchParams(link.to.split('?')[1]),
);

const startOf = (state: string, vendor: string | null = null) => {
  const vendorId = paymentsVendor(state, vendor);

  return paymentsStart(quotesStart(state, vendorId, longDay), state, vendorId);
};

const WEDDING = eventDays(sampleEvent('evt-wed-4')!);
const SAVOUR_QUOTE = sampleBudget().quotes.find((one) => one.vendor.id === 'v4')!;

describe('payments on a vendor’s page, shapes and reminders, in A (sc-88, sc-1332, sc-95)', () => {
  it('lists every name the spec gives, and opens each on its vendor', () => {
    const listed = new Set(linked.map((query) => query.get('state')));
    expect(SPEC_NAMES.filter((name) => !listed.has(name))).toEqual([]);
    for (const name of [...PAYMENTS_STATES, ...SHAPE_STATES, ...REMINDER_STATES])
      expect(listed.has(name)).toBe(true);
    for (const query of linked) {
      const state = query.get('state') ?? '';
      if (REMINDER_STATES.includes(state)) continue;
      expect(() => startOf(state, query.get('vendor'))).not.toThrow();
    }
    expect(paymentsVendor('schedule', null)).toBe('v3');
    expect(paymentsVendor('shape_clamped', null)).toBe('v4');
    expect(paymentsVendor('paid_more', 'v4')).toBe('v4');
    expect(paymentsVendor('amend', null)).toBe('v4');
    expect(paymentsVendor('add', null)).toBeNull();
  });

  it('starts each state on the sample its board draws', () => {
    expect(startOf('mark_paid').marking).toMatchObject({
      id: 'p6',
      draft: { amount: '840.00', paidOn: TODAY },
    });
    expect(startOf('paid_more').marking?.draft.amount).toBe('900.00');
    expect(startOf('paid_more', 'v4').marking).toMatchObject({
      id: 'p7',
      draft: { amount: '4,500.00' },
    });
    expect(Object.keys(startOf('mark_refused').marking?.problems ?? {})).toEqual([
      'amount',
      'reference',
    ]);
    const already = startOf('already_paid');
    expect(already.marking?.refused).toBe('paid');
    expect(already.budget.payments.find((one) => one.id === 'p6')?.paid?.by).toBe('Julien Moreau');
    expect(startOf('already_cancelled').marking?.refused).toBe('cancelled');
    const marked = startOf('marked');
    expect(marked.marked).toBe('p6');
    expect(marked.said).toBe('Marked paid: £900.00 on Tuesday, November 3.');
    expect(startOf('cancel').cancelling?.why).toBe('The venue supplies the arch flowers');
    expect(startOf('cancelled').budget.payments.find((one) => one.id === 'p6')?.cancelled).toEqual({
      why: 'The venue supplies the arch flowers',
    });
    expect(startOf('already_made').made?.draft).toMatchObject({
      vendorId: 'v3',
      what: 'Buttonholes',
      amount: '120.00',
      paidOn: '2026-11-02',
    });
    expect(startOf('made_early').made?.problems).toEqual({
      paidOn: 'A payment cannot be dated before the vendor’s first quote, Tue, Oct 6.',
    });
    for (const state of [
      'add_payment',
      'shape_deposit',
      'shape_clamped',
      'shape_short',
      'shape_refused',
      'shape_failed',
    ])
      expect(offersShapes(startOf(state).budget, 'v4')).toBe(true);
    expect(startOf('add_payment').shaping?.shape).toBe('rows');
    expect(startOf('shape_clamped').shaping?.terms.map((one) => one.share)).toEqual([50, 30, 15]);
    expect(startOf('shape_short').shaping?.typed.map((one) => one.share)).toEqual(['50', '40']);
    expect(startOf('shape_refused').shaping?.problems).toEqual([
      { what: 'Enter what the payment is for.' },
      {
        what: 'Shorten what the payment is for to 100 characters or fewer.',
        share: 'Enter a percentage from 0 to 100, with up to two decimals.',
      },
      { days: 'Enter a whole number of days from 0 to 730.' },
    ]);
    expect(startOf('shape_failed').shaping).toMatchObject({
      shape: 'instalments',
      failed: true,
      raced: false,
    });
    const raced = startOf('shape_raced');
    expect(raced.shaping).toMatchObject({ shape: 'deposit', raced: true });
    expect(offersShapes(raced.budget, 'v4')).toBe(false);
  });

  it('says a different amount, never absorbing it, and puts it on the paid row', () => {
    const balance = sampleBudget().payments.find((one) => one.id === 'p6')!;
    expect(differenceWords(84000, 84000)).toBeNull();
    expect(differenceWords(84000, 90000)).toBe('£60.00 more than scheduled');
    expect(differenceWords(84000, 80000)).toBe('£40.00 less than scheduled');
    expect(typedDifference(balance, '900.00')).toBe(
      '£60.00 more than scheduled. The difference stays visible; nothing absorbs it.',
    );
    expect(typedDifference(balance, '0')).toBeNull();
    expect(
      paidLineOf({
        ...balance,
        paid: { amount: 90000, on: TODAY, by: 'Folake Adeyemi', reference: '' },
      }),
    ).toBe('Paid £900.00 on Tue, Nov 3 · £60.00 more than scheduled · Marked by Folake Adeyemi');
  });

  it('takes a reference of 100 characters after trimming, and refuses 101', () => {
    const balance = sampleBudget().payments.find((one) => one.id === 'p6')!;
    const draft = draftToMark(balance);
    expect(markProblems({ ...draft, reference: ` ${'a'.repeat(100)} ` }, balance)).toEqual({});
    expect(markProblems({ ...draft, reference: 'a'.repeat(101) }, balance)).toEqual({
      reference: 'Shorten the reference to 100 characters or fewer.',
    });
    expect(markProblems({ ...draft, reference: '     ' }, balance)).toEqual({});
  });

  it('cancels with an optional reason of 200 at most, kept on the row', () => {
    const balance = sampleBudget().payments.find((one) => one.id === 'p6')!;
    expect(reasonProblem('a'.repeat(200))).toBeNull();
    expect(reasonProblem('a'.repeat(201))).toBe('Shorten the reason to 200 characters or fewer.');
    expect(cancelledLine(cancelledOf(balance, ' The venue supplies the arch flowers '))).toBe(
      'Cancelled · Not owed: the venue supplies the arch flowers · £840.00',
    );
    expect(cancelledLine(cancelledOf(balance, '   '))).toBe('Cancelled · Not owed · £840.00');
    const budget = { ...sampleBudget(), payments: [cancelledOf(balance, '')] };
    expect(scheduleOf(budget, 'v3').map((one) => one.id)).toEqual(['p6']);
    expect(toMark(budget, 'v3')).toBeNull();
  });

  it('checks a payment already made against the vendor’s first quote, earlier ones included', () => {
    const quotes = sampleBudget().quotes;
    const bloom = quotes.find((one) => one.vendor.id === 'v3');
    const draft = {
      vendorId: 'v3',
      what: 'Buttonholes',
      amount: '120.00',
      paidOn: '2026-10-06',
      reference: '',
    };
    expect(madeProblems(draft, bloom)).toEqual({});
    expect(
      madeProblems({ ...draft, what: '  ', amount: '0', paidOn: '2026-10-05' }, bloom),
    ).toEqual({
      what: 'Enter what it was for.',
      amount: 'Enter the amount paid, above 0, like 3,500.50.',
      paidOn: 'A payment cannot be dated before the vendor’s first quote, Tue, Oct 6.',
    });
    expect(madeProblems({ ...draft, vendorId: 'v4', paidOn: '2026-09-21' }, SAVOUR_QUOTE)).toEqual(
      {},
    );
    expect(madeProblems({ ...draft, what: 'a'.repeat(101) }, bloom).what).toBe(
      'Shorten the description to 100 characters or fewer.',
    );
  });

  it('counts the wedding’s days in its own time zone', () => {
    expect(WEDDING).toEqual({ starts: '2026-11-05', ends: '2026-11-07' });
    expect(
      eventDays({
        startsAt: '2026-11-05T23:30:00Z',
        endsAt: '2026-11-06T23:30:00Z',
        timeZone: 'Africa/Lagos',
      }),
    ).toEqual({ starts: '2026-11-06', ends: '2026-11-07' });
  });

  it('fills a shape’s rows from the quote and the event’s dates, adding up to the quote', () => {
    const deposit = shapeRows(SHAPE_TERMS.deposit, SAVOUR_QUOTE, WEDDING);
    expect(deposit.map((row) => [row.what, shapeLine(row), money(row.amount)])).toEqual([
      ['Deposit', '50% · on the date quoted · Tue, Oct 13', '£4,500.00'],
      ['Balance', '50% · 14 days before the event · Thu, Oct 22', '£4,500.00'],
    ]);
    expect(sharesLine(deposit, SAVOUR_QUOTE.amount)).toBeNull();

    const three = shapeRows(SHAPE_TERMS.instalments, SAVOUR_QUOTE, WEDDING);
    expect(three[1]).toMatchObject({ dueOn: '2026-10-13', clamped: true, amount: 270000 });
    expect(shapeLine(three[1]!)).toBe(
      '30% · 60 days before the event · Set to the date quoted, Tue, Oct 13',
    );
    expect(three.reduce((sum, row) => sum + row.amount, 0)).toBe(SAVOUR_QUOTE.amount);

    const terms = SHAPE_TERMS.instalments.map((one, index) =>
      index === 2 ? { ...one, share: 15 } : one,
    );
    const short = shapeRows(terms, SAVOUR_QUOTE, WEDDING);
    expect(short.map((row) => row.amount)).toEqual([450000, 270000, 135000]);
    expect(sharesLine(short, SAVOUR_QUOTE.amount)).toBe(
      'The percentages come to 95%. The schedule is £450.00 short of the quote; it saves, and the vendor’s page says so.',
    );

    expect(shapeLine(shapeRows(SHAPE_TERMS.before, SAVOUR_QUOTE, WEDDING)[0]!)).toBe(
      '100% · 14 days before the event · Thu, Oct 22',
    );
    expect(shapeLine(shapeRows(SHAPE_TERMS.after, SAVOUR_QUOTE, WEDDING)[0]!)).toBe(
      '100% · 7 days after the event · Sat, Nov 14',
    );

    const odd = shapeRows(SHAPE_TERMS.deposit, { amount: 100001, quotedOn: '2026-10-13' }, WEDDING);
    expect(odd.map((row) => row.amount)).toEqual([50001, 50000]);
  });

  it('takes a percentage from 0 to 100 with two decimals, and days from 0 to 730', () => {
    for (const [typed, share] of [
      ['0', 0],
      ['100', 100],
      [' 33.33 ', 33.33],
      ['12.5', 12.5],
    ] as const)
      expect(typedShare(typed)).toBe(share);
    for (const wrong of ['', '100.01', '101', '33.333', '-5', 'half', '1,5'])
      expect(typedShare(wrong)).toBeNull();
    for (const [typed, days] of [
      ['0', 0],
      ['730', 730],
      [' 14 ', 14],
    ] as const)
      expect(typedShapeDays(typed)).toBe(days);
    for (const wrong of ['', '731', '1.5', '-1', 'two']) expect(typedShapeDays(wrong)).toBeNull();

    const [deposit, balance] = SHAPE_TERMS.deposit;
    expect(shapeProblems(deposit!, { what: 'Deposit', share: '50', days: 'any' })).toEqual({});
    expect(shapeProblems(balance!, { what: '   ', share: '50', days: '14' })).toEqual({
      what: 'Enter what the payment is for.',
    });
    expect(shapeProblems(balance!, { what: 'x'.repeat(101), share: '50', days: '14' })).toEqual({
      what: 'Shorten what the payment is for to 100 characters or fewer.',
    });
    expect(shapeProblems(balance!, { what: 'x'.repeat(100), share: '50', days: '14' })).toEqual({});
  });

  it('counts a shape from its rows as typed, never adjusting shares that miss 100', () => {
    const shaping = startOf('shape_short').shaping!;
    const rows = shapeRows(typedTerms(shaping), SAVOUR_QUOTE, WEDDING);
    expect(rows.map((row) => row.amount)).toEqual([450000, 360000]);
    expect(sharesLine(rows, SAVOUR_QUOTE.amount)).toBe(
      'The percentages come to 90%. The schedule is £900.00 short of the quote; it saves, and the vendor’s page says so.',
    );
    const typed = typedTerms({
      ...shapingOf('deposit'),
      typed: [
        { what: ' Deposit ', share: '50', days: '0' },
        { what: 'Balance', share: '50', days: '30' },
      ],
    });
    expect(typed.map((one) => [one.what, one.days])).toEqual([
      ['Deposit', 0],
      ['Balance', 30],
    ]);
  });

  it('saves a shape as ordinary payments, each with its own id', () => {
    const budget = startOf('shape_deposit').budget;
    const rows = shapeRows(SHAPE_TERMS.deposit, SAVOUR_QUOTE, WEDDING);
    const added = shapePayments(rows, 'v4', budget.payments);
    expect(added.map((one) => [one.id, one.what, one.amount, one.dueOn, one.paid])).toEqual([
      ['p7', 'Deposit', 450000, '2026-10-13', null],
      ['p8', 'Balance', 450000, '2026-10-22', null],
    ]);
  });

  it('takes a whole number of days from 1 to 30, and refuses anything else naming the range', () => {
    for (const fine of ['1', '3', ' 30 ']) expect(daysProblem(fine)).toBeNull();
    for (const wrong of ['', '0', '31', '2.5', 'three', '-1'])
      expect(daysProblem(wrong)).toBe('Enter a whole number of days from 1 to 30.');
  });
});

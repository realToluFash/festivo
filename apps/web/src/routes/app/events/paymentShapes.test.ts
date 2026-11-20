import i18next from 'i18next';
import { describe, expect, it } from 'vitest';

import '../../../i18n/index.ts';
import {
  SHAPE_TERMS,
  anyShapeProblem,
  eventDays,
  retyped,
  shapeRefusedAt,
  shapeRows,
  shapingOf,
  shapingProblems,
  sharesLine,
  typedShapeDays,
  typedShare,
  typedTerms,
  whenWords,
} from './paymentShapes.ts';

const t = i18next.getFixedT('en');
const QUOTE = { amount: '9000.00', quotedOn: '2027-02-20' };
const DAYS = { starts: '2027-06-12', ends: '2027-06-13' };
const PRICING = {
  quote: QUOTE,
  currency: 'GBP',
  days: DAYS,
  locale: 'en-GB',
  language: 'en' as const,
};

const rowsOf = (shape: 'deposit' | 'instalments' | 'before' | 'after', quote = QUOTE) =>
  shapeRows(typedTerms(shapingOf(t, shape), 'en'), quote, 'GBP', DAYS);

describe('each shape fills its rows from the quote and the event', () => {
  it('Deposit and balance: half on the date quoted, half 14 days before the start', () => {
    expect(rowsOf('deposit').map((row) => [row.what, row.amountMinor, row.dueOn])).toEqual([
      ['Deposit', 450000, '2027-02-20'],
      ['Balance', 450000, '2027-05-29'],
    ]);
  });

  it('Three instalments: 50, 30 at 60 days before, 20 at 14 days before', () => {
    expect(rowsOf('instalments').map((row) => [row.what, row.amountMinor, row.dueOn])).toEqual([
      ['Deposit', 450000, '2027-02-20'],
      ['Second instalment', 270000, '2027-04-13'],
      ['Balance', 180000, '2027-05-29'],
    ]);
  });

  it('In full after the event counts forward from its end date', () => {
    expect(rowsOf('after').map((row) => [row.what, row.dueOn])).toEqual([
      ['Payment in full', '2027-06-20'],
    ]);
  });

  it('reads the event’s days in its own time zone, not the reader’s', () => {
    expect(
      eventDays({
        startsAt: '2027-06-12T23:30:00Z',
        endsAt: '2027-06-13T22:30:00Z',
        timeZone: 'Europe/London',
      }),
    ).toEqual({ starts: '2027-06-13', ends: '2027-06-13' });
  });
});

describe('rounding and dates the shape cannot use', () => {
  it('rounds each row to the minor unit and gives the last the remainder when the percentages come to 100', () => {
    const rows = rowsOf('instalments', { amount: '100.01', quotedOn: '2027-02-20' });

    expect(rows.map((row) => row.amountMinor)).toEqual([5001, 3000, 2000]);
    expect(rows.reduce((sum, row) => sum + row.amountMinor, 0)).toBe(10001);
  });

  it('rounds to whole yen, where the currency has no minor unit', () => {
    const rows = shapeRows(
      typedTerms(shapingOf(t, 'instalments'), 'en'),
      { amount: '1001', quotedOn: '2027-02-20' },
      'JPY',
      DAYS,
    );

    expect(rows.map((row) => row.amountMinor)).toEqual([501, 300, 200]);
  });

  it('adjusts no row when the percentages do not come to 100, and says how short it is', () => {
    const shaping = retyped(t, shapingOf(t, 'deposit'), 1, { share: '40' }, PRICING);
    const rows = shapeRows(typedTerms(shaping, 'en'), QUOTE, 'GBP', DAYS);

    expect(rows.map((row) => row.amountMinor)).toEqual([450000, 360000]);
    expect(sharesLine(t, rows, QUOTE, 'GBP', 'en-GB')).toBe(
      'The percentages come to 90%, so £900.00 of the quote is not scheduled. You can still save these payments, and the vendor’s page will show the difference.',
    );
    expect(sharesLine(t, rowsOf('deposit'), QUOTE, 'GBP', 'en-GB')).toBeNull();
  });

  it('sets a date that would fall before the date quoted to the date quoted, and marks the row', () => {
    const rows = rowsOf('instalments', { amount: '9000.00', quotedOn: '2027-05-01' });

    expect(rows.map((row) => [row.dueOn, row.clamped])).toEqual([
      ['2027-05-01', false],
      ['2027-05-01', true],
      ['2027-05-29', false],
    ]);
  });
});

describe('the fields of a shape’s rows', () => {
  it('takes above 0 and up to 100 with up to two decimals, and 0 to 730 whole days', () => {
    expect(
      ['0', '0.00', '100', '33.33', '30.555', '101', '-1', 'x'].map((typed) =>
        typedShare(typed, 'en'),
      ),
    ).toEqual([null, null, 100, 33.33, null, null, null, null]);
    expect(['0', '730', '731', '1.5', ''].map(typedShapeDays)).toEqual([0, 730, null, null, null]);
  });

  it('reads the percentage with the language’s decimal mark: 12,5 is 12.5 in fr and refused in en', () => {
    expect(typedShare('12,5', 'fr')).toBe(12.5);
    expect(typedShare('33,33', 'pt')).toBe(33.33);
    expect(typedShare('12,5', 'en')).toBeNull();
    expect(typedShare('12.5', 'fr')).toBeNull();
    expect(typedShare('30,555', 'es')).toBeNull();
  });

  it('takes a French schedule typed with commas, with no problem at any row', () => {
    const shaping = shapingOf(t, 'instalments');
    const typed = shaping.typed.map((one, index) => ({
      ...one,
      share: ['33,33', '33,33', '33,34'][index] ?? '',
    }));
    const french = { ...PRICING, locale: 'fr-FR', language: 'fr' as const };

    expect(anyShapeProblem(shapingProblems(t, { ...shaping, typed }, french))).toBe(false);
    expect(typedTerms({ ...shaping, typed }, 'fr').map((one) => one.share)).toEqual([
      33.33, 33.33, 33.34,
    ]);
  });

  it('refuses a blank description, one over 100 characters, a bad percentage and bad days, each at its field', () => {
    const shaping = shapingOf(t, 'instalments');
    const typed = [
      { what: '  ', share: '50', days: '0' },
      { what: 'x'.repeat(101), share: '30.555', days: '60' },
      { what: 'Balance', share: '20', days: '731' },
    ];
    const problems = shapingProblems(t, { ...shaping, typed }, PRICING);

    expect(problems).toEqual([
      { what: 'Enter what the payment is for.' },
      {
        what: 'Shorten what the payment is for to 100 characters or fewer.',
        share: 'Enter a percentage above 0 and up to 100, with up to two decimal places.',
      },
      { days: 'Enter a whole number of days from 0 to 730.' },
    ]);
    expect(anyShapeProblem(problems)).toBe(true);
    expect(anyShapeProblem(shapingProblems(t, shaping, PRICING))).toBe(false);
  });

  it('refuses a percentage of 0 at its field, and never drops the row', () => {
    const shaping = retyped(t, shapingOf(t, 'instalments'), 1, { share: '0' }, PRICING);

    expect(shapingProblems(t, shaping, PRICING)).toEqual([
      {},
      { share: 'Enter a percentage above 0 and up to 100, with up to two decimal places.' },
      {},
    ]);
    expect(shaping.terms).toHaveLength(3);
  });

  it('refuses a percentage whose row rounds to 0, at that row, naming the smallest amount', () => {
    const small = { ...PRICING, quote: { ...QUOTE, amount: '10.00' } };
    const tiny = retyped(t, shapingOf(t, 'deposit'), 0, { share: '0.01' }, small);

    expect(shapingProblems(t, tiny, small)).toEqual([
      { share: 'This payment would come to less than £0.01. Enter a higher percentage.' },
      {},
    ]);

    const tenPence = { ...PRICING, quote: { ...QUOTE, amount: '0.10' } };
    const instalments = shapingOf(t, 'instalments');
    const shares = ['45', '45', '10'];
    const remainder = {
      ...instalments,
      typed: instalments.typed.map((one, at) => ({ ...one, share: shares[at] ?? '' })),
    };

    expect(shapingProblems(t, remainder, tenPence)).toEqual([
      {},
      {},
      { share: 'This payment would come to less than £0.01. Enter a higher percentage.' },
    ]);
  });

  it('names the smallest amount in the currency’s own minor unit', () => {
    const yen = { ...PRICING, currency: 'JPY', quote: { ...QUOTE, amount: '10' } };
    const shaping = retyped(t, shapingOf(t, 'deposit'), 0, { share: '1' }, yen);

    expect(shapingProblems(t, shaping, yen)[0]).toEqual({
      share: 'This payment would come to less than ¥1. Enter a higher percentage.',
    });
  });

  it('clears a field’s refusal once it is fixed, and marks no field still being filled', () => {
    const shown = {
      ...shapingOf(t, 'deposit'),
      problems: [{ what: 'Enter what the payment is for.' }, {}],
    };

    expect(retyped(t, shown, 0, { what: 'Deposit' }, PRICING).problems).toEqual([{}, {}]);
    expect(retyped(t, shown, 1, { share: 'x' }, PRICING).problems[1]).toEqual({});
  });

  it('words the row’s timing, with its own words for 0 days', () => {
    expect(SHAPE_TERMS.deposit.map((one) => whenWords(t, one))).toEqual([
      'On the date quoted',
      '14 days before the event',
    ]);
    expect(whenWords(t, { from: 'before', days: 1 })).toBe('1 day before the event');
    expect(whenWords(t, { from: 'before', days: 0 })).toBe('On the event’s start date');
    expect(whenWords(t, { from: 'after', days: 0 })).toBe('On the event’s end date');
  });
});

describe('the API’s refusals of a schedule', () => {
  it('puts each refusal beside the row’s field that fixes it, and anything else at the top', () => {
    expect(
      shapeRefusedAt(
        {
          'payments[1].description': 'Enter what the payment is for.',
          'payments[1].amount': 'Enter the amount as a number above 0.',
          'payments[1].dueOn': 'Too early.',
        },
        SHAPE_TERMS.deposit,
      ),
    ).toEqual({
      rows: [
        {},
        {
          what: 'Enter what the payment is for.',
          share: 'Enter the amount as a number above 0.',
          days: 'Too early.',
        },
      ],
      top: null,
    });
    expect(
      shapeRefusedAt(
        { 'payments[0].dueOn': 'Too early.', payments: 'Too many.' },
        SHAPE_TERMS.deposit,
      ),
    ).toEqual({ rows: [{}, {}], top: 'Too early.' });
    expect(shapeRefusedAt({}, SHAPE_TERMS.deposit)).toBeNull();
  });
});

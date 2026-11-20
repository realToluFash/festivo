import { type BudgetLine, type EventBudget } from '@soirely/api-client';
import i18next from 'i18next';
import { describe, expect, it } from 'vitest';

import '../../../i18n/index.ts';
import {
  basisLine,
  lineState,
  liveWords,
  minorMoney,
  priceProblem,
  priceProblemWords,
  removedWords,
  rowLine,
  wholeMoney,
} from './budgetArea.ts';

const t = i18next.getFixedT('en');
const EN = 'en-GB';

function line(fields: Partial<BudgetLine> = {}): BudgetLine {
  return {
    id: 'dinner',
    label: 'Dinner',
    category: 'catering',
    basis: 'per_head',
    rate: '68.00',
    amount: null,
    currency: 'GBP',
    note: null,
    quantity: { count: 96, source: 'accepted', reason: null },
    cost: { confirmed: '6528.00', potential: '9044.00' },
    ...fields,
    notPriced: fields.notPriced ?? [fields.rate, fields.amount].includes('0.00'),
  };
}

function budget(fields: Partial<EventBudget> = {}): EventBudget {
  return {
    currency: 'GBP',
    confirmed: '6528.00',
    potential: '9044.00',
    perHead: {
      confirmed: { amount: '68.00', heads: 96 },
      potential: { amount: '68.00', heads: 133 },
    },
    notPriced: 0,
    quantities: {
      per_head: { count: 96, source: 'accepted', reason: null },
      per_table: { count: 0, source: 'seating_tables', reason: 'no_seating_plan' },
      per_staff_hour: { count: 0, source: 'staff_hours', reason: 'no_staff_hours' },
      per_day: { count: 3, source: 'event_days', reason: null },
      fixed: { count: 1, source: 'fixed', reason: null },
    },
    lines: [line()],
    ...fields,
  };
}

describe('the three kinds of line, never sharing a word (sc-85, 31 Oct)', () => {
  it('reads a price of 0 as Not priced, and a priced line counting 0 as Nothing yet', () => {
    expect(lineState(line())).toBe('priced');
    expect(lineState(line({ rate: '0.00' }))).toBe('notPriced');
    expect(lineState(line({ basis: 'fixed', rate: null, amount: '0.00', notPriced: false }))).toBe(
      'priced',
    );
    expect(
      lineState(line({ quantity: { count: 0, source: 'accepted', reason: 'none_accepted' } })),
    ).toBe('nothingYet');
  });

  it('says where each quantity comes from, and never £0 on a line at 0', () => {
    expect(rowLine(t, line(), EN)).toBe('£68.00 a head × 96 · said yes, from the guest list');
    expect(rowLine(t, line({ basis: 'fixed', rate: null, amount: '450.00' }), EN)).toBe(
      'A fixed amount',
    );
    expect(rowLine(t, line({ rate: '0.00' }), EN)).toBe('No price yet');
    expect(
      rowLine(
        t,
        line({
          basis: 'per_table',
          rate: '25.00',
          quantity: { count: 0, source: 'seating_tables', reason: 'no_seating_plan' },
        }),
        EN,
      ),
    ).toBe('£25.00 a table · Nothing yet · No seating plan yet');
  });
});

describe('money on the page (pm, 7 Nov)', () => {
  it('writes summaries in whole units and a rate in the minor unit, in the event’s currency', () => {
    expect(wholeMoney('19387.60', 'GBP', EN)).toBe('£19,388');
    expect(minorMoney('68', 'GBP', EN)).toBe('£68.00');
    expect(minorMoney('1200', 'JPY', EN)).toBe('¥1,200');
    expect(wholeMoney('6528', 'GBP', 'fr').replace(/\s/gu, ' ')).toBe('6 528 £GB');
  });
});

describe('a typed rate, by sc-83’s Form checks (decided 17 Oct)', () => {
  it.each([
    ['', 'blank'],
    ['12.50', null],
    ['1,234.5', null],
    ['-12', 'number'],
    ['£12', 'number'],
    ['twelve', 'number'],
    ['12.505', 'decimals'],
  ])('en, GBP: %s', (typed, problem) => {
    expect(priceProblem(typed, 'en', 'GBP')).toBe(problem);
  });

  it('follows the currency’s minor unit and the reader’s decimal mark', () => {
    expect(priceProblem('12.5', 'en', 'JPY')).toBe('decimals');
    expect(priceProblem('12.505', 'en', 'KWD')).toBeNull();
    expect(priceProblem('52,50', 'fr', 'GBP')).toBeNull();
    expect(priceProblem('52.50', 'fr', 'GBP')).toBe('number');
  });

  it('gives the example at the currency’s minor unit, and says amount on a fixed line', () => {
    expect(priceProblemWords(t, 'decimals', false, 'en', 'GBP')).toBe(
      "That has too many decimal places for this event's currency. Enter the rate like 12.50.",
    );
    expect(priceProblemWords(t, 'decimals', true, 'en', 'KWD')).toBe(
      "That has too many decimal places for this event's currency. Enter the amount like 12.500.",
    );
    expect(priceProblemWords(t, 'decimals', false, 'en', 'JPY')).toContain('like 12.');
    expect(priceProblemWords(t, 'blank', true, 'en', 'GBP')).toBe('Enter the amount.');
  });
});

describe('Add a cost asks for no number the event already knows', () => {
  it('lists what each basis counts today', () => {
    const now = budget();

    expect(basisLine(t, now, 'per_head', EN)).toBe(
      '96 said yes now, up to 133 if all come · from the guest list',
    );
    expect(basisLine(t, now, 'per_table', EN)).toBe('No seating plan yet');
    expect(basisLine(t, now, 'per_day', EN)).toBe("3 days, from the event's dates");
    expect(basisLine(t, now, 'fixed', EN)).toBe('Counted once');
  });
});

describe('a removal that moves no money says the total is the same (decided 1 Nov)', () => {
  it('names the line and gives the reason in its own state', () => {
    expect(
      removedWords(
        t,
        line({ label: 'DJ', cost: { confirmed: '450.00', potential: '450.00' } }),
        EN,
      ),
    ).toBe('DJ removed. The settled total fell by £450.');
    expect(removedWords(t, line({ label: 'Aisle arch', rate: '0.00' }), EN)).toBe(
      'Aisle arch removed. It had no price, so the total is the same.',
    );
    expect(
      removedWords(
        t,
        line({
          label: 'Welcome drinks',
          quantity: { count: 0, source: 'accepted', reason: 'none_accepted' },
          cost: { confirmed: '0.00', potential: '0.00' },
        }),
        EN,
      ),
    ).toBe('Welcome drinks removed. Nothing was counted for it yet, so the total is the same.');
    expect(
      removedWords(
        t,
        line({
          label: 'Planning fee',
          basis: 'fixed',
          rate: null,
          amount: '0.00',
          notPriced: false,
          quantity: { count: 1, source: 'fixed', reason: null },
          cost: { confirmed: '0.00', potential: '0.00' },
        }),
        EN,
      ),
    ).toBe('Planning fee removed. It cost nothing, so the total is the same.');
  });
});

describe('the live line (sc-83, sc-99)', () => {
  it('says how many more said yes and how far the settled total moved', () => {
    const was = budget();
    const now = budget({
      confirmed: '6664.00',
      perHead: {
        confirmed: { amount: '68.00', heads: 98 },
        potential: { amount: '68.00', heads: 133 },
      },
    });

    expect(liveWords(t, was, now, EN)).toBe(
      '2 more guests said yes, so the settled total went up by £136.',
    );
  });

  it('says a line added at 0 leaves the total the same, never by £0, and gives the new count', () => {
    const shuttle = line({
      id: 'shuttle',
      label: 'Guest shuttle',
      rate: '0.00',
      cost: { confirmed: '0.00', potential: '0.00' },
    });
    const now = budget({ lines: [line(), shuttle], notPriced: 1 });

    expect(liveWords(t, budget(), now, EN)).toBe(
      'Guest shuttle was added in another tab with no price yet, so the total is the same. 1 cost not priced yet.',
    );
  });

  it('says a line priced in another tab, at its rate', () => {
    const arch = line({
      id: 'arch',
      label: 'Centrepieces',
      basis: 'per_table',
      rate: '0.00',
      cost: { confirmed: '0.00', potential: '0.00' },
    });
    const was = budget({ lines: [line(), arch], notPriced: 1 });
    const now = budget({
      confirmed: '7428.00',
      lines: [
        line(),
        {
          ...arch,
          rate: '25.00',
          notPriced: false,
          cost: { confirmed: '900.00', potential: '900.00' },
        },
      ],
    });

    expect(liveWords(t, was, now, EN)).toBe(
      'Centrepieces was priced in another tab at £25.00 a table, so the settled total went up by £900.',
    );
  });

  it('says a fee emptied of its client price changed, the total the same, with the new count (sc-75696)', () => {
    const fee = line({
      id: 'fee',
      label: 'Planning fee',
      category: 'other',
      basis: 'fixed',
      rate: null,
      amount: '0.00',
      notPriced: false,
      cost: { confirmed: '0.00', potential: '0.00' },
    });
    const was = budget({ lines: [line(), fee], notPriced: 0 });
    const now = budget({ lines: [line(), { ...fee, notPriced: true }], notPriced: 1 });

    expect(liveWords(t, was, now, EN)).toBe(
      'Planning fee was changed in another tab, so the total is the same. 1 cost not priced yet.',
    );
    expect(liveWords(t, now, was, EN)).toBe(
      'Planning fee was priced in another tab at £0.00, so the total is the same.',
    );
  });

  it('says a line this tab has shown, back from an Undo, was put back and never added (decided 19 Nov)', () => {
    const was = budget({ lines: [], confirmed: '0.00' });
    const now = budget({ confirmed: '480.00' });

    expect(liveWords(t, was, now, EN, new Set(['dinner']))).toBe(
      'Dinner was put back in another tab, so the settled total went up by £480.',
    );
    expect(liveWords(t, was, now, EN)).toBe(
      'Dinner was added in another tab, so the settled total went up by £480.',
    );
  });

  it('says nothing when nothing a reader sees moved', () => {
    expect(liveWords(t, budget(), budget(), EN)).toBeNull();
  });
});

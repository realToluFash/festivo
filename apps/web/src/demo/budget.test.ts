import { describe, expect, it } from 'vitest';

import {
  COST_LINES,
  HEADS,
  PAYMENTS,
  QUOTES,
  amounts,
  categoriesOf,
  costLine,
  dueList,
  lineState,
  money,
  moneyRange,
  overdue,
  perHead,
  plan,
  rateWords,
  shortDay,
  totals,
  whole,
  wholeRange,
} from './budget.ts';

const NAMES: Record<string, string> = {
  v3: 'Bloom & Co',
  v4: 'Savour Kitchen',
  v5: 'The Landmark',
  v6: 'Lens & Light',
};

const parse = (shown: string): number => Math.round(Number(shown.replace(/[£,]/g, '')) * 100);

describe('the wedding’s budget (spec §1)', () => {
  it('counts the guests as Guests A does', () => {
    expect(HEADS.coming + HEADS.notComing + HEADS.stillToAnswer).toBe(HEADS.invited);
    expect(HEADS.coming + HEADS.stillToAnswer).toBe(HEADS.ifAllCome);
  });

  it('comes to £19,730 to £23,060, with 2 costs not priced yet', () => {
    const sum = totals();

    expect(sum).toEqual({ settled: 1973000, ifAll: 2306000, notPriced: 2 });
    expect(wholeRange(sum.settled, sum.ifAll)).toBe('£19,730 to £23,060');
  });

  it('adds its cost rows, as shown in the minor unit, up to the total exactly', () => {
    const shown = COST_LINES.map((line) => money(amounts(line).settled));
    const ifAll = COST_LINES.map((line) => money(amounts(line).ifAll));

    expect(shown.reduce((sum, one) => sum + parse(one), 0)).toBe(totals().settled);
    expect(ifAll.reduce((sum, one) => sum + parse(one), 0)).toBe(totals().ifAll);
    expect(money(totals().settled)).toBe('£19,730.00');
  });

  it('says per head whole on the card and to the penny on a row', () => {
    const each = perHead();

    expect(each).toEqual({ settled: 20552, ifAll: 17338 });
    expect([money(20552), whole(20552), money(17338), whole(17338)]).toEqual([
      '£205.52',
      '£206',
      '£173.38',
      '£173',
    ]);
  });

  it('keeps three kinds of cost apart', () => {
    const line = (id: string) => COST_LINES.find((one) => one.id === id) ?? COST_LINES[0]!;
    const state = Object.fromEntries(COST_LINES.map((line) => [line.id, lineState(line)]));

    expect(state).toMatchObject({ arch: 'notPriced', shuttle: 'notPriced', centre: 'nothingYet' });
    expect(costLine(line('dinner'))).toBe('£68.00 a head × 96 · said yes, from the guest list');
    expect(costLine(line('room'))).toBe('£2,100.00 a day × 3 · days the event runs');
    expect(costLine(line('centre'))).toBe('£45.00 a table · Nothing yet · No seating plan yet');
    expect(rateWords(line('bridal'))).toBe('£850.00');
    expect(categoriesOf()).toEqual([
      'catering',
      'venue',
      'flowers',
      'photography',
      'music',
      'transport',
    ]);
  });

  it('plans £19,730, commits £18,900, has paid £4,310 and still owes £13,090', () => {
    expect(plan()).toEqual({
      planned: 1973000,
      committed: 1890000,
      paid: 431000,
      stillToPay: 1309000,
    });
  });

  it('lists what is due soonest first, Bloom & Co’s balance overdue', () => {
    const due = dueList(PAYMENTS, (id) => NAMES[id] ?? id);

    expect(due.map((one) => `${NAMES[one.vendorId]} ${one.what} ${shortDay(one.dueOn)}`)).toEqual([
      'Bloom & Co Balance Fri, Oct 30',
      'Savour Kitchen Deposit Wed, Nov 4',
      'The Landmark Balance Thu, Nov 5',
      'Savour Kitchen Second instalment Mon, Nov 9',
      'Lens & Light Balance Mon, Nov 30',
    ]);
    expect(due.filter((one) => overdue(one)).map((one) => one.id)).toEqual(['p6']);
  });

  it('leaves £1,500.00 of Savour Kitchen’s quote not scheduled, the rest matching', () => {
    const scheduled = (id: string) =>
      PAYMENTS.filter((one) => one.vendorId === id).reduce((sum, one) => sum + one.amount, 0);

    expect(QUOTES.map((quote) => quote.amount - scheduled(quote.vendorId))).toEqual([
      150000, 0, 0, 0,
    ]);
    expect(moneyRange(652800, 904400)).toBe('£6,528.00 to £9,044.00');
    expect(money(-10000)).toBe('−£100.00');
  });
});

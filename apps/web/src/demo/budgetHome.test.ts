import { describe, expect, it } from 'vitest';

import { COST_LINES, money, whole } from './budget.ts';
import {
  BUDGET_PAGES,
  CEILING_STATES,
  HOME_STATES,
  MARGIN_STATES,
  WEB_STATES,
  categoryCeilingsLine,
  categoryGone,
  ceilingOf,
  ceilingProblem,
  ceilingsOf,
  MARKUPS,
  marginOf,
  headsOf,
  lineAmounts,
  linesOf,
  markupProblem,
  noteProblem,
  priceProblem,
  rateProblem,
  removedWords,
  STAFF_REFUSED,
  sumLines,
  whatProblem,
} from './budgetHome.ts';
import { ceilingSentence } from './budgetSample.ts';
import { TEMPLATES_PAGES } from './templates.ts';

const line = (id: string) => COST_LINES.find((one) => one.id === id) ?? COST_LINES[0]!;

describe('the Budget home’s states (spec §9)', () => {
  it('has every Web and Ceiling name, and the margin ones on the home', () => {
    expect(WEB_STATES).toHaveLength(34);
    expect(CEILING_STATES).toHaveLength(24);
    expect(MARGIN_STATES).toContain('free');
    const linked = [...BUDGET_PAGES, ...TEMPLATES_PAGES].flatMap((group) =>
      group.states.map((one) => one.to),
    );
    for (const state of HOME_STATES)
      expect(
        linked.some((to) => to.includes(`state=${state}`)),
        state,
      ).toBe(true);
  });

  it('adds the cost rows, as each row shows them, up to the card’s figures exactly', () => {
    for (const state of ['populated', 'all_priced', 'zero_heads', 'live_heads', 'rate_saved']) {
      const heads = headsOf(state);
      const lines = linesOf(state);
      const rows = lines.map((one) => money(lineAmounts(one, heads).settled));
      const sum = sumLines(lines, heads);
      const added = rows.reduce(
        (total, one) => total + Math.round(Number(one.replace(/[£,]/g, '')) * 100),
        0,
      );

      expect(added, state).toBe(sum.settled);
    }
  });

  it('moves the figures as the boards draw them', () => {
    const at = (state: string) => sumLines(linesOf(state), headsOf(state));

    expect(at('populated')).toEqual({ settled: 1973000, ifAll: 2306000, notPriced: 2 });
    expect(at('zero_heads')).toMatchObject({ settled: 1109000, ifAll: 2306000 });
    expect(at('all_priced')).toEqual({ settled: 2058000, ifAll: 2391000, notPriced: 0 });
    expect([whole(Math.round(2058000 / 96)), whole(Math.round(2391000 / 133))]).toEqual([
      '£214',
      '£180',
    ]);
    expect(at('live_heads').settled - at('populated').settled).toBe(18000);
    expect(at('rate_saved')).toMatchObject({ settled: 1992200, ifAll: 2332600 });
  });

  it('says the ceiling’s four states with a ring and a sentence (sc-90)', () => {
    const lines = linesOf('populated');
    const heads = headsOf('populated');
    const states = ['ceiling_within', 'ceiling_close', 'ceiling_overif', 'ceiling_over'].map(
      (state) => ceilingOf('whole', ceilingsOf(state).whole ?? 0, lines, heads).state,
    );

    expect(states).toEqual(['within', 'close', 'overIfAll', 'over']);
    expect(ceilingOf('catering', 1300000, lines, heads).state).toBe('close');
    expect(ceilingOf('flowers', 150000, lines, heads).state).toBe('within');
    expect(ceilingSentence(1973000, 2306000, 2200000)).toBe(
      'Settled, it is £19,730. If everyone comes, it would be £23,060 against £22,000.',
    );
    expect(ceilingSentence(0, 0, 0)).toBe('Nothing is costed here; one amount puts it over.');
    expect(ceilingsOf('ceiling_none')).toEqual({});
    expect(categoryCeilingsLine(ceilingsOf('ceiling_saved'))).toBe(
      'The category ceilings come to £14,500, £7,500 less than the event’s ceiling.',
    );
    expect(categoryCeilingsLine({ whole: 2200000, catering: 2300000 })).toBe(
      'The category ceilings come to £23,000, £1,000 more than the event’s ceiling.',
    );
    expect(categoryCeilingsLine({ whole: 2200040, catering: 2200000 })).toBe(
      'The category ceilings come to £22,000.00, £0.40 less than the event’s ceiling.',
    );
    expect(categoryCeilingsLine({ whole: 2200000, catering: 2200000 })).toBeNull();
    expect(categoryCeilingsLine({ catering: 1300000 })).toBeNull();
    expect(categoryCeilingsLine({ whole: 2200000 })).toBeNull();
  });

  it('refuses a rate, a ceiling and a markup at the field, in the boards’ words', () => {
    expect(rateProblem('')).toBe('Enter the rate.');
    expect(rateProblem('seventy')).toBe('Enter a rate of 0 or more, in numbers only.');
    expect(rateProblem('70.505')).toBe(
      'That has too many decimal places for this event’s currency. Enter the rate like 12.50.',
    );
    expect(rateProblem('70')).toBeNull();
    expect(ceilingProblem('−50')).toBe('The ceiling cannot be below 0. Enter 0 or more.');
    expect(ceilingProblem('€640')).toBe('Enter the ceiling in GBP, the currency this event uses.');
    expect(ceilingProblem('six hundred')).toBe('Enter the ceiling as a number, like 20,000.50.');
    expect(ceilingProblem('640.505')).toBe(
      'That has too many decimal places for this event’s currency. Enter the ceiling like 20,000.50.',
    );
    expect(ceilingProblem('640.5', 'JPY')).toContain('Enter the ceiling like 20,000.');
    expect(ceilingProblem('640.5055', 'KWD')).toContain('like 20,000.500.');
    expect(ceilingProblem('13,000.00')).toBeNull();
    expect(ceilingProblem('')).toBeNull();
    expect(markupProblem('−5')).toBe(
      'A markup cannot be below 0. To sell below cost, enter the price instead.',
    );
    expect(markupProblem('1200')).toBe('Enter a markup of 999.9% or less.');
    expect(markupProblem('20.25')).toBe('Enter a markup with at most one decimal place.');
    expect(markupProblem('20')).toBeNull();
    expect(markupProblem('twenty')).toBe('Enter the markup as a number, like 12.5.');
    expect(priceProblem('−50')).toBe('Enter a price of 0 or more, in numbers only.');
    expect(priceProblem('950.505')).toBe(
      'That has too many decimal places for this event’s currency. Enter the price like 12.50.',
    );
    expect(priceProblem('0')).toBeNull();
  });

  it('refuses what a cost is over 100 and a note over 500, and words the server’s 422 (sc-85)', () => {
    expect(whatProblem('a'.repeat(101))).toBe('Shorten what it is to 100 characters or fewer.');
    expect(whatProblem(` ${'a'.repeat(100)} `)).toBeNull();
    expect(whatProblem('  ')).toBe('Enter what it is.');
    expect(noteProblem('a'.repeat(501))).toBe('Shorten the note to 500 characters or fewer.');
    expect(noteProblem('a'.repeat(500))).toBeNull();
    expect(STAFF_REFUSED).toBe(
      'The budget already has a staff-time cost. Choose another way it is counted.',
    );
  });

  it('starts each of the ceiling’s gaps on the ceilings its board draws (sc-90)', () => {
    const lines = linesOf('populated');
    const heads = headsOf('populated');

    expect(ceilingsOf('ceiling_categories_only')).toEqual({ catering: 1300000, flowers: 150000 });
    expect(ceilingsOf('ceiling_live_cleared')).toEqual({});
    expect(
      ceilingOf('whole', ceilingsOf('ceiling_live_changed').whole ?? 0, lines, heads).state,
    ).toBe('close');
    expect(ceilingsOf('ceiling_cleared_one')).toEqual({ whole: 2200000, catering: 1300000 });
    expect(ceilingsOf('ceiling_no_costs')).toMatchObject({ other: 50000, hire: 0 });
    expect(ceilingsOf('ceiling_refused')).toEqual({ whole: 2200000, catering: 1300000 });
    expect(linesOf('ceiling_refused').some((one) => one.category === 'flowers')).toBe(false);
    expect(categoryGone('Flowers')).toBe('Flowers was removed, so its ceiling wasn’t saved.');
    expect(ceilingSentence(0, 0, 50000)).toBe('Nothing is costed here yet.');
    expect(ceilingOf('other', 50000, lines, heads).state).toBe('within');
    const raised = lines.map((one) => (one.id === 'dinner' ? { ...one, rate: 7600 } : one));
    expect(
      sumLines(
        raised.filter((one) => one.category === 'catering'),
        heads,
      ).ifAll,
    ).toBe(1303400);
    expect(sumLines(raised, heads).ifAll).toBeLessThan(
      ceilingsOf('rate_warning_category').whole ?? 0,
    );
  });

  it('says what a removed cost did to the total (sc-85)', () => {
    expect(removedWords(line('dj'), 90000)).toBe('DJ removed. The settled total fell by £900.');
    expect(removedWords(line('arch'), 0)).toBe(
      'Aisle arch removed. It had no price, so the total is the same.',
    );
    expect(removedWords(line('centre'), 0)).toBe(
      'Centrepieces removed. Nothing was counted for it yet, so the total is the same.',
    );
  });

  it('reads a currency’s own minor unit through the one parser, and works the margin out', () => {
    expect(ceilingProblem('20,000.555', 'KWD')).toBeNull();
    expect(ceilingProblem('20,000.5555', 'KWD')).toBe(
      'That has too many decimal places for this event’s currency. Enter the ceiling like 20,000.500.',
    );
    expect(ceilingProblem('640.5', 'JPY')).toContain('Enter the ceiling like 20,000.');
    expect(rateProblem('12.5', 'rate', 'JPY')).toContain('Enter the rate like 12.');
    const lines = linesOf('margin');
    const heads = headsOf('margin');
    expect(marginOf(lines, heads, MARKUPS)).toEqual({
      client: [2529600, 2929200],
      cost: [1973000, 2306000],
      margin: [556600, 623200],
      share: ['22.0%', '21.3%'],
    });
    expect(marginOf(lines, heads, { ...MARKUPS, event: 25 }).client).toEqual([2584750, 3001000]);
  });
});

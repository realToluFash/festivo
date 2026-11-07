import { describe, expect, it } from 'vitest';

import { COST_LINES, money, whole } from './budget.ts';
import {
  BUDGET_PAGES,
  CEILING_STATES,
  HOME_STATES,
  MARGIN_STATES,
  WEB_STATES,
  categoryCeilingsLine,
  ceilingOf,
  ceilingProblem,
  ceilingsOf,
  headsOf,
  lineAmounts,
  linesOf,
  markupProblem,
  rateProblem,
  removedWords,
  sumLines,
} from './budgetHome.ts';
import { ceilingSentence } from './budgetSample.ts';
import { TEMPLATES_PAGES } from './templates.ts';

const line = (id: string) => COST_LINES.find((one) => one.id === id) ?? COST_LINES[0]!;

describe('the Budget home’s states (spec §9)', () => {
  it('has every Web and Ceiling name, and the margin ones on the home', () => {
    expect(WEB_STATES).toHaveLength(26);
    expect(CEILING_STATES).toHaveLength(14);
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
      'The category ceilings come to £14,500.00, £7,500.00 less than the whole event’s.',
    );
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
});

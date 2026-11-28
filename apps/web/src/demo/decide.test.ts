import { describe, expect, it } from 'vitest';

import { HEADS, amounts, COST_LINES, totals } from './budget.ts';
import {
  DECIDE_PAGES,
  DECIDE_STATES,
  ceilingsFor,
  decideKindOf,
  exactWhole,
  groupsOf,
  headline,
  hugeWhatIf,
  linesFor,
  whatIf,
} from './decide.ts';

function ifAllOf(id: string): number {
  const line = COST_LINES.find((one) => one.id === id);

  return line == null ? 0 : amounts(line).ifAll;
}

describe('what a decision costs (sc-86, Budget-A-Ceiling row 4)', () => {
  it('links every state, and the two ways to no answer', () => {
    const linked = DECIDE_PAGES.flatMap((page) => page.states.map((state) => state.to)).join(' ');

    for (const state of DECIDE_STATES) expect(linked).toContain(`state=${state}`);
    expect(linked).toContain('as=kemi');
    expect(linked).toContain('fetch=failed');
  });

  it('moves only the upper figure, by 3 heads, and every figure adds up', () => {
    const answer = whatIf(3);

    expect(answer.delta).toBe(27000);
    expect(answer.moved).toEqual([
      { name: 'Dinner', category: 'catering', from: 904400, to: 924800, delta: 20400 },
      { name: 'Drinks package', category: 'catering', from: 292600, to: 299200, delta: 6600 },
    ]);
    expect(answer.moved.reduce((sum, one) => sum + one.delta, 0)).toBe(answer.delta);
    for (const one of answer.moved) expect(one.to - one.from).toBe(one.delta);
    expect(answer.moved[0]?.from).toBe(ifAllOf('dinner'));
    expect(answer.ifAll).toBe(totals().ifAll + answer.delta);
    expect(answer.ifAll).toBe(2333000);
    expect(answer.settled).toBe(totals().settled);
    expect([answer.headsFrom, answer.headsTo]).toEqual([HEADS.ifAllCome, 136]);
    expect(answer.overCeiling).toBe(true);
    expect(answer.unknown).toEqual([]);
    expect(answer.categoriesOver).toEqual([]);
  });

  it('adds the category’s line when the change takes Catering over its ceiling (sc-90)', () => {
    const answer = whatIf(3, linesFor('category'), ceilingsFor('category'));

    expect(decideKindOf('decide_category', null, null)).toBe('category');
    expect(answer.overCeiling).toBe(false);
    expect(answer.categoriesOver).toEqual([{ name: 'Catering', ifAll: 1224000, ceiling: 1200000 }]);
  });

  it('says what it can, and names a cost it moves with no price, never as £0', () => {
    const answer = whatIf(3, linesFor('unknown'));

    expect(answer.delta).toBe(20400);
    expect(answer.moved.map((one) => one.name)).toEqual(['Dinner']);
    expect(answer.unknown).toEqual(['Drinks package']);
    expect(answer.overCeiling).toBe(false);
  });

  it('moves nothing where no cost is counted per guest', () => {
    const answer = whatIf(3, linesFor('nochange'));

    expect(answer.delta).toBe(0);
    expect(answer.moved).toEqual([]);
    expect(answer.unknown).toEqual([]);
  });

  it('follows the companions: two fewer heads, two fewer rates', () => {
    expect(whatIf(1).delta).toBe(9000);
    expect(whatIf(4).delta).toBe(36000);
  });

  it('rounds the headline only for display, never to +£0', () => {
    expect(headline(27000)).toBe('£270');
    expect(headline(40)).toBe('£0.40');
  });

  it('gives no answer as Can edit or when the answer did not load', () => {
    expect(decideKindOf('decide_rise', 'kemi', null)).toBe('none');
    expect(decideKindOf('decide_rise', null, 'failed')).toBe('none');
    expect(decideKindOf('decide_updating', 'ana', null)).toBe('updating');
    expect(decideKindOf('decide_none', null, null)).toBe('none');
  });

  it('answers the huge event exactly, as sc-71226 bullet 5 (sc-72618)', () => {
    const answer = hugeWhatIf(1);

    expect(answer.delta).toBe(99999999999999999n);
    expect(answer.ifAll).toBe(10099999999999999899n);
    expect(answer.settled).toBe(9999999999999999900n);
    expect([answer.headsFrom, answer.headsTo]).toEqual([100, 101]);
    expect(exactWhole(answer.delta, 'en-US', true)).toBe('£1,000,000,000,000,000');
    expect(exactWhole(answer.ifAll, 'en-US')).toBe('£100,999,999,999,999,999');
    expect(exactWhole(answer.settled, 'en-US')).toBe('£99,999,999,999,999,999');
    expect(exactWhole(answer.settled, 'es-ES')).toBe('99.999.999.999.999.999\u00a0GBP');
  });

  it('rounds half up at any size, and under one unit in the minor unit (sc-72618)', () => {
    expect(exactWhole(10199999999999999849n, 'en-US')).toBe('£101,999,999,999,999,998');
    expect(exactWhole(10199999999999999850n, 'en-US')).toBe('£101,999,999,999,999,999');
    expect(exactWhole(40n, 'en-US', true)).toBe('£0.40');
    expect(exactWhole(27000n, 'en-US', true)).toBe('£270');
  });

  it('breaks a figure only after a group separator, its sign and code kept on', () => {
    expect(groupsOf('+£1,000,000')).toEqual(['+£1,', '000,', '000']);
    expect(groupsOf('99.999.999\u00a0GBP')).toEqual(['99.', '999.', '999\u00a0GBP']);
    expect(groupsOf('£270')).toEqual(['£270']);
  });
});

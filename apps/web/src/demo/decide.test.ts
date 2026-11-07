import { describe, expect, it } from 'vitest';

import { HEADS, amounts, COST_LINES, totals } from './budget.ts';
import { DECIDE_PAGES, DECIDE_STATES, decideKindOf, headline, linesFor, whatIf } from './decide.ts';

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
      { name: 'Dinner', from: 904400, to: 924800, delta: 20400 },
      { name: 'Drinks package', from: 292600, to: 299200, delta: 6600 },
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
});

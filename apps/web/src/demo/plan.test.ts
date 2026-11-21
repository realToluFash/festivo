import { describe, expect, it } from 'vitest';

import { plan } from './budget.ts';
import {
  AFTER,
  PLANNING_STATES,
  PLAN_PAGES,
  PLAN_STATES,
  acrossRows,
  afterPairs,
  fourOf,
  kindOf,
  planPairs,
  planRows,
  planningOf,
  printedLine,
  sampleOf,
  sheetFigures,
  shownOf,
  varianceWords,
} from './plan.ts';

const said = (state = 'plan') =>
  planRows(sampleOf(state)).map((row) => [
    row.name,
    row.facts.map((fact) => fact.words).join(' · '),
  ]);

describe('Against plan (sc-89, Budget-A-Plan)', () => {
  it('links every state from the demo home', () => {
    const linked = PLAN_PAGES.flatMap((page) => page.states.map((state) => state.to));

    for (const state of [...PLAN_STATES, ...PLANNING_STATES])
      expect(linked.join(' ')).toContain(`state=${state}&`.replace(/&$/u, ''));
  });

  it('keeps planned, committed, paid and still to pay apart, in whole units', () => {
    expect(planPairs()).toEqual([
      { label: 'Planned', figure: '£19,730', sub: '2 costs not priced yet' },
      { label: 'Committed', figure: '£18,900', sub: 'What the vendors quoted' },
      { label: 'Paid', figure: '£4,310', sub: '3 payments' },
      { label: 'Still to pay', figure: '£13,090', sub: '5 payments scheduled' },
    ]);
  });

  it('words each category as the board does, in the minor unit', () => {
    expect(said()).toEqual([
      ['Catering', 'Savour Kitchen · committed £9,000.00 · paid £0.00 · still to pay £7,500.00'],
      ['Venue', 'The Landmark · committed £6,300.00 · paid £3,150.00 · still to pay £3,150.00'],
      ['Flowers', 'Bloom & Co · committed £1,200.00 · £350.00 over, 41.2% · 1 cost not priced yet'],
      ['Photography', 'Lens & Light · committed £2,400.00 · paid £800.00 · matches'],
      ['Music', 'No quote'],
      ['Transport', 'No quote · 1 cost not priced yet'],
    ]);
    expect(planRows().map((row) => row.vendorId)).toEqual(['v4', 'v5', 'v3', 'v6', null, null]);
  });

  it('adds the category rows up exactly to the planned total', () => {
    const rows = planRows();

    expect(rows.reduce((sum, row) => sum + row.planned, 0)).toBe(plan().planned);
    expect(rows.map((row) => row.planned)).toEqual([864000, 630000, 85000, 240000, 90000, 64000]);
  });

  it('says Not known, never a variance, where a quote covers a cost not priced', () => {
    const unknown = planRows(sampleOf('plan_unknown'));

    expect(said('plan_unknown')[2]).toEqual([
      'Flowers',
      'Bloom & Co · Not known · 1 cost not priced yet',
    ]);
    expect(unknown[2]?.facts[1]).toEqual({ words: 'Not known', notKnown: true });
    expect(unknown[2]?.planned).toBe(85000);
  });

  it('tells over, under and level apart in words', () => {
    expect(varianceWords(120000, 85000)).toBe('£350.00 over, 41.2%');
    expect(varianceWords(80000, 100000)).toBe('£200.00 under, 20.0%');
    expect(varianceWords(240000, 240000)).toBe('matches');
    expect(varianceWords(5000, 0)).toBe('£50.00 over');
  });

  it('sets the planned per head beside what was paid to vendors per head of those who came', () => {
    expect(afterPairs()).toEqual([
      { label: 'Planned per head', figure: '£206', sub: 'settled, for the 96 who said yes' },
      { label: 'Paid to vendors, per head', figure: '£221', sub: 'for the 91 who came' },
      { label: 'Per head of the 96 who said yes', figure: '£210', sub: 'paid to vendors' },
      { label: 'Paid to vendors', figure: '£20,125', sub: 'Costs with no vendor are not in it' },
    ]);
    expect(Math.round(AFTER.paidToVendors / AFTER.came)).toBe(22115);
  });

  it('prints the client’s figures only, in the minor unit, on the 24-hour clock', () => {
    expect(printedLine()).toBe('Printed Tue, Nov 3, 2026 at 09:41 · client figures only');
    expect(sheetFigures()).toEqual([
      { label: 'Planned', amount: '£19,730.00' },
      { label: 'Committed', amount: '£18,900.00' },
      { label: 'Paid', amount: '£4,310.00' },
      { label: 'Still to pay', amount: '£13,090.00' },
    ]);
  });

  it('opens each state as its kind', () => {
    expect(['plan', 'plan_unknown', 'plan_after', 'plan_unrecorded'].map(kindOf)).toEqual([
      'during',
      'unknown',
      'after',
      'unrecorded',
    ]);
  });

  it('opens every page state as figures, and the system states as themselves', () => {
    expect(
      ['plan', 'plan_empty', 'plan_loading', 'plan_failed', 'planning_not_live'].map(shownOf),
    ).toEqual(['figures', 'empty', 'loading', 'failed', 'notLive']);
  });
});

describe('Quotes not wholly in one category (sc-89, plan_across)', () => {
  const sample = sampleOf('plan_across');

  it('takes a quote over three categories and one over no cost out of every category', () => {
    expect(said('plan_across').map(([name]) => name)).toEqual([
      'Venue',
      'Flowers',
      'Photography',
      'Music',
      'Transport',
    ]);
  });

  it('gives each its categories, its four figures and its Against plan, by vendor name', () => {
    expect(
      acrossRows(sample).map((row) => [
        row.vendor,
        row.categories,
        row.planned,
        row.figures,
        row.against.map((fact) => fact.words).join(' · '),
      ]),
    ).toEqual([
      [
        'Glow Lighting',
        'Covers no budget line',
        null,
        'committed £1,500.00 · paid £500.00 · still to pay £1,000.00',
        'Nothing planned against it',
      ],
      [
        'Savour Kitchen',
        'Catering · Staffing · Hire',
        984000,
        'committed £9,000.00 · paid £0.00 · still to pay £7,500.00',
        'Not known · 1 cost not priced yet',
      ],
    ]);
  });

  it('names each cost’s category under its quote, and never splits the quote over them', () => {
    expect(acrossRows(sample)[1]?.costs.map((cost) => [cost.line, cost.state])).toEqual([
      ['Catering · £68.00 a head × 96 · said yes, from the guest list', 'priced'],
      ['Catering · £22.00 a head × 96 · said yes, from the guest list', 'priced'],
      ['Staffing · A fixed amount', 'priced'],
      ['Hire · No price yet', 'notPriced'],
    ]);
  });

  it('adds the category rows and the quote rows up exactly to the event’s figures and count', () => {
    const four = fourOf(sample);
    const rows = planRows(sample);
    const across = acrossRows(sample);
    const planned =
      rows.reduce((sum, row) => sum + row.planned, 0) +
      across.reduce((sum, row) => sum + (row.planned ?? 0), 0);

    expect(planned).toBe(four.planned);
    expect(four).toEqual({
      planned: 2093000,
      committed: 2040000,
      paid: 481000,
      stillToPay: 1409000,
      notPriced: 3,
    });
    expect(across.reduce((sum, row) => sum + row.notPriced, 0)).toBe(1);
  });
});

describe('Nobody has said yes (sc-89)', () => {
  it('words a quote over a plan of £0 as the amount alone, with no proportion', () => {
    expect(said('plan_zero_heads')[0]).toEqual([
      'Catering',
      'Savour Kitchen · committed £9,000.00 · paid £0.00 · still to pay £7,500.00 · £9,000.00 over',
    ]);
  });

  it('after the event, leaves the per head of those who said yes out and says why', () => {
    const pairs = afterPairs(sampleOf('plan_after_no_yes'), true);

    expect(pairs.map((pair) => pair.label)).toEqual([
      'Planned per head',
      'Paid to vendors, per head',
      'Paid to vendors',
    ]);
    expect(pairs[0]).toEqual({
      label: 'Planned per head',
      figure: 'No figure yet',
      sub: 'Nobody has said yes',
    });
  });

  it('with attendance not recorded either, keeps only the amount paid to vendors', () => {
    expect(
      afterPairs(sampleOf('plan_unrecorded_no_yes'), false).map((pair) => pair.figure),
    ).toEqual(['No figure yet', '£20,125']);
    expect(afterPairs(sampleOf('plan_unrecorded'), false).map((pair) => pair.label)).toEqual([
      'Planned per head',
      'Per head of the 96 who said yes',
      'Paid to vendors',
    ]);
  });
});

describe('What it will cost, the planning tier (sc-89)', () => {
  it('reads sc-84’s range, the count and per head both ways', () => {
    const read = planningOf(sampleOf('planning'));

    expect(read.range).toBe('£19,730 to £23,060');
    expect(read.notPriced).toBe(2);
    expect(read.pairs).toEqual([
      { label: 'Per head, settled', figure: '£206', sub: 'for the 96 who said yes' },
      {
        label: 'Per head, if all come',
        figure: '£173',
        sub: 'for 133: everybody who said yes, is still to answer or is held',
      },
    ]);
  });

  it('lists every cost under its category, and no category subtotal', () => {
    const read = planningOf(sampleOf('planning'));

    expect(read.categories.map((one) => [one.name, one.costs.length])).toEqual([
      ['Catering', 2],
      ['Venue', 1],
      ['Flowers', 3],
      ['Photography', 1],
      ['Music', 1],
      ['Transport', 2],
    ]);
    expect(Object.keys(read.categories[0] ?? {})).not.toContain('planned');
  });

  it('says No figure yet for the settled per head while nobody has said yes, never £0', () => {
    expect(planningOf(sampleOf('planning_zero_heads')).pairs[0]).toEqual({
      label: 'Per head, settled',
      figure: 'No figure yet',
      sub: 'Nobody has said yes',
    });
  });
});

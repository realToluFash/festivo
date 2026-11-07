import { describe, expect, it } from 'vitest';

import { plan } from './budget.ts';
import {
  AFTER,
  PLAN_PAGES,
  PLAN_STATES,
  afterPairs,
  kindOf,
  planPairs,
  planRows,
  printedLine,
  sheetFigures,
  varianceWords,
} from './plan.ts';

const said = (unknown = false) =>
  planRows(unknown).map((row) => [row.name, row.facts.map((fact) => fact.words).join(' · ')]);

describe('Against plan (sc-89, Budget-A-Plan)', () => {
  it('links every state from the demo home', () => {
    const linked = PLAN_PAGES.flatMap((page) => page.states.map((state) => state.to));

    for (const state of PLAN_STATES) expect(linked.join(' ')).toContain(`state=${state}`);
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
      ['Flowers', 'Bloom & Co · committed £1,200.00 · £350.00 over, 41.2%'],
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
    expect(said(true)[2]).toEqual(['Flowers', 'Bloom & Co · Not known · 1 cost not priced yet']);
    expect(planRows(true)[2]?.facts[1]).toEqual({ words: 'Not known', notKnown: true });
    expect(planRows(true)[2]?.planned).toBe(85000);
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
});

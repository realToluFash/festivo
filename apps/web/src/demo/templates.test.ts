import { describe, expect, it } from 'vitest';

import {
  LONG_NAME,
  SOURCES,
  TEMPLATES_PAGES,
  TEMPLATES_STATES,
  calibrationBlocks,
  learnedRow,
  nameProblem,
  nameTaken,
  previewOf,
  sourceLine,
  sourceOf,
  vendorPaid,
} from './templates.ts';

const rowsOf = (kind: 'few' | 'three') =>
  calibrationBlocks(kind).map((block) =>
    block.categories.map((one) => learnedRow(one, block.currency)),
  );

describe('templates and calibration (sc-96, Budget-A-Templates)', () => {
  it('links each state, and Save as template’s three on Budget, which are not this page’s', () => {
    const linked = TEMPLATES_PAGES.flatMap((page) => page.states.map((state) => state.to)).join(
      ' ',
    );

    for (const state of TEMPLATES_STATES) expect(linked).toContain(`state=${state}`);
    for (const state of ['save_taken', 'save_blank', 'save_long']) {
      expect(linked).toContain(`state=${state}`);
      expect(TEMPLATES_STATES).not.toContain(state);
    }
    expect(TEMPLATES_STATES).not.toContain('nothing_to_start');
  });

  it('lists the same type first, each with what it brings', () => {
    expect(SOURCES.map((one) => [one.name, sourceLine(one)])).toEqual([
      ['Wedding, London', 'A template · 9 costs · in pounds'],
      ['Rafael & Inês’s wedding', 'Sat, Oct 17 · Lisbon · 11 costs · in euros'],
      ['Chidi’s 30th', 'Sat, Sep 26 · London · 6 costs · in pounds'],
      ['Ire Events summer party', 'Sat, Aug 22 · London · 8 costs · in pounds'],
    ]);
    expect(SOURCES.filter((one) => one.wedding)).toHaveLength(2);
  });

  it('brings a source in euros across unpriced, never converted', () => {
    const preview = previewOf(sourceOf('start_from'));

    expect(preview.line).toBe('11 costs, priced in euros. Nothing is converted.');
    expect(preview.rows.map((row) => [row.name, row.line, row.value])).toEqual(
      ['Dinner', 'Room hire', 'Photographer'].map((name) => [
        name,
        'Priced in EUR on Rafael & Inês’s wedding. Enter a price in GBP.',
        null,
      ]),
    );
  });

  it('brings a template’s rates, never its counts, in the minor unit', () => {
    expect(previewOf(sourceOf('start_template'))).toEqual({
      line: 'A template · 9 costs and their rates, in pounds.',
      rows: [
        { name: 'Dinner', line: 'Per head', value: '£64.00 a head' },
        { name: 'Room hire', line: 'Per day', value: '£1,900.00 a day' },
        { name: 'Photographer', line: 'A fixed amount', value: '£2,200.00' },
      ],
    });
  });

  it('says what a cost came to in whole units, and why the others keep their rate', () => {
    expect(previewOf(sourceOf('start_actual')).rows).toEqual([
      {
        name: 'Dinner',
        line: 'From Chidi’s 30th, where this came to £66 a head against £62 planned.',
        value: '£66.00 a head',
      },
      {
        name: 'Drinks package',
        line: 'At its planned rate: its quote covered several costs.',
        value: '£20.00 a head',
      },
      { name: 'Cake', line: 'At its planned rate: nothing was paid against it.', value: '£280.00' },
      { name: 'DJ', line: 'At its planned rate: it had no quote.', value: '£850.00' },
    ]);
    expect(previewOf(sourceOf('start_not_over')).line).toBe(
      'Not over yet, so every cost comes at its planned rate.',
    );
  });

  it('names how many events each figure rests on, in whole units, per currency', () => {
    expect(rowsOf('few')).toEqual([
      [
        {
          name: 'Catering',
          line: 'Planned £14,200 · paid £15,050 · From 2 events, so not a pattern yet.',
          value: '£850 over, 6.0%',
        },
        {
          name: 'Flowers',
          line: 'Planned £2,100 · paid £2,280 · From 2 events, so not a pattern yet.',
          value: '£180 over, 8.6%',
        },
        {
          name: 'Venue',
          line: 'Planned £11,000 · paid £11,000 · From 2 events, so not a pattern yet.',
          value: 'Matches',
        },
      ],
      [
        {
          name: 'Catering',
          line: 'Planned €9,800 · paid €10,240 · From 1 event, so not a pattern yet.',
          value: '€440 over, 4.5%',
        },
      ],
    ]);
    expect(rowsOf('three')[0]?.[0]?.line).toBe('Planned £14,200 · paid £15,050 · From 3 events.');
    expect(calibrationBlocks('few')[0]?.vendors.map(vendorPaid)).toEqual([
      '£18,400',
      '£2,600 and €2,200',
    ]);
    expect(calibrationBlocks('empty')).toEqual([]);
  });

  it('refuses a blank or long name before sending, and a taken one ignoring case', () => {
    expect(nameProblem('  ')).toBe('blank');
    expect(LONG_NAME.length).toBeGreaterThan(80);
    expect(nameProblem(LONG_NAME)).toBe('long');
    expect(nameProblem('x'.repeat(80))).toBeNull();
    expect(nameTaken('wedding, london')).toBe(true);
    expect(nameTaken(' WEDDING, LONDON ')).toBe(true);
    expect(nameTaken('Wedding, Lisbon')).toBe(false);
  });
});

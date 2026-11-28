import { describe, expect, it } from 'vitest';

import { cssRule, stylesheet } from '../test-styles.ts';

const STATIONS = stylesheet(import.meta.dirname, 'stations.css');
const JOBS = stylesheet(import.meta.dirname, 'jobsShifts.css');

describe("the Staff page's layout in the demo (sc-3908, sc-3910)", () => {
  it('keeps the breadcrumb and the header their full height on every Staff tab, so neither runs under what follows (sc-99786)', () => {
    expect(cssRule('.sn :is(.ev-crumb-row, .gs-top)', STATIONS)).toContain('flex: none;');
  });

  it('stacks a shift’s date over its time when narrow', () => {
    const narrow = JOBS.slice(JOBS.indexOf('@media (width <= 720px)'));
    expect(cssRule('.js-when-pair', narrow)).toContain('grid-template-columns: minmax(0, 1fr);');
  });
});

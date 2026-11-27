import { describe, expect, it } from 'vitest';

import { cssRule, stylesheet } from '../test-styles.ts';

const STATIONS = stylesheet(import.meta.dirname, 'stations.css');
const JOBS = stylesheet(import.meta.dirname, 'jobsShifts.css');

describe("the Staff page's layout in the demo (sc-3908, sc-3910)", () => {
  it('keeps the header its full height on every Staff tab, so the tabs sit 12px under the subtitle', () => {
    expect(cssRule('.sn .gs-top', STATIONS)).toContain('flex: none;');
  });

  it('stacks a shift’s date over its time when narrow', () => {
    const narrow = JOBS.slice(JOBS.indexOf('@media (width <= 720px)'));
    expect(cssRule('.js-when-pair', narrow)).toContain('grid-template-columns: minmax(0, 1fr);');
  });
});

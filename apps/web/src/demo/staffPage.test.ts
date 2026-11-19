import { describe, expect, it } from 'vitest';

import { cssRule, stylesheet } from '../test-styles.ts';

const ROSTER = stylesheet(import.meta.dirname, 'roster.css');
const JOBS = stylesheet(import.meta.dirname, 'jobsShifts.css');

describe("the Staff page's layout in the demo (sc-3908)", () => {
  it('keeps the header its full height, so the tabs sit 12px under the subtitle', () => {
    expect(cssRule('.rs .gs-top', ROSTER)).toContain('flex: none;');
  });

  it('stacks a shift’s date over its time when narrow', () => {
    const narrow = JOBS.slice(JOBS.indexOf('@media (width <= 720px)'));
    expect(cssRule('.js-when-pair', narrow)).toContain('grid-template-columns: minmax(0, 1fr);');
  });
});

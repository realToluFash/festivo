import { describe, expect, it } from 'vitest';

import { briefingDock } from './briefingDock.ts';

describe('the staff briefing on a tablet on its side', () => {
  it('docks at the right edge and keeps the roster beside it', () => {
    expect(briefingDock('tabletLandscape', 820)).toEqual({
      docked: true,
      rosterBeside: true,
      fills: true,
      maxHeight: null,
    });
  });
});

describe('the staff briefing on a tablet upright', () => {
  it.each([
    [1180, 640],
    [700, 540],
  ])('in a %i pt window the dialog is capped at %i pt', (height, cap) => {
    expect(briefingDock('tabletPortrait', height).maxHeight).toBe(cap);
  });

  it('is a dialog that sizes to its content, not a docked panel', () => {
    const dock = briefingDock('tabletPortrait', 1180);

    expect(dock.docked).toBe(false);
    expect(dock.rosterBeside).toBe(false);
    expect(dock.fills).toBe(false);
  });
});

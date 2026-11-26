import { describe, expect, it } from 'vitest';

import { headLabel, rowLabel } from './needsYou.ts';

describe('what a screen reader says', () => {
  it('reads the heading with its count', () => {
    expect(headLabel(1)).toBe('Needs you, 1 thing');
    expect(headLabel(4)).toBe('Needs you, 4 things');
  });

  it('reads a row as one button, the due words saying it is overdue', () => {
    expect(
      rowLabel({
        title: 'Give final numbers to the kitchen',
        event: { id: 'e', name: 'Ade’s 40th', mesh: 'rose', photo: null },
        due: '2 days overdue',
      }),
    ).toBe('Give final numbers to the kitchen, Ade’s 40th, 2 days overdue');
  });
});

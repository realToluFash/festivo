import { describe, expect, it } from 'vitest';

import { bandMomentOf } from './bandTitleRules.ts';

describe('the board’s choices', () => {
  it('falls back to a day with no event', () => {
    expect(bandMomentOf('day')).toBe('day');
    expect(bandMomentOf(undefined)).toBe('quiet');
    expect(bandMomentOf('now')).toBe('quiet');
  });
});

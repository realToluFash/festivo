import { describe, expect, it } from 'vitest';

import { chosenIn } from './showSizeRules.ts';

describe('chosenIn', () => {
  it('keeps a choice the rows still offer', () => {
    expect(chosenIn('main', 'events')).toBe('events');
    expect(chosenIn('needs', 'needs')).toBe('needs');
  });

  it('falls back to the first row when its row is gone', () => {
    expect(chosenIn('main', 'needs')).toBe('all');
  });
});

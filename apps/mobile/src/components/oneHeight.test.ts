import { describe, expect, it } from 'vitest';

import { reportHeight, tallestAt } from './oneHeight.ts';

describe('reportHeight', () => {
  it('keeps the tallest at one text size', () => {
    const now = [48, 90, 60].reduce((tallest, h) => reportHeight(tallest, 'a', h), {
      at: 'a',
      height: 0,
    });

    expect(tallestAt(now, 'a')).toBe(90);
  });

  it('forgets the tallest once the text size changes, so the buttons can shrink', () => {
    const now = reportHeight({ at: 'a', height: 90 }, 'b', 48);

    expect(tallestAt({ at: 'a', height: 90 }, 'b')).toBeUndefined();
    expect(tallestAt(now, 'b')).toBe(48);
  });
});

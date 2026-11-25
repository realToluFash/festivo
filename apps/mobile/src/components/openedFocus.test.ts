import { describe, expect, it } from 'vitest';

import { openedFocus, takesArrivedFocus } from './openedFocus.ts';

describe('a field a sliding Android window opens with takes typing at once (sc-91027)', () => {
  it('waits for the window to arrive when it opens focused while the window slides in', () => {
    expect(openedFocus(true, true)).toBe('arrived');
  });

  it('takes focus at mount anywhere else: an iPhone, a tablet, a field drawn once the window is up', () => {
    expect(openedFocus(true, false)).toBe('mount');
    expect(openedFocus(false, true)).toBe('mount');
    expect(openedFocus(undefined, true)).toBe('mount');
  });

  it('takes its focus once the window has arrived', () => {
    expect(takesArrivedFocus('arrived', true, null)).toBe(false);
    expect(takesArrivedFocus('arrived', false, null)).toBe(true);
    expect(takesArrivedFocus('arrived', false, undefined)).toBe(true);
  });

  it('leaves focus where a tap put it before the window arrived', () => {
    expect(takesArrivedFocus('arrived', false, { name: 'tapped' })).toBe(false);
  });

  it('moves nothing for a field that took its focus at mount', () => {
    expect(takesArrivedFocus('mount', false, null)).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';

import { stillTouch } from './stillTouch.ts';

describe('stillTouch', () => {
  it('takes a touch that lifts where it landed as a tap', () => {
    expect(stillTouch({ pageX: 40, pageY: 300 }, { pageX: 42, pageY: 303 })).toBe(true);
  });

  it('takes a drag down past the top as no tap', () => {
    expect(stillTouch({ pageX: 40, pageY: 300 }, { pageX: 40, pageY: 380 })).toBe(false);
  });

  it('takes a drag up past the foot as no tap', () => {
    expect(stillTouch({ pageX: 40, pageY: 300 }, { pageX: 41, pageY: 289 })).toBe(false);
  });

  it('takes a press with no place, as a screen reader sends, as a tap', () => {
    expect(stillTouch(null, {})).toBe(true);
    expect(stillTouch({ pageX: 40, pageY: 300 }, {})).toBe(true);
  });
});

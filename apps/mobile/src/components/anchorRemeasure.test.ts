import { describe, expect, it } from 'vitest';

import { remeasureAfter } from './anchorRemeasure.ts';

const SETTLED = 500;
const UPRIGHT = { width: 820, height: 1180, bodyTop: 64 };

describe('remeasureAfter', () => {
  it('waits for a turned window to settle', () => {
    expect(remeasureAfter(UPRIGHT, { width: 1180, height: 820, bodyTop: 64 }, true, SETTLED)).toBe(
      SETTLED,
    );
  });

  it('measures at once when the offline band moves the body (sc-83081)', () => {
    expect(remeasureAfter(UPRIGHT, { ...UPRIGHT, bodyTop: 92 }, true, SETTLED)).toBe(0);
    expect(remeasureAfter({ ...UPRIGHT, bodyTop: 92 }, UPRIGHT, true, SETTLED)).toBe(0);
  });

  it('waits for the settle when a turn and the band come together', () => {
    expect(remeasureAfter(UPRIGHT, { width: 1180, height: 820, bodyTop: 92 }, true, SETTLED)).toBe(
      SETTLED,
    );
  });

  it('leaves a closed menu alone', () => {
    expect(remeasureAfter(UPRIGHT, { ...UPRIGHT, bodyTop: 92 }, false, SETTLED)).toBeNull();
  });

  it('leaves an open menu alone when nothing moved', () => {
    expect(remeasureAfter(UPRIGHT, { ...UPRIGHT }, true, SETTLED)).toBeNull();
  });
});

import { describe, expect, it, vi } from 'vitest';

import { landingToastAt, landingToastTop, watchLandingToastTop } from './landingToastTop.ts';

describe('where the landing toast covers a step (sc-37983)', () => {
  it('tells a lift each time it moves, shows or goes, and not when it stays', () => {
    const moved = vi.fn();
    const unwatch = watchLandingToastTop(moved);

    landingToastAt(640);
    landingToastAt(640);
    landingToastAt(null);
    unwatch();
    landingToastAt(600);

    expect(moved).toHaveBeenCalledTimes(2);
    expect(landingToastTop()).toBe(600);

    landingToastAt(null);
  });
});

import { describe, expect, it } from 'vitest';

import { pageTakesBack } from './systemBack.ts';

describe('pageTakesBack', () => {
  it('takes Back where the page shows in place of its list', () => {
    expect(pageTakesBack('phone', true)).toBe(true);
    expect(pageTakesBack('tabletPortrait', true)).toBe(true);
  });

  it('leaves Back alone on the list, and where list and page show side by side', () => {
    expect(pageTakesBack('phone', false)).toBe(false);
    expect(pageTakesBack('tabletPortrait', false)).toBe(false);
    expect(pageTakesBack('tabletLandscape', true)).toBe(false);
  });
});

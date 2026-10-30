import { describe, expect, it } from 'vitest';

import {
  OPENED_IN_PLACE_OF_SETTINGS,
  pageTakesBack,
  sectionTakesBack,
  swipedBack,
} from './systemBack.ts';

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

describe('sectionTakesBack', () => {
  it('takes Back on a section the tablet list opened in its own place', () => {
    expect(sectionTakesBack(OPENED_IN_PLACE_OF_SETTINGS)).toBe(true);
  });

  it('leaves Back to the stack on a section pushed over the list, or opened from Home or another section', () => {
    expect(sectionTakesBack(undefined)).toBe(false);
    expect(sectionTakesBack('')).toBe(false);
  });
});

describe('swipedBack', () => {
  it('takes the pop the iOS edge swipe dispatches', () => {
    expect(swipedBack({ type: 'POP' })).toBe(true);
  });

  it('lets a tab, a link and a page going back by itself leave the screen', () => {
    expect(swipedBack({ type: 'GO_BACK' })).toBe(false);
    expect(swipedBack({ type: 'POP_TO' })).toBe(false);
    expect(swipedBack({ type: 'NAVIGATE' })).toBe(false);
    expect(swipedBack({ type: 'RESET' })).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';

import {
  OPENED_IN_PLACE_OF_SETTINGS,
  edgeSwipeCompletes,
  edgeSwipeStarts,
  pageTakesBack,
  sectionTakesBack,
  stackSwipes,
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

describe('stackSwipes', () => {
  it('swipes back where a back is drawn, in the header or the body', () => {
    expect(stackSwipes({}, false, false)).toBe(true);
    expect(stackSwipes(undefined, true, false)).toBe(true);
  });

  it('does nothing where no back is drawn, as on Home, the Events list or a section beside Settings', () => {
    expect(stackSwipes(undefined, false, false)).toBe(false);
  });

  it('does nothing while the back is off, or once the page in front has taken the swipe', () => {
    expect(stackSwipes({ off: true }, false, false)).toBe(false);
    expect(stackSwipes({}, false, true)).toBe(false);
    expect(stackSwipes(undefined, true, true)).toBe(false);
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

describe('edgeSwipeStarts', () => {
  it('starts on a drag that moves across to the right', () => {
    expect(edgeSwipeStarts(20, 3)).toBe(true);
  });

  it('leaves a vertical drag, a drag to the left and a touch that barely moves', () => {
    expect(edgeSwipeStarts(20, 30)).toBe(false);
    expect(edgeSwipeStarts(-20, 0)).toBe(false);
    expect(edgeSwipeStarts(4, 0)).toBe(false);
  });
});

describe('edgeSwipeCompletes', () => {
  it('completes past half the width, or on a flick to the right', () => {
    expect(edgeSwipeCompletes(201, 0, 400)).toBe(true);
    expect(edgeSwipeCompletes(40, 1, 400)).toBe(true);
  });

  it('stays on the page when let go short of half and slowly, or pulled back', () => {
    expect(edgeSwipeCompletes(199, 0.2, 400)).toBe(false);
    expect(edgeSwipeCompletes(150, -1, 400)).toBe(false);
    expect(edgeSwipeCompletes(-5, 1, 400)).toBe(false);
  });
});

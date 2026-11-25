import { describe, expect, it } from 'vitest';

import {
  ARRIVED_FOCUS_TRIES,
  type ArrivedFocus,
  arrivedFocusStep,
  heldByAnother,
  openedFocus,
  windowArrival,
} from './openedFocus.ts';

const waiting: ArrivedFocus = {
  opened: 'arrived',
  arrival: 'arrived',
  focusedOnce: false,
  heldElsewhere: false,
  tries: 0,
};

describe('a field a sliding Android window opens with takes typing at once (sc-91027)', () => {
  it('waits for the window when it opens focused in one that slides in, whether it mounts as the window slides or after', () => {
    expect(openedFocus(true, 'arriving')).toBe('arrived');
    expect(openedFocus(true, 'arrived')).toBe('arrived');
  });

  it('takes focus at mount anywhere else: an iPhone, a tablet, a field that does not open focused', () => {
    expect(openedFocus(true, 'still')).toBe('mount');
    expect(openedFocus(false, 'arriving')).toBe('mount');
    expect(openedFocus(undefined, 'arriving')).toBe('mount');
  });

  it('reads a window that does not slide in as still, and one that does as arriving until it has', () => {
    expect(windowArrival(false, false)).toBe('still');
    expect(windowArrival(true, true)).toBe('arriving');
    expect(windowArrival(true, false)).toBe('arrived');
  });

  it('sends focus once the window has arrived, and not while it slides', () => {
    expect(arrivedFocusStep({ ...waiting, arrival: 'arriving' })).toBe('wait');
    expect(arrivedFocusStep(waiting)).toBe('focus');
  });

  it('sends it again until Android says the field has it, a few times at most', () => {
    expect(arrivedFocusStep({ ...waiting, tries: 1 })).toBe('focus');
    expect(arrivedFocusStep({ ...waiting, tries: ARRIVED_FOCUS_TRIES - 1 })).toBe('focus');
    expect(arrivedFocusStep({ ...waiting, tries: ARRIVED_FOCUS_TRIES })).toBe('done');
    expect(arrivedFocusStep({ ...waiting, tries: 1, focusedOnce: true })).toBe('done');
  });

  it('leaves focus where a tap put it, on this field or another', () => {
    expect(arrivedFocusStep({ ...waiting, arrival: 'arriving', focusedOnce: true })).toBe('done');
    expect(arrivedFocusStep({ ...waiting, heldElsewhere: true })).toBe('done');
  });

  it('moves nothing for a field that took its focus at mount', () => {
    expect(arrivedFocusStep({ ...waiting, opened: 'mount' })).toBe('done');
  });

  it('counts a field gone from the screen, or JS counting this field as focused, as holding nothing', () => {
    const field = { isConnected: true };

    expect(heldByAnother(null, field)).toBe(false);
    expect(heldByAnother(undefined, field)).toBe(false);
    expect(heldByAnother(field, field)).toBe(false);
    expect(heldByAnother({ isConnected: false }, field)).toBe(false);
    expect(heldByAnother({ isConnected: true }, field)).toBe(true);
  });
});

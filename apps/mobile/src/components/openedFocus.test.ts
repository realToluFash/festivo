import { describe, expect, it } from 'vitest';

import {
  ARRIVED_FOCUS_TICKS,
  type ArrivedFocus,
  arrivedFocusStep,
  openedFocus,
  windowArrival,
} from './openedFocus.ts';

const waiting: ArrivedFocus = {
  opened: 'arrived',
  arrival: 'arrived',
  focused: false,
  heldElsewhere: false,
  readerOn: false,
  ticks: 0,
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

  it('sends it again on each tick Android says the field does not have it, and keeps it while it does', () => {
    expect(arrivedFocusStep({ ...waiting, ticks: 1 })).toBe('focus');
    expect(arrivedFocusStep({ ...waiting, ticks: 1, focused: true })).toBe('hold');
    expect(arrivedFocusStep({ ...waiting, ticks: 2 })).toBe('focus');
  });

  it('stops after a few seconds, focused or not', () => {
    expect(arrivedFocusStep({ ...waiting, ticks: ARRIVED_FOCUS_TICKS - 1 })).toBe('focus');
    expect(arrivedFocusStep({ ...waiting, ticks: ARRIVED_FOCUS_TICKS })).toBe('done');
    expect(arrivedFocusStep({ ...waiting, ticks: ARRIVED_FOCUS_TICKS, focused: true })).toBe(
      'done',
    );
  });

  it('leaves focus where a tap put it, on this field or another', () => {
    expect(arrivedFocusStep({ ...waiting, arrival: 'arriving', focused: true })).toBe('done');
    expect(arrivedFocusStep({ ...waiting, heldElsewhere: true })).toBe('done');
    expect(arrivedFocusStep({ ...waiting, ticks: 3, heldElsewhere: true })).toBe('done');
  });

  it('sends focus once with a screen reader on, so the reader stays on the title (qa #91929)', () => {
    const reading = { ...waiting, readerOn: true };
    expect(arrivedFocusStep({ ...reading, arrival: 'arriving' })).toBe('wait');
    expect(arrivedFocusStep(reading)).toBe('focus');
    expect(arrivedFocusStep({ ...reading, ticks: 1 })).toBe('done');
  });

  it('moves nothing for a field that took its focus at mount', () => {
    expect(arrivedFocusStep({ ...waiting, opened: 'mount' })).toBe('done');
  });
});

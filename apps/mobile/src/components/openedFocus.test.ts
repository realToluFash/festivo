import { describe, expect, it } from 'vitest';

import {
  ARRIVED_FOCUS_TICKS,
  type ArrivedFocus,
  arrivedFocusStep,
  openedFocus,
  settledFocus,
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

  it('sends no focus with a screen reader on, so the reader stays on the title (qa #91929, #92173)', () => {
    const reading = { ...waiting, readerOn: true };
    expect(arrivedFocusStep({ ...reading, arrival: 'arriving' })).toBe('done');
    expect(arrivedFocusStep(reading)).toBe('done');
    expect(arrivedFocusStep({ ...reading, ticks: 1 })).toBe('done');
  });

  it('moves nothing for a field that took its focus at mount', () => {
    expect(arrivedFocusStep({ ...waiting, opened: 'mount' })).toBe('done');
  });
});

describe('Add a phone number takes digits with no tap once it has settled (sc-91027)', () => {
  it('waits for a sliding window to arrive, not for a timer whose focus Android loses', () => {
    expect(settledFocus(true, 'arriving')).toBe('arrival');
    expect(settledFocus(true, 'arrived')).toBe('arrival');
  });

  it('keeps its timer on an iPhone and a tablet, and does nothing for a number that does not open focused', () => {
    expect(settledFocus(true, 'still')).toBe('timer');
    expect(settledFocus(false, 'arriving')).toBe('none');
  });
});

describe('a field sends no focus before the device says whether a screen reader is on (sc-91027)', () => {
  it('waits for the answer in an arrived window, then sends focus only with no reader on', () => {
    expect(arrivedFocusStep({ ...waiting, readerOn: null })).toBe('wait');
    expect(arrivedFocusStep({ ...waiting, readerOn: true })).toBe('done');
    expect(arrivedFocusStep({ ...waiting, readerOn: false })).toBe('focus');
  });
});

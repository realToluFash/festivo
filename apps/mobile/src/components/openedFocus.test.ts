import { describe, expect, it } from 'vitest';

import {
  ARRIVED_FOCUS_TICKS,
  type ArrivedFocus,
  arrivedFocusStep,
  holdsMountFocus,
  type MountedKeys,
  KEYS_RAISE_AFTER_TICKS,
  mountedKeys,
  mountedKeysStep,
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

describe('on an Android tablet, a field that opens focused puts its keys up with no tap (sc-92467)', () => {
  const mounted: MountedKeys = {
    held: true,
    heldElsewhere: false,
    readerOn: false,
    touched: false,
    ticks: KEYS_RAISE_AFTER_TICKS,
  };

  it('holds the focus back at mount, so no early keys come up for Back to meet before the raise (qa #99147)', () => {
    expect(holdsMountFocus('android', 'mount', true, false)).toBe(true);
  });

  it('leaves focus at mount with a screen reader on or not yet known', () => {
    expect(holdsMountFocus('android', 'mount', true, true)).toBe(false);
    expect(holdsMountFocus('android', 'mount', true, null)).toBe(false);
  });

  it('leaves an iPhone or iPad, a field that waited for its window, and one that does not open focused', () => {
    expect(holdsMountFocus('ios', 'mount', true, false)).toBe(false);
    expect(holdsMountFocus('android', 'arrived', true, false)).toBe(false);
    expect(holdsMountFocus('android', 'mount', undefined, false)).toBe(false);
    expect(mountedKeysStep({ ...mounted, held: false })).toBe('done');
  });

  it('raises the keys a while after mount, as Android drops an early raise (qa #97238)', () => {
    expect(mountedKeysStep({ ...mounted, ticks: KEYS_RAISE_AFTER_TICKS - 1 })).toBe('tick');
    expect(mountedKeysStep(mounted)).toBe('raise');
  });

  it('raises them once and never again, so Back, which leaves the field focused, keeps them down (qa #98098)', () => {
    const step = mountedKeys(true);
    const sent = Array.from({ length: ARRIVED_FOCUS_TICKS }, (_, ticks) =>
      step({ ...mounted, ticks }),
    );
    expect(sent.filter((s) => s === 'raise')).toHaveLength(1);
    expect(sent.at(-1)).toBe('done');
  });

  it('raises nothing once a person has pressed this field or another, even after they leave it', () => {
    for (const pressed of [{ touched: true }, { heldElsewhere: true }]) {
      const step = mountedKeys(true);
      expect(step({ ...mounted, ...pressed, ticks: 1 })).toBe('done');
      expect(step(mounted)).toBe('done');
    }
  });

  it('waits for the screen reader to be known, and raises nothing with one on', () => {
    expect(mountedKeysStep({ ...mounted, readerOn: null })).toBe('wait');
    expect(mountedKeysStep({ ...mounted, readerOn: true })).toBe('done');
  });
});

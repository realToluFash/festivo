import { createContext } from 'react';

/** Where the window a field is drawn in stands: one that does not slide in on an Android phone, or one that does, still sliding or arrived. A field focused while its window slides in never takes focus, and the keys come up over it with nowhere to type (sc-91027). */
export type WindowArrival = 'still' | 'arriving' | 'arrived';

export const WindowArriving = createContext<WindowArrival>('still');

export function windowArrival(slidesIn: boolean, arriving: boolean): WindowArrival {
  if (!slidesIn) return 'still';

  return arriving ? 'arriving' : 'arrived';
}

/** When a field takes the focus it opens with: at mount, or once the window it opens in has arrived, as Add a phone number's field does. */
export type OpenedFocus = 'mount' | 'arrived';

export function openedFocus(autoFocus: boolean | undefined, arrival: WindowArrival): OpenedFocus {
  return arrival !== 'still' && autoFocus === true ? 'arrived' : 'mount';
}

/** How a field that opens focused once its screen has settled, as Add a phone number's does, gets there: in a window that slides in on an Android phone, once the window has arrived, since a focus sent on a timer while Android gives the window focus is lost (sc-91027); anywhere else, `SETTLED_MS` after it shows. */
export function settledFocus(
  opensFocused: boolean,
  arrival: WindowArrival,
): 'none' | 'timer' | 'arrival' {
  if (!opensFocused) return 'none';

  return arrival === 'still' ? 'timer' : 'arrival';
}

/** Ticks, `NEW_FIELD_BOUND_MS` apart, through which a field that waited for its window holds the focus it opens with: Android can give the window focus late, and a focus sent before that is lost (qa2 #91741). */
export const ARRIVED_FOCUS_TICKS = 20;

export interface ArrivedFocus {
  opened: OpenedFocus;
  arrival: WindowArrival;
  /** The field has input focus now, by Android's own focus and blur events, not JS's record of them, which a lost focus leaves pointing at the field (sc-44356). */
  focused: boolean;
  /** Another `Field` has input focus, by the same events: a tap put it there. A bare TextInput outside a `Field` sends this hook nothing, so a tap on one within the ticks has the field take focus back; JS's record of the focused input is no check, since a lost focus leaves it stale (qa2 #91741). */
  heldElsewhere: boolean;
  /** TalkBack or another screen reader is on, or null until the device has said. Any focus sent once the window has arrived can pull the reader off the window's title onto the field, a per-tick one every time and a single one now and then, so with a reader on the field is sent none, as at `d55dd81`, and none until the answer is in (qa #91929, #92173). */
  readerOn: boolean | null;
  ticks: number;
}

/** What a field that waited for its window does on this tick: wait for the window, send focus, keep the focus it has, or nothing more. */
export function arrivedFocusStep(at: ArrivedFocus): 'wait' | 'focus' | 'hold' | 'done' {
  if (at.opened !== 'arrived' || at.heldElsewhere || at.readerOn === true) return 'done';
  if (at.ticks >= ARRIVED_FOCUS_TICKS) return 'done';
  if (at.arrival === 'arriving') return at.focused ? 'done' : 'wait';
  if (at.readerOn == null) return 'wait';

  return at.focused ? 'hold' : 'focus';
}

/** Times the keys are raised on a field that took its focus at mount, `KEYS_RAISED_AGAIN_TICKS` apart: Android can drop the first, sent before it has given the window focus (qa #97238). */
export const KEY_RAISES = 2;
export const KEYS_RAISED_AGAIN_TICKS = 2;

export interface MountedKeys {
  os: string;
  opened: OpenedFocus;
  autoFocus: boolean | undefined;
  /** The field has input focus now, by its own focus and blur events. */
  focused: boolean;
  /** Raises sent so far. Android reads the keys as down over a Modal, as a tablet's screens are, so whether they are up is no stop: the raises are counted instead, and a raise long after the first would undo the back key putting them down (lead, PR #3899). */
  raises: number;
  /** The tick of the last raise. */
  raisedAt: number;
  /** As `ArrivedFocus.readerOn`: with a reader on, the field takes its focus at mount and nothing more, as at main before sc-92467. */
  readerOn: boolean | null;
  ticks: number;
}

/** What a field that took its focus at mount in an Android window that does not slide in, as on a tablet, does now: Android gives it the caret but leaves the keys down, so once it has the focus, however late that comes, they are raised on it a tick after mount so the keyboard is bound to it, and once more soon after unless the field lost focus in between (sc-92467). `tick` waits a tick, `wait` waits for the focus or the reader. */
export function mountedKeysStep(at: MountedKeys): 'tick' | 'wait' | 'raise' | 'done' {
  if (at.os !== 'android' || at.opened !== 'mount' || at.autoFocus !== true) return 'done';
  if (at.readerOn === true || at.raises >= KEY_RAISES) return 'done';
  if (at.raises > 0) {
    if (!at.focused) return 'done';

    return at.ticks < at.raisedAt + KEYS_RAISED_AGAIN_TICKS ? 'tick' : 'raise';
  }
  if (at.ticks < 1) return 'tick';
  if (at.readerOn == null || !at.focused) return 'wait';

  return 'raise';
}

/** `mountedKeysStep` for one field, keeping its raises: once it is done, as after a blur, a focus that follows, as a tap makes, raises nothing more (lead, PR #3899). */
export function mountedKeys(
  os: string,
  opened: OpenedFocus,
  autoFocus: boolean | undefined,
): (at: Pick<MountedKeys, 'focused' | 'readerOn' | 'ticks'>) => 'tick' | 'wait' | 'raise' | 'done' {
  let raises = 0;
  let raisedAt = 0;
  let done = false;

  return (at) => {
    if (done) return 'done';
    const step = mountedKeysStep({ ...at, os, opened, autoFocus, raises, raisedAt });
    if (step === 'raise') {
      raises += 1;
      raisedAt = at.ticks;
    }
    done = step === 'done';

    return step;
  };
}

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

/** Ticks, `NEW_FIELD_BOUND_MS` apart, that the focus has stood before the keys are raised on a field that took it at mount: Android can drop a raise sent before it has given the window focus (qa #97238). */
export const KEYS_RAISE_AFTER_TICKS = 2;

export interface MountedKeys {
  os: string;
  opened: OpenedFocus;
  autoFocus: boolean | undefined;
  /** The field has input focus now, by its own focus and blur events. */
  focused: boolean;
  /** The first tick the field had the focus with no reader on, or null until then. */
  focusedSince: number | null;
  /** As `ArrivedFocus.readerOn`: with a reader on, the field takes its focus at mount and nothing more, as at main before sc-92467. */
  readerOn: boolean | null;
  /** A person has pressed the field. */
  touched: boolean;
  ticks: number;
}

/** What a field that took its focus at mount in an Android window that does not slide in, as on a tablet, does now: Android gives it the caret but leaves the keys down, so once it has had the focus for a while, however late that comes, they are raised on it (sc-92467). Only once: Back puts the keys down without blurring the field, and Android reads them as down over a Modal, as a tablet's screens are, so a second raise would bring back keys a person had put down (qa #98098). A pressed field gets none: the press raises the keys itself, and Back may already have put them down. `tick` waits a tick, `wait` waits for the focus or the reader. */
export function mountedKeysStep(at: MountedKeys): 'tick' | 'wait' | 'raise' | 'done' {
  if (at.os !== 'android' || at.opened !== 'mount' || at.autoFocus !== true) return 'done';
  if (at.readerOn === true || at.touched) return 'done';
  if (at.focusedSince != null && !at.focused) return 'done';
  if (at.ticks < 1) return 'tick';
  if (at.readerOn == null || !at.focused) return 'wait';
  if (at.focusedSince == null) return 'tick';

  return at.ticks < at.focusedSince + KEYS_RAISE_AFTER_TICKS ? 'tick' : 'raise';
}

/** `mountedKeysStep` for one field: once it has raised the keys or the field has lost focus, a focus that follows, as a tap makes, raises nothing more (lead, PR #3899). */
export function mountedKeys(
  os: string,
  opened: OpenedFocus,
  autoFocus: boolean | undefined,
): (
  at: Pick<MountedKeys, 'focused' | 'readerOn' | 'touched' | 'ticks'>,
) => 'tick' | 'wait' | 'raise' | 'done' {
  let focusedSince: number | null = null;
  let done = false;

  return (at) => {
    if (done) return 'done';
    const step = mountedKeysStep({ ...at, os, opened, autoFocus, focusedSince });
    if (focusedSince == null && at.ticks >= 1 && at.focused && at.readerOn === false)
      focusedSince = at.ticks;
    done = step === 'raise' || step === 'done';

    return step;
  };
}

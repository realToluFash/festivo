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

/** Whether a field that would take its focus at mount is held back from it, so the raise `mountedKeys` makes is the only thing that asks for its keys. A screen reader on, or not yet known, leaves the focus at mount, as at main before sc-92467. */
export function holdsMountFocus(
  os: string,
  opened: OpenedFocus,
  autoFocus: boolean | undefined,
  readerAtMount: boolean | null,
): boolean {
  return os === 'android' && opened === 'mount' && autoFocus === true && readerAtMount === false;
}

/** Ticks, `NEW_FIELD_BOUND_MS` apart, from mount to the one raise of a held field's keys: Android drops a raise sent before it has given the window focus (qa #97238). */
export const KEYS_RAISE_AFTER_TICKS = 4;

export interface MountedKeys {
  /** As `holdsMountFocus`. */
  held: boolean;
  /** As `ArrivedFocus.heldElsewhere`. */
  heldElsewhere: boolean;
  /** As `ArrivedFocus.readerOn`. */
  readerOn: boolean | null;
  /** A person has pressed the field. */
  touched: boolean;
  ticks: number;
}

/** What a field held back from its focus at mount in an Android window that does not slide in, as on a tablet, does now: it is focused with its keys, once (sc-92467). Nothing may ask for the keys before that or after it: Back puts them down without blurring the field, and Android reads them as down over a Modal, as a tablet's screens are, so a second request brings back keys a person had put down. React Native's own `autoFocus` is such a request, and Android honours it only now and then (qa #98098, #99147). A field a person pressed, or one pressed elsewhere, gets none. */
export function mountedKeysStep(at: MountedKeys): 'tick' | 'wait' | 'raise' | 'done' {
  if (!at.held || at.heldElsewhere || at.touched || at.readerOn === true) return 'done';
  if (at.ticks < KEYS_RAISE_AFTER_TICKS) return 'tick';

  return at.readerOn == null ? 'wait' : 'raise';
}

/** `mountedKeysStep` for one field: once it has raised the keys or stood down, nothing raises them again (lead, PR #3899). */
export function mountedKeys(
  held: boolean,
): (at: Omit<MountedKeys, 'held'>) => 'tick' | 'wait' | 'raise' | 'done' {
  let done = false;

  return (at) => {
    if (done) return 'done';
    const step = mountedKeysStep({ ...at, held });
    done = step === 'raise' || step === 'done';

    return step;
  };
}

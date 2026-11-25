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
  /** TalkBack or another screen reader is on, or null until the device has said. Focus sent again after the reader has settled on the window's title pulls the reader onto the field, so the field is sent focus once, as before the ticks, and none until the answer is in (qa #91929). */
  readerOn: boolean | null;
  ticks: number;
}

/** What a field that waited for its window does on this tick: wait for the window, send focus, keep the focus it has, or nothing more. */
export function arrivedFocusStep(at: ArrivedFocus): 'wait' | 'focus' | 'hold' | 'done' {
  const last = at.readerOn ? 1 : ARRIVED_FOCUS_TICKS;
  if (at.opened !== 'arrived' || at.heldElsewhere || at.ticks >= last) return 'done';
  if (at.arrival === 'arriving') return at.focused ? 'done' : 'wait';
  if (at.readerOn == null) return 'wait';

  return at.focused ? 'hold' : 'focus';
}

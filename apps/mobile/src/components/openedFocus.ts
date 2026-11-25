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

/** Tries a field that waited for its window gets: a focus sent as the window arrives can land before Android lets the window take focus, and is lost with no blur to say so. */
export const ARRIVED_FOCUS_TRIES = 8;

export interface ArrivedFocus {
  opened: OpenedFocus;
  arrival: WindowArrival;
  /** The field has had input focus, by a tap or by a try: Android's own event, not JS's record of it, which a lost focus leaves pointing at the field (sc-44356). */
  focusedOnce: boolean;
  /** Another field, still drawn, holds input focus. */
  heldElsewhere: boolean;
  tries: number;
}

/** What a field that waited for its window does now: wait for it, send focus again, or nothing more. */
export function arrivedFocusStep(at: ArrivedFocus): 'wait' | 'focus' | 'done' {
  if (at.opened !== 'arrived' || at.focusedOnce || at.heldElsewhere) return 'done';
  if (at.arrival === 'arriving') return 'wait';

  return at.tries < ARRIVED_FOCUS_TRIES ? 'focus' : 'done';
}

/** Whether `holder`, the field JS counts as focused, is another field still drawn. One gone from the screen holds nothing. */
export function heldByAnother(holder: unknown, field: unknown): boolean {
  if (holder == null || holder === field) return false;

  return (holder as { isConnected?: boolean }).isConnected !== false;
}

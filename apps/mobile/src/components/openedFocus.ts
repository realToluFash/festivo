import { createContext } from 'react';

/** True while a phone window on Android slides in: a field focused in that beat never takes focus, and the keys come up over it with nowhere to type (sc-91027). */
export const WindowArriving = createContext(false);

/** When a field takes the focus it opens with: at mount, or once the window it opens in has arrived, as Add a phone number's field does. */
export type OpenedFocus = 'mount' | 'arrived';

export function openedFocus(autoFocus: boolean | undefined, arriving: boolean): OpenedFocus {
  return arriving && autoFocus === true ? 'arrived' : 'mount';
}

/** Whether a field that waited for its window takes focus now: the window has arrived and nothing else took focus meanwhile. */
export function takesArrivedFocus(
  opened: OpenedFocus,
  arriving: boolean,
  holder: unknown,
): boolean {
  return opened === 'arrived' && !arriving && holder == null;
}

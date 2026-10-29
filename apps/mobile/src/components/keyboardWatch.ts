import { Keyboard, Platform } from 'react-native';

import { keyboardInWindow, keyboardLift } from '../kit/keyboard.ts';

export const LIFT = keyboardLift(Platform.OS);

// Once the avoiding view shrinks it, Android's ScrollView smooth-scrolls the focused field to its
// own bottom edge over 250ms, and that can land after our lift and leave the button under the keys.
const NATIVE_FOCUS_SCROLL_MS = 400;

/** Where the keyboard's top edge sits in the window, or null while the keys are down. */
export function keyboardTopNow(origin: number): number | null {
  const screenY = Keyboard.isVisible() ? Keyboard.metrics()?.screenY : undefined;

  return screenY == null ? null : keyboardInWindow(screenY, origin);
}

/** Calls `changed` with the keyboard's new top edge each time the keys go up or down. Returns the unsubscribe. */
export function watchKeyboardTop(
  origin: () => number,
  changed: (top: number | null) => void,
): () => void {
  const shown = Keyboard.addListener('keyboardDidShow', (event) =>
    changed(keyboardInWindow(event.endCoordinates.screenY, origin())),
  );
  const hidden = Keyboard.addListener('keyboardDidHide', () => changed(null));

  return () => {
    shown.remove();
    hidden.remove();
  };
}

export interface SettledLift {
  lift(): void;
  cancel(): void;
}

/** Lifts now and, where the avoiding view lifts, again once the native focus scroll has landed. */
export function settledLift(liftNow: () => void): SettledLift {
  let settled: ReturnType<typeof setTimeout> | undefined;

  return {
    lift: () => {
      liftNow();
      if (LIFT.avoid == null) return;
      clearTimeout(settled);
      settled = setTimeout(liftNow, NATIVE_FOCUS_SCROLL_MS);
    },
    cancel: () => clearTimeout(settled),
  };
}

/** Puts the keys down and calls `then` once they are and the scroll they move has landed after `settledMs`, or at once with them already down. Returns what cancels the call still to come. */
export function whenKeysDown(then: () => void, settledMs: number): () => void {
  if (!Keyboard.isVisible()) {
    then();
    return () => {};
  }

  let settled: ReturnType<typeof setTimeout> | undefined;
  // Keys that never say they went down do not hold the close for ever.
  const unheard = setTimeout(land, settledMs);
  const hidden = Keyboard.addListener('keyboardDidHide', land);
  Keyboard.dismiss();

  function land(): void {
    hidden.remove();
    clearTimeout(unheard);
    settled ??= setTimeout(then, settledMs);
  }

  return () => {
    hidden.remove();
    clearTimeout(unheard);
    clearTimeout(settled);
  };
}

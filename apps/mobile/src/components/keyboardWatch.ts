import { useEffect, useState } from 'react';
import { codegenNativeCommands, type HostInstance, Keyboard, Platform } from 'react-native';

import { keyboardInWindow, keyboardLift, keysDownThen } from '../kit/keyboard.ts';

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

/** The keyboard's top edge in the window, or null while the keys are down. */
export function useKeyboardTop(): number | null {
  const [top, setTop] = useState(() => keyboardTopNow(0));

  useEffect(() => watchKeyboardTop(() => 0, setTop), []);

  return top;
}

/** Whether the keyboard is up, changing when the avoiding view starts to move. Android also says the keys showed when Gboard swaps them while up, and that changes nothing here: only false to true is the keys coming up (sc-18587). */
export function useKeysUp(): boolean {
  const [up, setUp] = useState(() => keyboardTopNow(0) != null);

  useEffect(() => {
    // iOS's avoiding view pads on the Will events and Android's on the Did ones.
    const ios = Platform.OS === 'ios';
    const shown = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', () =>
      setUp(true),
    );
    const hidden = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () =>
      setUp(false),
    );

    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);

  return up;
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

const textInput = codegenNativeCommands<{
  blur(field: HostInstance): void;
  focus(field: HostInstance): void;
}>({
  supportedCommands: ['blur', 'focus'],
});

/** Raises the keys on a field, focused or not, and leaves them up if they are. TextInput's focus() skips a field already focused, and Android's own focus command shows the keys whatever focus held. */
export function raiseKeysOn(field: HostInstance): void {
  textInput.focus(field);
}

/** Puts the keys down and calls `then` once they are and the scroll they move has landed after `settledMs`, as `keysDownThen`. With `field`, the one that raised them, they go down without moving input focus: once the field has given focus up, its blur only hides the keys, where Keyboard.dismiss no longer counts it as focused (sc-18587). Returns what cancels the call still to come. */
export function putKeysDownThen(
  then: () => void,
  settledMs: number,
  field?: HostInstance | null,
): () => void {
  return keysDownThen(
    {
      up: () => Keyboard.isVisible(),
      hide: () => (field == null ? Keyboard.dismiss() : textInput.blur(field)),
      onHidden: onKeysHidden,
    },
    then,
    settledMs,
  );
}

/** Calls `then` once keys something else is putting down have gone and `settledMs` has passed since, as `keysDownThen`, but asks nothing of them: TalkBack's focus moves as the window grows under keys that close late, and what was timed from the tap lands before that (sc-43907). The form grows only once the avoiding view has heard the keys went down and laid out again, which can come well after, so a screen's scroll resizing meanwhile starts the settle again. Returns what cancels the call still to come. */
export function onceKeysDownThen(then: () => void, settledMs: number): () => void {
  return keysDownThen(
    { up: () => Keyboard.isVisible(), hide: () => {}, onHidden: onKeysHiddenOrGrown },
    then,
    settledMs,
  );
}

const scrollResizes = new Set<() => void>();
const scrollHeights = new WeakMap<object, number>();

/** A screen's scroll view has been laid out at `height`; only a new height counts, as a layout also comes when the view only moves, and each screen still mounted lays out its own. */
export function scrollLaidOut(scroll: object, height: number): void {
  if (scrollHeights.get(scroll) === height) return;
  scrollHeights.set(scroll, height);
  scrollResizes.forEach((resized) => resized());
}

function onKeysHiddenOrGrown(changed: () => void): () => void {
  const unwatchHidden = onKeysHidden(changed);
  scrollResizes.add(changed);

  return () => {
    unwatchHidden();
    scrollResizes.delete(changed);
  };
}

function onKeysHidden(hidden: () => void): () => void {
  const listener = Keyboard.addListener('keyboardDidHide', hidden);

  return () => listener.remove();
}

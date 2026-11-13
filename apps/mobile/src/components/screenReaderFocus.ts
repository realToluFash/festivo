import { type RefObject, useEffect, useState } from 'react';
import {
  AccessibilityInfo,
  findNodeHandle,
  Platform,
  type TextInputInstance,
  type ViewInstance,
} from 'react-native';

import { type TextHandle } from './Text.tsx';

export type ScreenReaderTarget = ViewInstance | TextInputInstance | TextHandle;

/** TalkBack ignores the focus event VoiceOver follows, and takes a hover instead (sc-9950). */
export function moveScreenReaderFocus(view: ScreenReaderTarget | null): void {
  if (view == null) return;

  if (Platform.OS === 'android') {
    AccessibilityInfo.sendAccessibilityEvent(view, 'viewHoverEnter');
    return;
  }

  const node = findNodeHandle(view);
  if (node != null) AccessibilityInfo.setAccessibilityFocus(node);
}

/** Whether a screen reader is on, false until the answer comes. */
export function useScreenReaderOn(): boolean {
  const [on, setOn] = useState(false);

  useEffect(() => {
    let gone = false;
    void AccessibilityInfo.isScreenReaderEnabled().then((now) => {
      if (!gone) setOn(now);
    });
    const changed = AccessibilityInfo.addEventListener('screenReaderChanged', setOn);

    return () => {
      gone = true;
      changed.remove();
    };
  }, []);

  return on;
}

// TalkBack has put its focus on a hovered view well inside this.
const HOVER_LANDS_MS = 100;

/** Raises the keys on `input`; on Android with TalkBack on, its focus goes there first, so the field is read once, as focus reaches it, and not also as it takes the keys (sc-42690). Returns what cancels the call still to come. */
export function focusReadOnce(input: RefObject<TextInputInstance | null>): () => void {
  if (Platform.OS !== 'android') {
    input.current?.focus();
    return () => {};
  }

  let gone = false;
  let keys: ReturnType<typeof setTimeout> | undefined;
  void AccessibilityInfo.isScreenReaderEnabled().then((on) => {
    if (gone) return;
    if (!on) {
      input.current?.focus();
      return;
    }
    moveScreenReaderFocus(input.current);
    keys = setTimeout(() => input.current?.focus(), HOVER_LANDS_MS);
  });

  return () => {
    gone = true;
    clearTimeout(keys);
  };
}

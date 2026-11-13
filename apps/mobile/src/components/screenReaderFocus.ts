import { useEffect, useState } from 'react';
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

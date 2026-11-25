import { useEffect, useState } from 'react';
import {
  type AccessibilityActionEvent,
  type AccessibilityActionInfo,
  AccessibilityInfo,
  findNodeHandle,
  Platform,
  type TextInputInstance,
  type ViewInstance,
} from 'react-native';

import { type TextHandle } from './Text.tsx';

export type ScreenReaderTarget = ViewInstance | TextInputInstance | TextHandle;

const ACTIVATE: AccessibilityActionInfo[] = [{ name: 'activate' }];

/** TalkBack's double tap calls `onPress` itself rather than through the view's click, which a view without one would refuse. */
export function pressOnDoubleTap(onPress: (() => void) | undefined) {
  if (onPress == null) return {};

  return {
    accessibilityActions: ACTIVATE,
    onAccessibilityAction: (event: AccessibilityActionEvent) => {
      if (event.nativeEvent.actionName === 'activate') onPress();
    },
  };
}

/** TalkBack ignores the focus event VoiceOver follows, and takes a hover instead (sc-9950). */
export function moveScreenReaderFocus(view: ScreenReaderTarget | null): void {
  // A view unmounted before a deferred move fires has no node left, and Android's event logs a warning over the screen (sc-87242).
  if (view == null || !view.isConnected) return;

  if (Platform.OS === 'android') {
    AccessibilityInfo.sendAccessibilityEvent(view, 'viewHoverEnter');
    return;
  }

  const node = findNodeHandle(view);
  if (node != null) AccessibilityInfo.setAccessibilityFocus(node);
}

/** Whether a screen reader is on, false until the answer comes. */
export function useScreenReaderOn(): boolean {
  return useScreenReader() === true;
}

/** Whether a screen reader is on, or null until the device has said. */
export function useScreenReader(): boolean | null {
  const [on, setOn] = useState<boolean | null>(null);

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

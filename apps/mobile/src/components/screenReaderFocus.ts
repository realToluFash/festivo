import {
  AccessibilityInfo,
  findNodeHandle,
  Platform,
  type TextInput,
  type View,
} from 'react-native';

import { type TextHandle } from './Text.tsx';

export type ScreenReaderTarget = View | TextInput | TextHandle;

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

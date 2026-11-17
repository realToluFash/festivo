import { type RefObject, useEffect } from 'react';
import { Keyboard, type ScrollViewInstance } from 'react-native';

import { focusedField, watchFocusedField, watchFocusedFieldReshaped } from './focusedField.ts';
import { bringIntoView } from './intoView.ts';
import { keyboardTopNow } from './keyboardWatch.ts';

const WINDOW_TOP = { current: 0 };

/** Keeps the focused field, its box and its error, above the keys while they are up: as they rise, as focus moves, and as the field grows, moves or is given its error (sc-48600). A screen in its own window measures from the window's top. */
export function useFocusedFieldInSight(
  scroll: RefObject<ScrollViewInstance | null>,
  offset: RefObject<number>,
): void {
  useEffect(() => {
    const sight = { ref: scroll, offset, origin: WINDOW_TOP };
    const bring = () => {
      if (keyboardTopNow(0) == null) return;
      bringIntoView(sight, focusedField(), true, { aboveKeys: true, foot: true });
    };
    const shown = Keyboard.addListener('keyboardDidShow', bring);
    const unwatchFocus = watchFocusedField(bring);
    const unwatchReshaped = watchFocusedFieldReshaped(bring);

    return () => {
      shown.remove();
      unwatchFocus();
      unwatchReshaped();
    };
  }, [scroll, offset]);
}

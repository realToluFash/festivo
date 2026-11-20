import { type RefObject, useCallback, useEffect, useRef } from 'react';
import { Keyboard, type ScrollViewInstance } from 'react-native';

import { focusedField, watchFocusedField, watchFocusedFieldReshaped } from './focusedField.ts';
import { SETTLED_MS, bringIntoView } from './intoView.ts';
import { keyboardTopNow } from './keyboardWatch.ts';

const WINDOW_TOP = { current: 0 };

/** Keeps the focused field, its box and its error, above the keys while they are up: as they rise, as focus moves, and as the field grows, moves or is given its error (sc-48600). A screen in its own window measures from the window's top. The hold it returns lets a scroll the screen makes on purpose land, the field moving under it (sc-74540). */
export function useFocusedFieldInSight(
  scroll: RefObject<ScrollViewInstance | null>,
  offset: RefObject<number>,
): () => void {
  const heldUntil = useRef(0);

  useEffect(() => {
    const sight = { ref: scroll, offset, origin: WINDOW_TOP };
    const bring = () => {
      if (keyboardTopNow(0) == null) return;
      bringIntoView(sight, focusedField(), true, { aboveKeys: true, foot: true });
    };
    const shown = Keyboard.addListener('keyboardDidShow', bring);
    const unwatchFocus = watchFocusedField(bring);
    const unwatchReshaped = watchFocusedFieldReshaped(() => {
      if (Date.now() >= heldUntil.current) bring();
    });

    return () => {
      shown.remove();
      unwatchFocus();
      unwatchReshaped();
    };
  }, [scroll, offset]);

  return useCallback(() => {
    heldUntil.current = Date.now() + SETTLED_MS;
  }, []);
}

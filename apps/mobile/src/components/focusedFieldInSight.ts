import { type RefObject, useCallback, useEffect, useRef } from 'react';
import { Keyboard, type ScrollViewInstance } from 'react-native';

import {
  focusedField,
  watchFocusedField,
  watchFocusedFieldReshaped,
  watchFocusedFieldTyped,
} from './focusedField.ts';
import { bringIntoView } from './intoView.ts';
import { keyboardTopNow } from './keyboardWatch.ts';

const WINDOW_TOP = { current: 0 };

/** Keeps the focused field, its box and its error, above the keys while they are up: as they rise, as focus moves, as the field grows, moves or is given its error, and as it is typed in after the screen scrolled away from it (sc-48600). A screen in its own window measures from the window's top. The hold it returns keeps a scroll the screen makes on purpose, the field moving under it, until the person types, moves focus or drops the keys: a hold for a set time ran out before Android's last reshape (sc-74540, sc-75689). */
export function useFocusedFieldInSight(
  scroll: RefObject<ScrollViewInstance | null>,
  offset: RefObject<number>,
): () => void {
  const held = useRef(false);

  useEffect(() => {
    const sight = { ref: scroll, offset, origin: WINDOW_TOP };
    const bring = () => {
      if (keyboardTopNow(0) == null) return;
      bringIntoView(sight, focusedField(), true, { aboveKeys: true, foot: true });
    };
    const unheld = () => {
      held.current = false;
      bring();
    };
    const unlessHeld = () => {
      if (!held.current) bring();
    };
    const shown = Keyboard.addListener('keyboardDidShow', unlessHeld);
    const hidden = Keyboard.addListener('keyboardDidHide', () => {
      held.current = false;
    });
    const unwatchFocus = watchFocusedField(unheld);
    const unwatchReshaped = watchFocusedFieldReshaped(unlessHeld);
    const unwatchTyped = watchFocusedFieldTyped(unheld);

    return () => {
      shown.remove();
      hidden.remove();
      unwatchFocus();
      unwatchReshaped();
      unwatchTyped();
    };
  }, [scroll, offset]);

  return useCallback(() => {
    held.current = true;
  }, []);
}

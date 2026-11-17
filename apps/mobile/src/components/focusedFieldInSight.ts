import { type RefObject, useEffect } from 'react';
import { Keyboard, type ScrollViewInstance } from 'react-native';

import { offsetShowingFoot, shownAboveKeys } from '../kit/keyboard.ts';
import { tokens } from '../theme/tokens.ts';
import { focusedField, watchFocusedField, watchFocusedFieldReshaped } from './focusedField.ts';
import { keyboardTopNow } from './keyboardWatch.ts';

/** Keeps the focused field, its box and its error, above the keys while they are up: as they rise, as focus moves, and as the field grows, moves or is given its error (sc-48600). A screen in its own window measures from the window's top. */
export function useFocusedFieldInSight(
  scroll: RefObject<ScrollViewInstance | null>,
  offset: RefObject<number>,
): void {
  useEffect(() => {
    const bring = () => {
      const view = scroll.current;
      const field = focusedField();
      const content = view?.getInnerViewRef();
      const host = view?.getNativeScrollRef();
      if (view == null || field == null || content == null || host == null) return;

      // A field in another screen's scroll fails to measure here, and that screen keeps it.
      field.measureLayout(
        content,
        (_x, contentY, _w, height) =>
          host.measureInWindow((_sx, y, _sw, scrollHeight) => {
            const keys = keyboardTopNow(0);
            if (keys == null) return;
            const to = offsetShowingFoot({
              contentY,
              height,
              offset: offset.current,
              shown: shownAboveKeys(keys, { y, height: scrollHeight }),
              margin: tokens.spaceLg,
            });
            if (to != null) view.scrollTo({ y: to, animated: true });
          }),
        () => {},
      );
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

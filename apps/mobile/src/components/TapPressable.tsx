import { type Ref, useRef } from 'react';
import {
  type GestureResponderEvent,
  Pressable,
  type PressableProps,
  type ViewInstance,
} from 'react-native';

import { stillTouch, type TouchPoint } from './stillTouch.ts';

/** A Pressable whose press is a tap only: a touch that moved its list, or pulled it past an end that does not bounce, presses nothing (sc-75211). */
export function TapPressable({
  ref,
  onPressIn,
  onPress,
  ...props
}: PressableProps & { ref?: Ref<ViewInstance> | undefined }) {
  const landed = useRef<TouchPoint | null>(null);

  return (
    <Pressable
      {...props}
      ref={ref}
      onPressIn={(event: GestureResponderEvent) => {
        const { pageX, pageY } = event.nativeEvent;
        landed.current = { pageX, pageY };
        onPressIn?.(event);
      }}
      onPress={
        onPress == null
          ? undefined
          : (event: GestureResponderEvent) => {
              const from = landed.current;
              landed.current = null;
              if (stillTouch(from, event.nativeEvent)) onPress(event);
            }
      }
    />
  );
}

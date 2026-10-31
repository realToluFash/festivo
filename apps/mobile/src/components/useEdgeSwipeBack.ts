import { useNavigation } from 'expo-router';
import { createContext, useContext, useEffect, useState } from 'react';
import { Animated, PanResponder, type PanResponderInstance, Platform } from 'react-native';

import { edgeSwipeCompletes, edgeSwipeStarts } from '../kit/systemBack.ts';
import { useWindowFrame } from '../layout/useLayout.ts';

export type EdgeSwipeHandlers = PanResponderInstance['panHandlers'];

/** AppFrame's strip over the window's left edge, header included, which a page in front of its list hands its swipe to (sc-23327). */
export const EdgeSwipeStrip = createContext<
  ((handlers: EdgeSwipeHandlers | undefined) => void) | undefined
>(undefined);

function edgeSwipe(onDrag: (dragging: boolean) => void): {
  shift: Animated.Value;
  handlers: EdgeSwipeHandlers;
  follow(onBack: () => void, width: number): void;
} {
  const shift = new Animated.Value(0);
  let latest = { onBack: () => {}, width: 0 };
  const settle = () =>
    Animated.spring(shift, { toValue: 0, useNativeDriver: false, bounciness: 0 }).start(() =>
      onDrag(false),
    );
  const { panHandlers } = PanResponder.create({
    onMoveShouldSetPanResponder: (_, { dx, dy }) => edgeSwipeStarts(dx, dy),
    onPanResponderGrant: () => onDrag(true),
    onPanResponderMove: (_, { dx }) => shift.setValue(Math.max(0, dx)),
    onPanResponderRelease: (_, { dx, vx }) => {
      if (!edgeSwipeCompletes(dx, vx, latest.width)) {
        settle();
        return;
      }
      latest.onBack();
      requestAnimationFrame(() => {
        shift.setValue(0);
        onDrag(false);
      });
    },
    onPanResponderTerminate: settle,
    onPanResponderTerminationRequest: () => false,
  });

  return {
    shift,
    handlers: panHandlers,
    follow(onBack, width) {
      latest = { onBack, width };
    },
  };
}

/** While `active` on iOS, the left-edge swipe runs `onBack` in place of the stack's, from AppFrame's strip, as scroll views would take the drag (sc-23327). */
export function useEdgeSwipeBack(
  active: boolean,
  onBack: () => void,
): { taking: boolean; dragging: boolean; shift: Animated.Value } {
  const navigation = useNavigation();
  const strip = useContext(EdgeSwipeStrip);
  const { width } = useWindowFrame();
  const taking = Platform.OS === 'ios' && active && strip != null;
  const [dragging, setDragging] = useState(false);
  const [swipe] = useState(() => edgeSwipe(setDragging));

  useEffect(() => swipe.follow(onBack, width));

  useEffect(() => {
    if (!taking) return;
    navigation.setOptions({ gestureEnabled: false });
    strip(swipe.handlers);

    return () => {
      strip(undefined);
      navigation.setOptions({ gestureEnabled: true });
    };
  }, [navigation, strip, swipe, taking]);

  return { taking, dragging: taking && dragging, shift: swipe.shift };
}

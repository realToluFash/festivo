import { useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';
import { Animated, PanResponder, type PanResponderInstance, Platform } from 'react-native';

import { edgeSwipeCompletes, edgeSwipeStarts } from '../kit/systemBack.ts';
import { useWindowFrame } from '../layout/useLayout.ts';

type Handlers = PanResponderInstance['panHandlers'];

function edgeSwipe(): {
  shift: Animated.Value;
  handlers: Handlers;
  follow(onBack: () => void, width: number): void;
} {
  const shift = new Animated.Value(0);
  let latest = { onBack: () => {}, width: 0 };
  const settle = () =>
    Animated.spring(shift, { toValue: 0, useNativeDriver: false, bounciness: 0 }).start();
  const { panHandlers } = PanResponder.create({
    onMoveShouldSetPanResponder: (_, { dx, dy }) => edgeSwipeStarts(dx, dy),
    onPanResponderMove: (_, { dx }) => shift.setValue(Math.max(0, dx)),
    onPanResponderRelease: (_, { dx, vx }) => {
      if (!edgeSwipeCompletes(dx, vx, latest.width)) {
        settle();
        return;
      }
      latest.onBack();
      requestAnimationFrame(() => shift.setValue(0));
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

/** While `active` on iOS, the left-edge swipe runs `onBack` in place of the stack's, from a strip over the edge, as scroll views would take the drag (sc-23327). */
export function useEdgeSwipeBack(
  active: boolean,
  onBack: () => void,
): { handlers: Handlers | undefined; shift: Animated.Value } {
  const navigation = useNavigation();
  const { width } = useWindowFrame();
  const taking = Platform.OS === 'ios' && active;
  const [swipe] = useState(edgeSwipe);

  useEffect(() => swipe.follow(onBack, width));

  useEffect(() => {
    if (!taking) return;
    navigation.setOptions({ gestureEnabled: false });

    return () => navigation.setOptions({ gestureEnabled: true });
  }, [navigation, taking]);

  return { handlers: taking ? swipe.handlers : undefined, shift: swipe.shift };
}

import { useCallback, useState } from 'react';
import { Animated } from 'react-native';

import { useReducedMotion } from '../reducedMotion.ts';

/** One short shake, for a refusal; with reduced motion, none. */
export function useShake() {
  const reduced = useReducedMotion();
  const [x] = useState(() => new Animated.Value(0));
  const shake = useCallback(
    (after?: () => void) => {
      if (reduced) {
        after?.();
        return;
      }
      Animated.sequence(
        [-9, 9, -6, 6, -3, 0].map((toValue) =>
          Animated.timing(x, { toValue, duration: 45, useNativeDriver: true }),
        ),
      ).start(() => after?.());
    },
    [reduced, x],
  );

  return { shaken: { transform: [{ translateX: x }] }, shake };
}

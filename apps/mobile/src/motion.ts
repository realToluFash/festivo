import { Animated, Easing, LayoutAnimation } from 'react-native';

import { tokens } from './theme/tokens.ts';

const [x1, y1, x2, y2] = (tokens.motionEase.match(/-?[\d.]+/g) ?? ['0.2', '0', '0', '1']).map(
  Number,
);

export const motionEase = Easing.bezier(x1 ?? 0.2, y1 ?? 0, x2 ?? 0, y2 ?? 1);

export function glide(value: Animated.Value, toValue: number, duration: number) {
  return Animated.timing(value, { toValue, duration, easing: motionEase, useNativeDriver: true });
}

const LEAVE = Easing.bezier(0.4, 0, 1, 1);

/** Fades a window out in motionFast and calls gone once, at the fade's end or after `grace` more, and returns its cancel. */
export function fadeAway(value: Animated.Value, grace: number, gone: () => void): () => void {
  // Android can lose a native fade's end, and the window left up holds the next one back (qa3, #39178).
  let done = false;
  const end = () => {
    if (done) return;
    done = true;
    clearTimeout(lost);
    gone();
  };
  const lost = setTimeout(end, tokens.motionFast + grace);
  Animated.timing(value, {
    toValue: 0,
    duration: tokens.motionFast,
    easing: LEAVE,
    useNativeDriver: true,
  }).start(end);

  return () => {
    done = true;
    clearTimeout(lost);
  };
}

/** The next layout fades a row in over motionBase, or out in motionFast with its gap closing after, in motionBase. */
export function rowsChange(reduced: boolean): void {
  const fade = (duration: number) => ({
    type: 'easeInEaseOut' as const,
    property: 'opacity' as const,
    duration,
  });

  LayoutAnimation.configureNext({
    duration: tokens.motionBase,
    create: fade(tokens.motionBase),
    delete: fade(tokens.motionFast),
    ...(reduced
      ? {}
      : {
          update: {
            type: 'easeInEaseOut' as const,
            duration: tokens.motionBase,
            delay: tokens.motionFast,
          },
        }),
  });
}

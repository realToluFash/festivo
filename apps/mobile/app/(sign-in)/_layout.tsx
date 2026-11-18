import { Stack } from 'expo-router';

import { useReducedMotion } from '../../src/reducedMotion.ts';
import { tokens } from '../../src/theme/tokens.ts';

/** react-native-screens sizes a formSheet's own scroll view to the whole sheet, over the bar above it: a stack of its own keeps Sign in's out of reach, as the demo's steps are (sc-67589). */
export default function SignInLayout() {
  const reduced = useReducedMotion();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: tokens.colorPage },
        ...(reduced && { animation: 'fade', animationDuration: tokens.motionBase }),
      }}
    />
  );
}

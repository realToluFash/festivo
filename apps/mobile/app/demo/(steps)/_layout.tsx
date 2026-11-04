import { Stack } from 'expo-router';
import { useNavigationState } from 'expo-router/react-navigation';

import { InSheet, useStepsInSheet } from '../../../src/demo/DemoScreen.tsx';
import { useReducedMotion } from '../../../src/reducedMotion.ts';
import { tokens } from '../../../src/theme/tokens.ts';

/** Where Back would leave the account, the bar says Sign out, and the back swipe is off. */
const NO_SWIPE = ['organisation', 'apple', 'invited', 'waiting', 'ending', 'tfa-again'];

export default function StepsLayout() {
  const reduced = useReducedMotion();
  // First in the stack, as a link straight to a step leaves them, iOS shows the steps full screen.
  const below = useNavigationState((state) => state.routes[0]?.name !== '(steps)');
  const sheet = useStepsInSheet() && below;

  return (
    <InSheet value={sheet}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: tokens.colorPage },
          ...(reduced && { animation: 'fade', animationDuration: tokens.motionBase }),
        }}
      >
        {NO_SWIPE.map((name) => (
          <Stack.Screen key={name} name={name} options={{ gestureEnabled: false }} />
        ))}
      </Stack>
    </InSheet>
  );
}

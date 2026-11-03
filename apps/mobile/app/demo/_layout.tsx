import { Redirect, Stack } from 'expo-router';

import { config } from '../../src/config.ts';
import { useStepsInSheet } from '../../src/demo/DemoScreen.tsx';
import { demoOpens } from '../../src/demo/gate.ts';
import { useReducedMotion } from '../../src/reducedMotion.ts';
import { tokens } from '../../src/theme/tokens.ts';

/** The designs, working on sample data: only in development, QA and phone builds. */
export default function DemoLayout() {
  const reduced = useReducedMotion();
  const sheet = useStepsInSheet();

  if (!demoOpens(config.environment)) return <Redirect href="/" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        ...(reduced && { animation: 'fade', animationDuration: tokens.motionBase }),
      }}
    >
      <Stack.Screen name="(steps)" options={{ presentation: sheet ? 'formSheet' : 'card' }} />
      <Stack.Screen name="home" options={{ gestureEnabled: false }} />
    </Stack>
  );
}

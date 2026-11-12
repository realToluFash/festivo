import * as Linking from 'expo-linking';
import { Redirect, Stack } from 'expo-router';
import { useEffect } from 'react';

import { config } from '../../src/config.ts';
import { useStepsInSheet } from '../../src/demo/DemoScreen.tsx';
import { demoOpens } from '../../src/demo/gate.ts';
import { forgetName } from '../../src/demo/settings/savedName.ts';
import { useReducedMotion } from '../../src/reducedMotion.ts';
import { tokens } from '../../src/theme/tokens.ts';

/** The designs, working on sample data: only in development, QA and phone builds. */
export default function DemoLayout() {
  const reduced = useReducedMotion();
  const sheet = useStepsInSheet();

  useEffect(() => {
    forgetName();
    const link = Linking.addEventListener('url', forgetName);

    return () => link.remove();
  }, []);

  if (!demoOpens(config.environment)) return <Redirect href="/" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        ...(reduced && { animation: 'fade', animationDuration: tokens.motionBase }),
      }}
    >
      <Stack.Screen name="(steps)" options={{ presentation: sheet ? 'formSheet' : 'card' }} />
      <Stack.Screen name="today" options={{ gestureEnabled: false }} />
      <Stack.Screen name="legal-link" options={{ presentation: 'modal' }} />
    </Stack>
  );
}

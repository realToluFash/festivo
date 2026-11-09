import { router } from 'expo-router';

import { SecondaryButton } from '../components/Buttons.tsx';
import { config } from '../config.ts';
import { demoOpens } from './gate.ts';

export function demoHere(): boolean {
  return demoOpens(config.environment);
}

export function DemoButton() {
  if (!demoHere()) return null;

  return (
    <SecondaryButton
      label="Design demo"
      onPress={() => router.push('/demo')}
      stacked
      link
      testID="home.designDemo"
    />
  );
}

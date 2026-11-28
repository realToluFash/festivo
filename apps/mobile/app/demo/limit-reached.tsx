import { useLocalSearchParams } from 'expo-router';

import { LimitReachedScreen } from '../../src/demo/limitReached/LimitReachedScreen.tsx';
import { limitState, limitStateOf } from '../../src/demo/limitReached/limitRules.ts';

export default function DemoLimitReached() {
  const { state } = useLocalSearchParams<{ state?: string }>();
  const shown = limitStateOf(state);

  return <LimitReachedScreen key={shown} {...limitState(shown)} />;
}

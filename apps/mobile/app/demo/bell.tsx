import { useLocalSearchParams } from 'expo-router';

import { BellScreen } from '../../src/demo/bell/BellScreen.tsx';
import { bellStartOf } from '../../src/demo/bell/bellRules.ts';

export default function DemoBell() {
  const { ask, at } = useLocalSearchParams<{ ask?: string; at?: string }>();
  const start = bellStartOf(ask, at);

  return <BellScreen key={JSON.stringify(start)} start={start} />;
}

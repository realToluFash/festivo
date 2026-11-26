import { useLocalSearchParams } from 'expo-router';

import { UsageWarningScreen } from '../../src/demo/usageWarning/UsageWarningScreen.tsx';
import { usageStateOf } from '../../src/demo/usageWarning/usageRules.ts';

export default function DemoUsageWarning() {
  const { state } = useLocalSearchParams<{ state?: string }>();
  const shown = usageStateOf(state);

  return <UsageWarningScreen key={shown} state={shown} />;
}

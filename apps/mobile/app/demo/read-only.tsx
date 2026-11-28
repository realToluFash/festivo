import { useLocalSearchParams } from 'expo-router';

import { ReadOnlyScreen } from '../../src/demo/readOnly/ReadOnlyScreen.tsx';
import { readOnlyState, readOnlyStateOf } from '../../src/demo/readOnly/readOnlyRules.ts';

export default function DemoReadOnly() {
  const { state } = useLocalSearchParams<{ state?: string }>();
  const shown = readOnlyStateOf(state);

  return <ReadOnlyScreen key={shown} {...readOnlyState(shown)} />;
}

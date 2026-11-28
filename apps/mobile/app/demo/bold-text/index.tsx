import { useLocalSearchParams } from 'expo-router';

import { BoldTextScreen } from '../../../src/demo/boldText/BoldTextScreen.tsx';

export default function DemoBoldText() {
  const { bold } = useLocalSearchParams<{ bold?: string }>();

  return <BoldTextScreen startOn={bold === 'on'} />;
}

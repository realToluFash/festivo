import { useLocalSearchParams } from 'expo-router';

import { BellSizeScreen } from '../../src/demo/bellSize/BellSizeScreen.tsx';
import { BELL_LANGUAGES, BELL_READS } from '../../src/demo/bellSize/bellSizeRules.ts';
import { FILTER_SIZES, keyOf } from '../../src/demo/filterSize/filterSizeRules.ts';

export default function DemoBellSize() {
  const { size, lang, read, refreshing } = useLocalSearchParams<{
    size?: string;
    lang?: string;
    read?: string;
    refreshing?: string;
  }>();
  const start = {
    size: keyOf(FILTER_SIZES, size, 'device'),
    language: keyOf(BELL_LANGUAGES, lang, 'en'),
    read: keyOf(BELL_READS, read, 'some'),
    refreshing: refreshing === 'on',
  };

  return <BellSizeScreen key={JSON.stringify(start)} start={start} />;
}

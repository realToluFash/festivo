import { useLocalSearchParams } from 'expo-router';

import { CountSizeScreen } from '../../src/demo/countSize/CountSizeScreen.tsx';
import { COUNT_FOUND } from '../../src/demo/countSize/countSizeRules.ts';
import {
  FILTER_LANGUAGES,
  FILTER_SIZES,
  keyOf,
} from '../../src/demo/filterSize/filterSizeRules.ts';

export default function DemoCountSize() {
  const { size, lang, found } = useLocalSearchParams<{
    size?: string;
    lang?: string;
    found?: string;
  }>();
  const start = {
    size: keyOf(FILTER_SIZES, size, 'device'),
    language: keyOf(FILTER_LANGUAGES, lang, 'en'),
    found: keyOf(COUNT_FOUND, found, 'five'),
  };

  return <CountSizeScreen key={JSON.stringify(start)} start={start} />;
}

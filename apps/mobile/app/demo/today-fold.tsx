import { useLocalSearchParams } from 'expo-router';

import {
  FILTER_LANGUAGES,
  FILTER_SIZES,
  keyOf,
} from '../../src/demo/filterSize/filterSizeRules.ts';
import { TodayFoldScreen } from '../../src/demo/todayFold/TodayFoldScreen.tsx';

export default function DemoTodayFold() {
  const { size, lang } = useLocalSearchParams<{ size?: string; lang?: string }>();
  const start = {
    size: keyOf(FILTER_SIZES, size, 'device'),
    language: keyOf(FILTER_LANGUAGES, lang, 'en'),
  };

  return <TodayFoldScreen key={JSON.stringify(start)} start={start} />;
}

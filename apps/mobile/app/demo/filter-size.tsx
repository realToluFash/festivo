import { useLocalSearchParams } from 'expo-router';

import { FilterSizeScreen } from '../../src/demo/filterSize/FilterSizeScreen.tsx';
import {
  FILTER_LANGUAGES,
  FILTER_PICKS,
  FILTER_SIZES,
  keyOf,
} from '../../src/demo/filterSize/filterSizeRules.ts';

export default function DemoFilterSize() {
  const { size, lang, picks } = useLocalSearchParams<{
    size?: string;
    lang?: string;
    picks?: string;
  }>();
  const start = {
    size: keyOf(FILTER_SIZES, size, 'device'),
    language: keyOf(FILTER_LANGUAGES, lang, 'en'),
    picks: keyOf(FILTER_PICKS, picks, 'none'),
  };

  return <FilterSizeScreen key={JSON.stringify(start)} start={start} />;
}

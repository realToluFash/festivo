import { useLocalSearchParams } from 'expo-router';

import { BandTitleScreen } from '../../src/demo/bandTitle/BandTitleScreen.tsx';
import { bandMomentOf } from '../../src/demo/bandTitle/bandTitleRules.ts';
import {
  FILTER_LANGUAGES,
  FILTER_SIZES,
  keyOf,
} from '../../src/demo/filterSize/filterSizeRules.ts';

export default function DemoBandTitle() {
  const { size, lang, moment } = useLocalSearchParams<{
    size?: string;
    lang?: string;
    moment?: string;
  }>();
  const start = {
    size: keyOf(FILTER_SIZES, size, 'device'),
    language: keyOf(FILTER_LANGUAGES, lang, 'en'),
    moment: bandMomentOf(moment),
  };

  return <BandTitleScreen key={JSON.stringify(start)} start={start} />;
}

import { useLocalSearchParams } from 'expo-router';

import { BandLiveScreen } from '../../src/demo/bandLive/BandLiveScreen.tsx';
import { liveEventOf } from '../../src/demo/bandLive/bandLiveRules.ts';
import {
  FILTER_LANGUAGES,
  FILTER_SIZES,
  keyOf,
} from '../../src/demo/filterSize/filterSizeRules.ts';

export default function DemoBandLive() {
  const { size, lang, event } = useLocalSearchParams<{
    size?: string;
    lang?: string;
    event?: string;
  }>();
  const start = {
    size: keyOf(FILTER_SIZES, size, 'device'),
    language: keyOf(FILTER_LANGUAGES, lang, 'fr'),
    event: liveEventOf(event),
  };

  return <BandLiveScreen key={JSON.stringify(start)} start={start} />;
}

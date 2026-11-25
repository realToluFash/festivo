import { useLocalSearchParams } from 'expo-router';

import {
  FILTER_LANGUAGES,
  FILTER_SIZES,
  keyOf,
} from '../../src/demo/filterSize/filterSizeRules.ts';
import { TodaySizeScreen } from '../../src/demo/todaySize/TodaySizeScreen.tsx';
import {
  TODAY_EVENT_NAMES,
  TODAY_GREETINGS,
  TODAY_NAMES,
  TODAY_WEEKS,
} from '../../src/demo/todaySize/todaySizeRules.ts';

export default function DemoTodaySize() {
  const { size, lang, name, greeting, event, week } = useLocalSearchParams<{
    size?: string;
    lang?: string;
    name?: string;
    greeting?: string;
    event?: string;
    week?: string;
  }>();
  const start = {
    size: keyOf(FILTER_SIZES, size, 'device'),
    language: keyOf(FILTER_LANGUAGES, lang, 'en'),
    name: keyOf(TODAY_NAMES, name, 'qa'),
    greeting: keyOf(TODAY_GREETINGS, greeting, 'morning'),
    event: keyOf(TODAY_EVENT_NAMES, event, 'sample'),
    week: keyOf(TODAY_WEEKS, week, 'quiet'),
  };

  return <TodaySizeScreen key={JSON.stringify(start)} start={start} />;
}

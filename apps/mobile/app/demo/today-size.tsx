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
  TODAY_INVITES,
  TODAY_NAMES,
  TODAY_ORGS,
} from '../../src/demo/todaySize/todaySizeRules.ts';

export default function DemoTodaySize() {
  const { size, lang, name, greeting, event, org, invite } = useLocalSearchParams<{
    size?: string;
    lang?: string;
    name?: string;
    greeting?: string;
    event?: string;
    org?: string;
    invite?: string;
  }>();
  const start = {
    size: keyOf(FILTER_SIZES, size, 'device'),
    language: keyOf(FILTER_LANGUAGES, lang, 'en'),
    name: keyOf(TODAY_NAMES, name, 'qa'),
    greeting: keyOf(TODAY_GREETINGS, greeting, 'morning'),
    event: keyOf(TODAY_EVENT_NAMES, event, 'sample'),
    org: keyOf(TODAY_ORGS, org, 'qa'),
    invite: keyOf(TODAY_INVITES, invite, 'none'),
  };

  return <TodaySizeScreen key={JSON.stringify(start)} start={start} />;
}

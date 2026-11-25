import { useLocalSearchParams } from 'expo-router';

import {
  FILTER_LANGUAGES,
  FILTER_SIZES,
  keyOf,
} from '../../src/demo/filterSize/filterSizeRules.ts';
import { TODAY_INVITES, TODAY_ORGS } from '../../src/demo/todaySize/todaySizeRules.ts';
import { TopSizeScreen } from '../../src/demo/topSize/TopSizeScreen.tsx';
import { TOP_SCREENS } from '../../src/demo/topSize/topSizeRules.ts';

export default function DemoTopSize() {
  const { size, lang, screen, org, invite } = useLocalSearchParams<{
    size?: string;
    lang?: string;
    screen?: string;
    org?: string;
    invite?: string;
  }>();
  const start = {
    size: keyOf(FILTER_SIZES, size, 'device'),
    language: keyOf(FILTER_LANGUAGES, lang, 'en'),
    screen: keyOf(TOP_SCREENS, screen, 'settings'),
    org: keyOf(TODAY_ORGS, org, 'qa'),
    invite: keyOf(TODAY_INVITES, invite, 'none'),
  };

  return <TopSizeScreen key={JSON.stringify(start)} start={start} />;
}

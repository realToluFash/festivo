import { useLocalSearchParams } from 'expo-router';

import { TABS } from '../../src/components/TodayCover.tsx';
import { TabletTabsScreen } from '../../src/demo/tabletTabs/TabletTabsScreen.tsx';
import { languageOf, sizeOf } from '../../src/demo/tabletTabs/tabletTabsRules.ts';

export default function DemoTabletTabs() {
  const { size, lang, waiting, tab } = useLocalSearchParams<{
    size?: string;
    lang?: string;
    waiting?: string;
    tab?: string;
  }>();
  const start = {
    size: sizeOf(size),
    language: languageOf(lang),
    waiting: waiting !== 'none',
    at: TABS.find(([name]) => name === tab)?.[0] ?? 'Today',
  };

  return <TabletTabsScreen key={JSON.stringify(start)} start={start} />;
}

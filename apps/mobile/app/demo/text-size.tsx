import { useLocalSearchParams } from 'expo-router';

import { TABS } from '../../src/components/TodayCover.tsx';
import { TextSizeScreen } from '../../src/demo/textSize/TextSizeScreen.tsx';
import { languageOf, textSizeOf } from '../../src/demo/textSize/textSizeRules.ts';

export default function DemoTextSize() {
  const { size, lang, org, email, bold, tab } = useLocalSearchParams<{
    size?: string;
    lang?: string;
    org?: string;
    email?: string;
    bold?: string;
    tab?: string;
  }>();
  const start = {
    size: textSizeOf(size),
    language: languageOf(lang),
    longOrganisation: org === 'long',
    longEmail: email === 'long',
    bold: bold === 'on',
    at: TABS.find(([name]) => name === tab)?.[0] ?? 'Today',
  };

  return <TextSizeScreen key={JSON.stringify(start)} start={start} />;
}

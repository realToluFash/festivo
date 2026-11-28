import { useLocalSearchParams } from 'expo-router';

import { FocusedHeaderScreen } from '../../src/demo/focusedHeader/FocusedHeaderScreen.tsx';
import {
  headerLanguageOf,
  headerScreenOf,
  headerSizeOf,
} from '../../src/demo/focusedHeader/focusedHeaderRules.ts';

export default function DemoFocusedHeader() {
  const { size, lang, screen } = useLocalSearchParams<{
    size?: string;
    lang?: string;
    screen?: string;
  }>();
  const start = {
    size: headerSizeOf(size),
    language: headerLanguageOf(lang),
    screen: headerScreenOf(screen),
  };

  return <FocusedHeaderScreen key={JSON.stringify(start)} start={start} />;
}

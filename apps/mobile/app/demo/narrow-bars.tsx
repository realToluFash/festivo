import { useLocalSearchParams } from 'expo-router';

import { NarrowBarsScreen } from '../../src/demo/narrowBars/NarrowBarsScreen.tsx';
import {
  eventBarOf,
  languageOf,
  sizeOf,
  widthOf,
} from '../../src/demo/narrowBars/narrowBarsRules.ts';

export default function DemoNarrowBars() {
  const { width, size, lang, bar } = useLocalSearchParams<{
    width?: string;
    size?: string;
    lang?: string;
    bar?: string;
  }>();
  const start = {
    width: widthOf(width),
    size: sizeOf(size),
    language: languageOf(lang),
    eventBar: eventBarOf(bar),
  };

  return <NarrowBarsScreen key={JSON.stringify(start)} start={start} />;
}

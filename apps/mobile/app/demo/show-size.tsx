import { useLocalSearchParams } from 'expo-router';

import { ShowSizeScreen } from '../../src/demo/showSize/ShowSizeScreen.tsx';
import {
  FILTER_LANGUAGES,
  FILTER_SIZES,
  keyOf,
} from '../../src/demo/filterSize/filterSizeRules.ts';
import { SHOW_CHOSEN, SHOW_ROWS, chosenIn } from '../../src/demo/showSize/showSizeRules.ts';

export default function DemoShowSize() {
  const { size, lang, rows, chosen } = useLocalSearchParams<{
    size?: string;
    lang?: string;
    rows?: string;
    chosen?: string;
  }>();
  const shownRows = keyOf(SHOW_ROWS, rows, 'main');
  const start = {
    size: keyOf(FILTER_SIZES, size, 'device'),
    language: keyOf(FILTER_LANGUAGES, lang, 'en'),
    rows: shownRows,
    chosen: chosenIn(shownRows, keyOf(SHOW_CHOSEN, chosen, 'all')),
  };

  return <ShowSizeScreen key={JSON.stringify(start)} start={start} />;
}

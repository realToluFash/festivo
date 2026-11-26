import { useLocalSearchParams } from 'expo-router';

import { RowsSizeScreen } from '../../src/demo/rowsSize/RowsSizeScreen.tsx';
import { ROWS_LANGUAGES, ROWS_NAMES, ROWS_SIZES } from '../../src/demo/rowsSize/rowsSizeRules.ts';

export default function DemoRowsSize() {
  const { size, lang, name } = useLocalSearchParams<{
    size?: string;
    lang?: string;
    name?: string;
  }>();
  const start = {
    size: ROWS_SIZES.find((each) => each.key === size)?.key ?? 'device',
    language: ROWS_LANGUAGES.find((each) => each.key === lang)?.key ?? 'en',
    name: ROWS_NAMES.find((each) => each.key === name)?.key ?? 'qa',
  };

  return <RowsSizeScreen key={JSON.stringify(start)} start={start} />;
}

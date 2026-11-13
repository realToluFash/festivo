import { useLocalSearchParams } from 'expo-router';

import { SearchScreen } from '../../src/demo/search/SearchScreen.tsx';
import { searchStart, searchStateOf } from '../../src/demo/search/searchRules.ts';

export default function DemoSearch() {
  const { state } = useLocalSearchParams<{ state?: string }>();
  const name = searchStateOf(state ?? null);

  return <SearchScreen key={name ?? ''} start={searchStart(name)} />;
}

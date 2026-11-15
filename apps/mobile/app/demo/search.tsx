import { useLocalSearchParams } from 'expo-router';

import { SearchScreen } from '../../src/demo/search/SearchScreen.tsx';
import { reachOfParam, searchStart, searchStateOf } from '../../src/demo/search/searchRules.ts';

export default function DemoSearch() {
  const { state, as } = useLocalSearchParams<{ state?: string; as?: string }>();
  const name = searchStateOf(state ?? null);

  return (
    <SearchScreen
      key={`${name ?? ''}:${as ?? ''}`}
      start={searchStart(name, reachOfParam(as ?? null))}
    />
  );
}

import { useLocalSearchParams } from 'expo-router';

import { SearchScreen } from '../../src/demo/search/SearchScreen.tsx';
import { reachOfParam, searchStart, searchStateOf } from '../../src/demo/search/searchRules.ts';

export default function DemoSearch() {
  const { state, as, q } = useLocalSearchParams<{ state?: string; as?: string; q?: string }>();
  const name = searchStateOf(state ?? null);

  return (
    <SearchScreen
      key={`${name ?? ''}:${as ?? ''}:${q ?? ''}`}
      start={searchStart(name, reachOfParam(as ?? null), q)}
    />
  );
}

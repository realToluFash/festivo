import { useLocalSearchParams } from 'expo-router';

import { SearchHeaderScreen } from '../../src/demo/search/SearchHeader.tsx';
import { SearchOnCoverScreen } from '../../src/demo/search/SearchOnCover.tsx';

export default function DemoSearchHeader() {
  const { on } = useLocalSearchParams<{ on?: string }>();

  if (on === 'today' || on === 'today-now') return <SearchOnCoverScreen now={on === 'today-now'} />;

  return <SearchHeaderScreen />;
}

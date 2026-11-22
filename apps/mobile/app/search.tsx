import { Redirect, useLocalSearchParams } from 'expo-router';

import { SearchScreen } from '../src/components/SearchScreen.tsx';
import { SEARCH_OPENED_WITH } from '../src/kit/searchLinks.ts';
import { useSignedIn } from '../src/signedIn.ts';

export default function Search() {
  const { organisation } = useSignedIn();
  const { [SEARCH_OPENED_WITH]: term } = useLocalSearchParams<{ [SEARCH_OPENED_WITH]?: string }>();

  return organisation == null ? (
    <Redirect href="/" />
  ) : (
    <SearchScreen organisationId={organisation.id} term={term} />
  );
}

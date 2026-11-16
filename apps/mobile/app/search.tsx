import { Redirect } from 'expo-router';

import { SearchScreen } from '../src/components/SearchScreen.tsx';
import { useSignedIn } from '../src/signedIn.ts';

export default function Search() {
  const { organisation } = useSignedIn();

  return organisation == null ? (
    <Redirect href="/" />
  ) : (
    <SearchScreen organisationId={organisation.id} />
  );
}
